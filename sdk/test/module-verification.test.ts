import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import {
  createCommunityWorkClaim,
  createModuleAcquisitionReceipt,
  createModuleManifest,
  createVerificationRunReceipt,
  hashCommunityWorkClaim,
  hashModuleAcquisitionReceipt,
  hashModuleManifest,
  hashVerificationEnvironment,
  hashVerificationRunReceipt,
  readCommunityWorkClaim,
  readModuleAcquisitionReceipt,
  readModuleManifest,
  readVerificationRunReceipt,
  validateCommunityWorkClaim,
  validateModuleAcquisitionReceipt,
  validateModuleManifest,
  validateVerificationRunReceipt,
  type CommunityWorkClaim,
  type ModuleAcquisitionReceipt,
  type ModuleManifest,
  type VerificationRunReceipt,
} from "../src/module-verification.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const RESPONSIBLE = "0x5555555555555555555555555555555555555555";
const VALIDATOR = "0x6666666666666666666666666666666666666666";
const MODULE_DIGEST = "1".repeat(64);
const PROOF_DIGEST = "2".repeat(64);
const LOG_DIGEST = "3".repeat(64);
const ENVIRONMENT_HASH = "4".repeat(64);
const PASSPORT_ID = `0x${"5".repeat(64)}`;
const CREATED_AT = "2026-05-25T00:00:00.000Z";
const COMPLETED_AT = "2026-05-25T00:10:00.000Z";

test("module verification artifacts compute stable hashes", () => {
  const manifest = moduleManifest();
  const acquisition = acquisitionReceipt(manifest);
  const run = verificationRunReceipt(manifest, acquisition);
  const claim = communityWorkClaim(manifest, acquisition, run);

  assert.equal(validateModuleManifest(manifest).computedHash, manifest.manifest_hash);
  assert.equal(validateModuleAcquisitionReceipt(acquisition).computedHash, acquisition.receipt_hash);
  assert.equal(validateVerificationRunReceipt(run).computedHash, run.receipt_hash);
  assert.equal(validateCommunityWorkClaim(claim).computedHash, claim.claim_hash);
  assert.equal(hashModuleManifest({ ...manifest, manifest_hash: "0".repeat(64) }), manifest.manifest_hash);
  assert.equal(hashModuleAcquisitionReceipt({ ...acquisition, receipt_hash: "0".repeat(64) }), acquisition.receipt_hash);
  assert.equal(hashVerificationRunReceipt({ ...run, receipt_hash: "0".repeat(64) }), run.receipt_hash);
  assert.equal(hashCommunityWorkClaim({ ...claim, claim_hash: "0".repeat(64) }), claim.claim_hash);
  assert.equal(
    hashVerificationEnvironment({
      runner_version: "ec16a-runner-v1",
      node_version: "24.x",
      os: "linux",
      sandbox_image_digest: "sha256:abc",
    }),
    hashVerificationEnvironment({
      sandbox_image_digest: "sha256:abc",
      os: "linux",
      node_version: "24.x",
      runner_version: "ec16a-runner-v1",
    }),
  );
});

test("module verification validation rejects tampering and bad fields", () => {
  const manifest = moduleManifest();
  const acquisition = acquisitionReceipt(manifest);
  const run = verificationRunReceipt(manifest, acquisition);
  const claim = communityWorkClaim(manifest, acquisition, run);

  const invalidManifests: unknown[] = [
    { ...manifest, storage_uri: "https://github.com/org/repo/releases/download/v1/module.tar.gz" },
    { ...manifest, storage_uri: "https://github.com/org/repo/releases/download/v1/module.tar.gz?token=secret" },
    { ...manifest, module_digest: "0".repeat(63) },
    { ...manifest, responsible_address: "not-an-address" },
    { ...manifest, agent_passport_id: "bad" },
    { ...manifest, manifest_hash: "0".repeat(64) },
    { ...manifest, prompt: "private" },
  ];
  for (const candidate of invalidManifests) {
    assert.equal(validateModuleManifest(candidate).ok, false);
  }

  const invalidAcquisitions: unknown[] = [
    { ...acquisition, manifest_hash: "0".repeat(63) },
    { ...acquisition, acquired_by: "not-an-address" },
    { ...acquisition, hash_matched: "true" },
    { ...acquisition, storage_uri: "oci://registry.example/module?token=secret" },
    { ...acquisition, receipt_hash: "0".repeat(64) },
  ];
  for (const candidate of invalidAcquisitions) {
    assert.equal(validateModuleAcquisitionReceipt(candidate).ok, false);
  }

  const invalidRuns: unknown[] = [
    { ...run, validator_address: "not-an-address" },
    { ...run, run_result: "unknown" },
    { ...run, log_uri: "ipfs://logs/run?token=secret" },
    { ...run, completed_at: "2026-05-24T23:59:59.000Z" },
    { ...run, receipt_hash: "0".repeat(64) },
  ];
  for (const candidate of invalidRuns) {
    assert.equal(validateVerificationRunReceipt(candidate).ok, false);
  }

  const invalidClaims: unknown[] = [
    { ...claim, responsible_address: undefined },
    { ...claim, responsible_address: undefined, agent_passport_id: PASSPORT_ID },
    { ...claim, work_kind: "reward" },
    { ...claim, proof_uri: "https://github.com/org/proofs/blob/main/run.md?token=secret" },
    { ...claim, proof_digest: "0".repeat(63) },
    { ...claim, artifact_hashes: [] },
    { ...claim, artifact_hashes: ["0".repeat(63)] },
    { ...claim, claim_hash: "0".repeat(64) },
  ];
  for (const candidate of invalidClaims) {
    assert.equal(validateCommunityWorkClaim(candidate).ok, false);
  }
});

test("module acquisition receipt with hash_matched false is structurally valid", () => {
  const manifest = moduleManifest();
  const receipt = createModuleAcquisitionReceipt({
    module_id: manifest.module_id,
    manifest_hash: manifest.manifest_hash,
    storage_uri: manifest.storage_uri,
    downloaded_digest: "9".repeat(64),
    expected_digest: manifest.module_digest,
    hash_matched: false,
    acquired_by: VALIDATOR,
    acquired_at: CREATED_AT,
    created_at: CREATED_AT,
  });

  assert.equal(validateModuleAcquisitionReceipt(receipt).ok, true);
  assert.equal(receipt.hash_matched, false);
});

test("module verification read and write helpers round-trip artifacts", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec16a-module-verification-"));
  const manifest = moduleManifest();
  const acquisition = acquisitionReceipt(manifest);
  const run = verificationRunReceipt(manifest, acquisition);
  const claim = communityWorkClaim(manifest, acquisition, run);

  const manifestPath = join(tmp, "manifest.json");
  const acquisitionPath = join(tmp, "acquisition.json");
  const runPath = join(tmp, "run.json");
  const claimPath = join(tmp, "claim.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(acquisitionPath, `${JSON.stringify(acquisition, null, 2)}\n`);
  writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);
  writeFileSync(claimPath, `${JSON.stringify(claim, null, 2)}\n`);

  assert.equal(readModuleManifest(manifestPath).manifest_hash, manifest.manifest_hash);
  assert.equal(readModuleAcquisitionReceipt(acquisitionPath).receipt_hash, acquisition.receipt_hash);
  assert.equal(readVerificationRunReceipt(runPath).receipt_hash, run.receipt_hash);
  assert.equal(readCommunityWorkClaim(claimPath).claim_hash, claim.claim_hash);
});

test("module verification CLI creates and validates artifacts", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec16a-module-verification-cli-"));
  const manifestPath = join(tmp, "manifest.json");
  const acquisitionPath = join(tmp, "acquisition.json");
  const runPath = join(tmp, "run.json");
  const claimPath = join(tmp, "claim.json");

  const manifest = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "create-module-manifest",
        "--module-id",
        "github.com/originagent/demo-module@1.0.0",
        "--module-name",
        "demo-module",
        "--version",
        "1.0.0",
        "--storage-uri",
        "https://github.com/originagent/demo-module/releases/download/v1/module.tar.gz",
        "--storage-kind",
        "github_release",
        "--module-digest",
        MODULE_DIGEST,
        "--digest-algorithm",
        "sha256",
        "--responsible-address",
        RESPONSIBLE,
        "--agent-passport-id",
        PASSPORT_ID,
        "--source-repository-uri",
        "https://github.com/originagent/demo-module",
        "--created-at",
        CREATED_AT,
        "--out",
        manifestPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  ) as ModuleManifest;
  assert.equal(manifest.manifest_hash, readModuleManifest(manifestPath).manifest_hash);
  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "validate-module-manifest", manifestPath], { cwd: ROOT, encoding: "utf8" })).ok, true);

  const acquisition = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "create-module-acquisition-receipt",
        "--module-id",
        manifest.module_id,
        "--manifest-hash",
        manifest.manifest_hash,
        "--storage-uri",
        manifest.storage_uri,
        "--downloaded-digest",
        manifest.module_digest,
        "--expected-digest",
        manifest.module_digest,
        "--hash-matched",
        "true",
        "--acquired-by",
        VALIDATOR,
        "--acquired-at",
        CREATED_AT,
        "--created-at",
        CREATED_AT,
        "--out",
        acquisitionPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  ) as ModuleAcquisitionReceipt;
  assert.equal(acquisition.receipt_hash, readModuleAcquisitionReceipt(acquisitionPath).receipt_hash);
  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "validate-module-acquisition-receipt", acquisitionPath], { cwd: ROOT, encoding: "utf8" })).ok, true);

  const run = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "create-verification-run-receipt",
        "--module-id",
        manifest.module_id,
        "--manifest-hash",
        manifest.manifest_hash,
        "--acquisition-receipt-hash",
        acquisition.receipt_hash,
        "--validator-address",
        VALIDATOR,
        "--environment-hash",
        ENVIRONMENT_HASH,
        "--run-result",
        "passed",
        "--log-uri",
        "https://github.com/originagent/demo-module/proofs/run-log.txt",
        "--log-digest",
        LOG_DIGEST,
        "--started-at",
        CREATED_AT,
        "--completed-at",
        COMPLETED_AT,
        "--created-at",
        COMPLETED_AT,
        "--out",
        runPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  ) as VerificationRunReceipt;
  assert.equal(run.receipt_hash, readVerificationRunReceipt(runPath).receipt_hash);
  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "validate-verification-run-receipt", runPath], { cwd: ROOT, encoding: "utf8" })).ok, true);

  const claim = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "create-community-work-claim",
        "--claim-id",
        "claim-demo-module-1",
        "--responsible-address",
        RESPONSIBLE,
        "--agent-passport-id",
        PASSPORT_ID,
        "--work-kind",
        "testing",
        "--summary",
        "validated demo module in isolated runner",
        "--proof-uri",
        "https://github.com/originagent/demo-module/proofs/report.md",
        "--proof-digest",
        PROOF_DIGEST,
        "--artifact-hashes",
        manifest.manifest_hash,
        acquisition.receipt_hash,
        run.receipt_hash,
        "--created-at",
        COMPLETED_AT,
        "--out",
        claimPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  ) as CommunityWorkClaim;
  assert.equal(claim.claim_hash, readCommunityWorkClaim(claimPath).claim_hash);
  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "validate-community-work-claim", claimPath], { cwd: ROOT, encoding: "utf8" })).ok, true);

  const invalidPath = join(tmp, "invalid-claim.json");
  writeFileSync(invalidPath, JSON.stringify({ ...claim, responsible_address: undefined }, null, 2));
  const invalid = spawnSync(process.execPath, [CLI, "validate-community-work-claim", invalidPath], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.notEqual(invalid.status, 0);
  assert.match(JSON.parse(invalid.stdout).errors.join("\n"), /responsible_address/);
});

function moduleManifest(): ModuleManifest {
  return createModuleManifest({
    module_id: "github.com/originagent/demo-module@1.0.0",
    module_name: "demo-module",
    version: "1.0.0",
    storage_uri: "https://github.com/originagent/demo-module/releases/download/v1/module.tar.gz",
    storage_kind: "github_release",
    module_digest: MODULE_DIGEST,
    digest_algorithm: "sha256",
    responsible_address: RESPONSIBLE,
    agent_passport_id: PASSPORT_ID,
    source_repository_uri: "https://github.com/originagent/demo-module",
    created_at: CREATED_AT,
  });
}

function acquisitionReceipt(manifest: ModuleManifest): ModuleAcquisitionReceipt {
  return createModuleAcquisitionReceipt({
    module_id: manifest.module_id,
    manifest_hash: manifest.manifest_hash,
    storage_uri: manifest.storage_uri,
    downloaded_digest: manifest.module_digest,
    expected_digest: manifest.module_digest,
    hash_matched: true,
    acquired_by: VALIDATOR,
    acquired_at: CREATED_AT,
    created_at: CREATED_AT,
  });
}

function verificationRunReceipt(manifest: ModuleManifest, acquisition: ModuleAcquisitionReceipt): VerificationRunReceipt {
  return createVerificationRunReceipt({
    module_id: manifest.module_id,
    manifest_hash: manifest.manifest_hash,
    acquisition_receipt_hash: acquisition.receipt_hash,
    validator_address: VALIDATOR,
    environment_hash: ENVIRONMENT_HASH,
    run_result: "passed",
    log_uri: "https://github.com/originagent/demo-module/proofs/run-log.txt",
    log_digest: LOG_DIGEST,
    started_at: CREATED_AT,
    completed_at: COMPLETED_AT,
    created_at: COMPLETED_AT,
  });
}

function communityWorkClaim(
  manifest: ModuleManifest,
  acquisition: ModuleAcquisitionReceipt,
  run: VerificationRunReceipt,
): CommunityWorkClaim {
  return createCommunityWorkClaim({
    claim_id: "claim-demo-module-1",
    responsible_address: RESPONSIBLE,
    agent_passport_id: PASSPORT_ID,
    work_kind: "testing",
    summary: "validated demo module in isolated runner",
    proof_uri: "https://github.com/originagent/demo-module/proofs/report.md",
    proof_digest: PROOF_DIGEST,
    artifact_hashes: [manifest.manifest_hash, acquisition.receipt_hash, run.receipt_hash],
    referenced_events: ["event:ModuleSubmitted:demo-module"],
    created_at: COMPLETED_AT,
  });
}
