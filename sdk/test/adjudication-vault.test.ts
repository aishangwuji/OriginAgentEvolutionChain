import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import { validateValidatorVerdictCommitment, validateValidatorVerdictReveal } from "../src/adjudication.ts";
import {
  openAdjudicationVault,
  readExportedVerdictCommitment,
  writeExportedVerdictCommitment,
} from "../src/adjudication-vault.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const CHALLENGE = `0x${"1".repeat(64)}`;
const VALIDATOR = "0x6666666666666666666666666666666666666666";
const VERDICT_HASH = `0x${"4".repeat(64)}`;
const METHOD_HASH = `0x${"7".repeat(64)}`;
const SALT = `0x${"a".repeat(64)}`;
const CREATED_AT = "2026-05-24T00:00:00.000Z";
const COMMIT_TX = `0x${"b".repeat(64)}`;
const REVEAL_TX = `0x${"c".repeat(64)}`;

test("vault saves commitment before broadcast and creates reveal from stored salt", () => {
  const vaultPath = vaultPathInTemp();
  const vault = openAdjudicationVault(vaultPath);
  try {
    const record = vault.saveBeforeBroadcast(input());
    assert.equal(record.status, "pending_commit");
    assert.equal(record.salt, SALT);

    const commitment = vault.commitmentArtifact(CHALLENGE, VALIDATOR, CREATED_AT);
    assert.equal(validateValidatorVerdictCommitment(commitment).ok, true);
    assert.equal(commitment.commitment_hash, record.commitment_hash);

    vault.markCommitSubmitted(CHALLENGE, VALIDATOR, COMMIT_TX, CREATED_AT, 12);
    const reveal = vault.revealArtifact(CHALLENGE, VALIDATOR);
    assert.equal(validateValidatorVerdictReveal(reveal).ok, true);
    assert.equal(reveal.salt, SALT);
    assert.equal(reveal.commitment_hash, record.commitment_hash);
  } finally {
    vault.close();
  }
});

test("vault retries reveal after dropped transaction without overwriting salt", () => {
  const vault = openAdjudicationVault(vaultPathInTemp());
  try {
    vault.saveBeforeBroadcast(input());
    vault.markCommitSubmitted(CHALLENGE, VALIDATOR, COMMIT_TX, CREATED_AT);
    vault.markRevealSubmitted(CHALLENGE, VALIDATOR, REVEAL_TX, CREATED_AT);

    const retry = vault.retryReveal(CHALLENGE, VALIDATOR, false);
    assert.equal(retry.salt, SALT);
    assert.equal(vault.listPendingReveals().length, 1);

    assert.throws(() => vault.retryReveal(CHALLENGE, VALIDATOR, true), /already revealed on-chain/);
    assert.equal(vault.get(CHALLENGE, VALIDATOR)?.status, "revealed");
  } finally {
    vault.close();
  }
});

test("vault export and import restore enough data to reveal", () => {
  const source = openAdjudicationVault(vaultPathInTemp());
  let exportedPath = "";
  try {
    source.saveBeforeBroadcast(input());
    const exported = source.exportRecord(CHALLENGE, VALIDATOR, CREATED_AT);
    exportedPath = join(mkdtempSync(join(tmpdir(), "ec15b-vault-export-")), "commitment.json");
    writeExportedVerdictCommitment(exported, exportedPath);
  } finally {
    source.close();
  }

  const target = openAdjudicationVault(vaultPathInTemp());
  try {
    target.importRecord(readExportedVerdictCommitment(exportedPath));
    const reveal = target.revealArtifact(CHALLENGE, VALIDATOR);
    assert.equal(reveal.salt, SALT);
    assert.equal(validateValidatorVerdictReveal(reveal).ok, true);
  } finally {
    target.close();
  }
});

test("vault rejects missing or conflicting salt", () => {
  const vault = openAdjudicationVault(vaultPathInTemp());
  try {
    assert.throws(() => vault.revealArtifact(CHALLENGE, VALIDATOR), /no local verdict commitment/);
    vault.saveBeforeBroadcast(input());
    assert.throws(
      () => vault.saveBeforeBroadcast(input({ salt: `0x${"d".repeat(64)}` })),
      /refusing to overwrite/,
    );
  } finally {
    vault.close();
  }
});

test("CLI writes vault before commit dry-run and can export, import, reveal, retry", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec15b-vault-cli-"));
  const vaultPath = join(tmp, "vault.sqlite");
  const exportPath = join(tmp, "export.json");
  const revealPath = join(tmp, "reveal.json");
  const importedVaultPath = join(tmp, "imported.sqlite");

  const commit = JSON.parse(execFileSync(process.execPath, [
    CLI,
    "commit-validator-verdict",
    "--challenge-id",
    CHALLENGE,
    "--validator",
    VALIDATOR,
    "--claimed-upheld",
    "true",
    "--verdict-hash",
    VERDICT_HASH,
    "--method-hash",
    METHOD_HASH,
    "--salt",
    SALT,
    "--created-at",
    CREATED_AT,
    "--vault",
    vaultPath,
  ], { cwd: ROOT, encoding: "utf8" }));
  assert.equal(commit.method, "commitVerdict");
  assert.equal(existsSync(vaultPath), true);

  const exported = JSON.parse(execFileSync(process.execPath, [
    CLI,
    "export-verdict-commitment",
    "--challenge-id",
    CHALLENGE,
    "--validator",
    VALIDATOR,
    "--vault",
    vaultPath,
    "--out",
    exportPath,
  ], { cwd: ROOT, encoding: "utf8" }));
  assert.equal(exported.schema_version, "originagent.evolution.verdict_commitment_export.v1");

  execFileSync(process.execPath, [
    CLI,
    "import-verdict-commitment",
    "--file",
    exportPath,
    "--vault",
    importedVaultPath,
  ], { cwd: ROOT, encoding: "utf8" });

  const reveal = JSON.parse(execFileSync(process.execPath, [
    CLI,
    "reveal-validator-verdict",
    "--challenge-id",
    CHALLENGE,
    "--validator",
    VALIDATOR,
    "--vault",
    importedVaultPath,
    "--reveal-out",
    revealPath,
  ], { cwd: ROOT, encoding: "utf8" }));
  assert.equal(reveal.method, "revealVerdict");
  assert.equal(JSON.parse(readFileSync(revealPath, "utf8")).salt, SALT);

  const pending = JSON.parse(execFileSync(process.execPath, [
    CLI,
    "list-pending-verdict-reveals",
    "--vault",
    importedVaultPath,
  ], { cwd: ROOT, encoding: "utf8" }));
  assert.equal(pending.records.length, 0);
});

function input(overrides: Partial<Parameters<ReturnType<typeof openAdjudicationVault>["saveBeforeBroadcast"]>[0]> = {}) {
  return {
    challengeId: CHALLENGE,
    validator: VALIDATOR,
    claimedUpheld: true,
    verdictHash: VERDICT_HASH,
    methodHash: METHOD_HASH,
    salt: SALT,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function vaultPathInTemp(): string {
  return join(mkdtempSync(join(tmpdir(), "ec15b-vault-")), "vault.sqlite");
}
