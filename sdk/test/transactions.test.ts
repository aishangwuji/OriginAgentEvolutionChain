import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import { loadDeployment } from "../src/contracts.ts";
import { readProofBundle } from "../src/proof.ts";
import {
  consumeTestCreditTransaction,
  grantTestCreditTransaction,
  recordAgentMigrationTransaction,
  registerIdentityTransaction,
  registerAgentPassportTransaction,
  resolveChallengeTransaction,
  submitChallengeTransaction,
  submitModuleTransaction,
  submitScoreCommitTransaction,
  submitScoreRevealTransaction,
  submitVerificationTransaction,
} from "../src/transactions.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = join(ROOT, "fixtures", "proof_bundle.valid.json");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const STORAGE_URI =
  "oci://registry.example/originagent/demo-skill@sha256:1111111111111111111111111111111111111111111111111111111111111111";
const MODULE = `0x${"1".repeat(64)}`;
const EVIDENCE = `0x${"5".repeat(64)}`;
const CHALLENGE = `0x${"6".repeat(64)}`;
const REASON = `0x${"2".repeat(64)}`;
const SALT = `0x${"3".repeat(64)}`;
const METADATA = `0x${"7".repeat(64)}`;
const AGENT_KEY = `0x${"a".repeat(64)}`;
const GENESIS_HASH = `0x${"b".repeat(64)}`;
const PASSPORT = `0x${"c".repeat(64)}`;
const MIGRATION_HASH = `0x${"d".repeat(64)}`;
const ACTION_HASH = `0x${"e".repeat(64)}`;
const TRUST_POLICY_HASH = `0x${"f".repeat(64)}`;
const OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const OTHER_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

test("deploy-info reads local deployment addresses", () => {
  const deployment = loadDeployment("local");
  assert.equal(deployment.chainId, 31337);
  assert.equal(deployment.contracts.ModuleRegistry, "0x2222222222222222222222222222222222222222");

  const output = execFileSync(process.execPath, [CLI, "deploy-info", "--network", "local"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(JSON.parse(output).network, "local");
});

test("deploy-info honors custom deployments directory", () => {
  const deploymentsDir = mkdtempSync(join(tmpdir(), "ec5-deployments-"));
  writeFileSync(
    join(deploymentsDir, "local.json"),
    JSON.stringify({
      chainId: 31337,
      network: "local",
      contracts: {
        IdentityRegistry: "0x1111111111111111111111111111111111111111",
        AgentPassportRegistry: "0x6666666666666666666666666666666666666666",
        ModuleRegistry: "0x9999999999999999999999999999999999999999",
        VerificationRegistry: "0x3333333333333333333333333333333333333333",
        ScoreCommitReveal: "0x4444444444444444444444444444444444444444",
      },
      deployer: "0x5555555555555555555555555555555555555555",
      deployedAt: "test",
      contractVersion: "ec4.0.0",
    }),
  );

  const output = execFileSync(
    process.execPath,
    [CLI, "deploy-info", "--network", "local", "--deployments-dir", deploymentsDir],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(JSON.parse(output).contracts.ModuleRegistry, "0x9999999999999999999999999999999999999999");
});

test("register-identity dry-run validates role and encodes calldata", async () => {
  const result = await registerIdentityTransaction("validator", METADATA, { network: "local", dryRun: true });

  assert.equal(result.dryRun, true);
  assert.equal(result.contract, "IdentityRegistry");
  assert.equal(result.method, "registerIdentity");
  assert.equal(result.target, "0x1111111111111111111111111111111111111111");
  assert.deepEqual(result.args, [2, METADATA]);
  assert.match(result.calldata, /^0x[0-9a-f]+$/);
  await assert.rejects(
    () => registerIdentityTransaction("agent_operator", METADATA, { network: "local", dryRun: true }),
    /--role must be developer, validator, or operator/,
  );
});

test("agent passport dry-runs encode passport registry calls", async () => {
  const registered = await registerAgentPassportTransaction(OWNER, AGENT_KEY, GENESIS_HASH, METADATA, {
    network: "local",
    dryRun: true,
  });
  const migrated = await recordAgentMigrationTransaction(OWNER, PASSPORT, AGENT_KEY, MIGRATION_HASH, {
    network: "local",
    dryRun: true,
  });

  assert.equal(registered.contract, "AgentPassportRegistry");
  assert.equal(registered.method, "registerAgentPassport");
  assert.equal(registered.target, "0x6666666666666666666666666666666666666666");
  assert.deepEqual(registered.args, [AGENT_KEY, GENESIS_HASH, METADATA]);
  assert.equal(migrated.contract, "AgentPassportRegistry");
  assert.equal(migrated.method, "recordAgentMigration");
  assert.deepEqual(migrated.args, [PASSPORT, AGENT_KEY, MIGRATION_HASH]);
});

test("agent passport broadcasts require owner to match signer", async () => {
  const previousRpc = process.env.EVOLUTION_CHAIN_RPC_URL;
  const previousKey = process.env.EVOLUTION_CHAIN_PRIVATE_KEY;
  process.env.EVOLUTION_CHAIN_RPC_URL = "http://127.0.0.1:8545";
  process.env.EVOLUTION_CHAIN_PRIVATE_KEY = OTHER_PRIVATE_KEY;
  try {
    await assert.rejects(
      () =>
        registerAgentPassportTransaction(OWNER, AGENT_KEY, GENESIS_HASH, METADATA, {
          network: "local",
          dryRun: false,
        }),
      /--owner must match EVOLUTION_CHAIN_PRIVATE_KEY signer/,
    );
  } finally {
    if (previousRpc === undefined) {
      delete process.env.EVOLUTION_CHAIN_RPC_URL;
    } else {
      process.env.EVOLUTION_CHAIN_RPC_URL = previousRpc;
    }
    if (previousKey === undefined) {
      delete process.env.EVOLUTION_CHAIN_PRIVATE_KEY;
    } else {
      process.env.EVOLUTION_CHAIN_PRIVATE_KEY = previousKey;
    }
  }
});

test("submit-module dry-run uses prepare-module fields and encodes calldata", async () => {
  const result = await submitModuleTransaction(readProofBundle(FIXTURE), STORAGE_URI, { network: "local", dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(result.contract, "ModuleRegistry");
  assert.equal(result.method, "submitModule");
  assert.equal(result.target, "0x2222222222222222222222222222222222222222");
  assert.equal(result.publicPayload.moduleDigest, MODULE);
  assert.equal(result.publicPayload.storageUri, STORAGE_URI);
  assert.match(result.calldata, /^0x[0-9a-f]+$/);
  assert(!JSON.stringify(result).includes("prompt"));
  assert(!JSON.stringify(result).includes("facts"));
});

test("submit-verification dry-run maps proof bundle hashes", async () => {
  const result = await submitVerificationTransaction(readProofBundle(FIXTURE), { network: "local", dryRun: true });
  assert.equal(result.contract, "VerificationRegistry");
  assert.equal(result.method, "submitReport");
  assert.equal(result.publicPayload.proofBundleHash, `0x51aea71091be59887e07694fc704cbb52c87d16cc301ab36dd3ba203ce7f5494`);
  assert.equal(result.publicPayload.verificationReportHash, `0x${"3".repeat(64)}`);
  assert.equal(result.publicPayload.capabilitySnapshotHash, `0x${"0".repeat(64)}`);
  assert.equal(result.publicPayload.telemetryDigest, `0x${"4".repeat(64)}`);
});

test("score commit and reveal dry-runs share commit hash", async () => {
  const commit = await submitScoreCommitTransaction(MODULE, 88, REASON, SALT, { network: "local", dryRun: true });
  const reveal = await submitScoreRevealTransaction(MODULE, 88, REASON, SALT, { network: "local", dryRun: true });
  assert.equal(commit.contract, "ScoreCommitReveal");
  assert.equal(reveal.contract, "ScoreCommitReveal");
  assert.equal(commit.publicPayload.commitHash, reveal.publicPayload.commitHash);
});

test("test credit dry-runs use optional ledger and encode calldata", async () => {
  const grant = await grantTestCreditTransaction(PASSPORT, 100, ACTION_HASH, TRUST_POLICY_HASH, {
    network: "local",
    dryRun: true,
  });
  const consume = await consumeTestCreditTransaction(PASSPORT, 5, `0x${"1".repeat(64)}`, TRUST_POLICY_HASH, {
    network: "local",
    dryRun: true,
  });

  assert.equal(grant.contract, "TestCreditLedger");
  assert.equal(grant.method, "grantCredit");
  assert.equal(grant.target, "0x9999999999999999999999999999999999999999");
  assert.deepEqual(grant.args, [PASSPORT, 100, ACTION_HASH, TRUST_POLICY_HASH]);
  assert.equal(consume.contract, "TestCreditLedger");
  assert.equal(consume.method, "consumeCredit");
  assert.equal(consume.publicPayload.amount, 5);
});

test("test credit transaction fails clearly without optional ledger", async () => {
  const deploymentsDir = mkdtempSync(join(tmpdir(), "ec14-deployments-"));
  writeFileSync(
    join(deploymentsDir, "local.json"),
    JSON.stringify({
      chainId: 31337,
      network: "local",
      contracts: {
        IdentityRegistry: "0x1111111111111111111111111111111111111111",
        AgentPassportRegistry: "0x6666666666666666666666666666666666666666",
        ModuleRegistry: "0x9999999999999999999999999999999999999999",
        VerificationRegistry: "0x3333333333333333333333333333333333333333",
        ScoreCommitReveal: "0x4444444444444444444444444444444444444444",
      },
      deployer: "0x5555555555555555555555555555555555555555",
      deployedAt: "test",
      contractVersion: "ec11.0.0",
    }),
  );

  await assert.rejects(
    () =>
      grantTestCreditTransaction(PASSPORT, 100, ACTION_HASH, TRUST_POLICY_HASH, {
        network: "local",
        deploymentsDir,
        dryRun: true,
      }),
    /TestCreditLedger not found/,
  );
});

test("challenge submit and resolve dry-runs encode verification registry calls", async () => {
  const submitted = await submitChallengeTransaction(EVIDENCE, REASON, { network: "local", dryRun: true });
  const resolved = await resolveChallengeTransaction(CHALLENGE, true, REASON, { network: "local", dryRun: true });

  assert.equal(submitted.contract, "VerificationRegistry");
  assert.equal(submitted.method, "submitChallenge");
  assert.deepEqual(submitted.args, [EVIDENCE, REASON]);
  assert.equal(resolved.contract, "VerificationRegistry");
  assert.equal(resolved.method, "resolveChallenge");
  assert.deepEqual(resolved.args, [CHALLENGE, true, REASON]);
});

test("non-dry-run refuses to broadcast without explicit RPC and private key", async () => {
  const previousRpc = process.env.EVOLUTION_CHAIN_RPC_URL;
  const previousKey = process.env.EVOLUTION_CHAIN_PRIVATE_KEY;
  delete process.env.EVOLUTION_CHAIN_RPC_URL;
  delete process.env.EVOLUTION_CHAIN_PRIVATE_KEY;
  try {
    await assert.rejects(
      () => submitModuleTransaction(readProofBundle(FIXTURE), STORAGE_URI, { network: "local", dryRun: false }),
      /EVOLUTION_CHAIN_RPC_URL is required/,
    );
  } finally {
    if (previousRpc !== undefined) {
      process.env.EVOLUTION_CHAIN_RPC_URL = previousRpc;
    }
    if (previousKey !== undefined) {
      process.env.EVOLUTION_CHAIN_PRIVATE_KEY = previousKey;
    }
  }
});

test("chain-state-check refuses to run without RPC", () => {
  const previousRpc = process.env.EVOLUTION_CHAIN_RPC_URL;
  delete process.env.EVOLUTION_CHAIN_RPC_URL;
  try {
    const output = spawnSync(
      process.execPath,
      [CLI, "chain-state-check", "--network", "local", "--module-digest", MODULE],
      { cwd: ROOT, encoding: "utf8" },
    );
    assert.notEqual(output.status, 0);
    const parsed = JSON.parse(output.stdout);
    assert.equal(parsed.ok, false);
    assert.match(parsed.error, /EVOLUTION_CHAIN_RPC_URL is required/);
  } finally {
    if (previousRpc !== undefined) {
      process.env.EVOLUTION_CHAIN_RPC_URL = previousRpc;
    }
  }
});

test("CLI submit dry-runs emit calldata", () => {
  const output = execFileSync(
    process.execPath,
    [
      CLI,
      "submit-module",
      "--proof-bundle",
      FIXTURE,
      "--storage-uri",
      STORAGE_URI,
      "--network",
      "local",
      "--dry-run",
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  const parsed = JSON.parse(output);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.contract, "ModuleRegistry");
  assert.match(parsed.calldata, /^0x[0-9a-f]+$/);
});
