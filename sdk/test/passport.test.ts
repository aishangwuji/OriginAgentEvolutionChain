import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters, keccak256 } from "viem";

import {
  computeAgentGenesisHash,
  computeAgentKeyHash,
  computeAgentMigrationHash,
  computeAgentPassportId,
  createAgentMigrationRecord,
  createAgentPassportRecord,
  readAgentMigrationRecord,
  readAgentPassportRecord,
  validateAgentMigrationRecord,
  validateAgentPassportRecord,
} from "../src/passport.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const PUBLIC_KEY = `0x${"1".repeat(64)}`;
const AGENT_KEY_HASH = computeAgentKeyHash(PUBLIC_KEY);
const NEXT_AGENT_KEY_HASH = `0x${"2".repeat(64)}`;
const GENESIS_NONCE = `0x${"3".repeat(64)}`;
const MIGRATION_NONCE = `0x${"4".repeat(64)}`;
const METADATA_HASH = `0x${"0".repeat(64)}`;

test("agent passport hashes use ABI encoding and raw Ed25519 public key sha256", () => {
  const expectedKeyHash = `0x${createHash("sha256").update(Buffer.from(PUBLIC_KEY.slice(2), "hex")).digest("hex")}`;
  const genesisHash = computeAgentGenesisHash(OWNER, AGENT_KEY_HASH, GENESIS_NONCE, METADATA_HASH);
  const passportId = computeAgentPassportId(OWNER, AGENT_KEY_HASH, genesisHash);
  const migrationHash = computeAgentMigrationHash(passportId, AGENT_KEY_HASH, NEXT_AGENT_KEY_HASH, MIGRATION_NONCE);

  assert.equal(AGENT_KEY_HASH, expectedKeyHash);
  assert.equal(
    genesisHash,
    keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
        [OWNER, AGENT_KEY_HASH, GENESIS_NONCE, METADATA_HASH],
      ),
    ),
  );
  assert.equal(
    passportId,
    keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "bytes32" }, { type: "bytes32" }],
        [OWNER, AGENT_KEY_HASH, genesisHash],
      ),
    ),
  );
  assert.equal(
    migrationHash,
    keccak256(
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
        [passportId, AGENT_KEY_HASH, NEXT_AGENT_KEY_HASH, MIGRATION_NONCE],
      ),
    ),
  );
});

test("agent passport and migration records validate computed hashes", () => {
  const passport = createAgentPassportRecord({
    owner: OWNER,
    agentKeyHash: AGENT_KEY_HASH,
    genesisNonce: GENESIS_NONCE,
    metadataHash: METADATA_HASH,
  });
  const migration = createAgentMigrationRecord({
    passportId: passport.passport_id,
    owner: OWNER,
    oldAgentKeyHash: AGENT_KEY_HASH,
    newAgentKeyHash: NEXT_AGENT_KEY_HASH,
    migrationNonce: MIGRATION_NONCE,
  });

  assert.equal(validateAgentPassportRecord(passport).ok, true);
  assert.equal(validateAgentMigrationRecord(migration).ok, true);
  assert.equal(passport.metadata_hash, METADATA_HASH);
  assert.equal(migration.passport_id, passport.passport_id);

  const tamperedPassport = { ...passport, genesis_nonce: `0x${"5".repeat(64)}` };
  assert.equal(validateAgentPassportRecord(tamperedPassport).ok, false);
  assert.match(validateAgentPassportRecord(tamperedPassport).errors.join("\n"), /genesis_hash mismatch|passport_id mismatch/);

  const tamperedMigration = { ...migration, new_agent_key_hash: `0x${"6".repeat(64)}` };
  assert.equal(validateAgentMigrationRecord(tamperedMigration).ok, false);
  assert.match(validateAgentMigrationRecord(tamperedMigration).errors.join("\n"), /migration_hash mismatch/);
});

test("agent passport record validation rejects private fields and zero required hashes", () => {
  const passport = createAgentPassportRecord({
    owner: OWNER,
    agentKeyHash: AGENT_KEY_HASH,
    genesisNonce: GENESIS_NONCE,
    metadataHash: METADATA_HASH,
  });
  const withPrivate = { ...passport, prompt: "private", local_path: "C:\\Users\\15216\\secret.txt" };
  const zeroKey = { ...passport, agent_key_hash: METADATA_HASH };

  assert.equal(validateAgentPassportRecord(withPrivate).ok, false);
  assert.match(validateAgentPassportRecord(withPrivate).errors.join("\n"), /unknown field|forbidden private field|local absolute path/);
  assert.equal(validateAgentPassportRecord(zeroKey).ok, false);
  assert.match(validateAgentPassportRecord(zeroKey).errors.join("\n"), /agent_key_hash must not be zero/);
});

test("agent passport CLI creates, writes, and validates records", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec8-passport-"));
  const passportPath = join(tmp, "agent-passport-record.json");
  const migrationPath = join(tmp, "agent-migration-record.json");

  const createdPassport = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "create-agent-passport-record",
        "--owner",
        OWNER,
        "--agent-key-hash",
        AGENT_KEY_HASH,
        "--genesis-nonce",
        GENESIS_NONCE,
        "--metadata-hash",
        METADATA_HASH,
        "--out",
        passportPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  );
  assert.equal(createdPassport.passport_id, readAgentPassportRecord(passportPath).passport_id);

  const createdMigration = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "create-agent-migration-record",
        "--passport-id",
        createdPassport.passport_id,
        "--owner",
        OWNER,
        "--old-agent-key-hash",
        AGENT_KEY_HASH,
        "--new-agent-key-hash",
        NEXT_AGENT_KEY_HASH,
        "--migration-nonce",
        MIGRATION_NONCE,
        "--out",
        migrationPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  );
  assert.equal(createdMigration.migration_hash, readAgentMigrationRecord(migrationPath).migration_hash);

  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "validate-agent-passport-record", passportPath], { cwd: ROOT, encoding: "utf8" })).ok, true);
  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "validate-agent-migration-record", migrationPath], { cwd: ROOT, encoding: "utf8" })).ok, true);

  const invalidPath = join(tmp, "invalid-passport.json");
  writeFileSync(invalidPath, JSON.stringify({ ...createdPassport, passport_id: `0x${"9".repeat(64)}` }));
  const invalid = spawnSync(process.execPath, [CLI, "validate-agent-passport-record", invalidPath], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.notEqual(invalid.status, 0);
  assert.match(JSON.parse(invalid.stdout).errors.join("\n"), /passport_id mismatch/);
});

test("agent passport CLI computes hashes", () => {
  const keyHash = JSON.parse(
    execFileSync(process.execPath, [CLI, "compute-agent-key-hash", "--public-key", PUBLIC_KEY], {
      cwd: ROOT,
      encoding: "utf8",
    }),
  ).agent_key_hash;
  const genesisHash = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "compute-agent-genesis-hash",
        "--owner",
        OWNER,
        "--agent-key-hash",
        keyHash,
        "--genesis-nonce",
        GENESIS_NONCE,
        "--metadata-hash",
        METADATA_HASH,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  ).genesis_hash;
  const passportId = JSON.parse(
    execFileSync(
      process.execPath,
      [CLI, "compute-agent-passport-id", "--owner", OWNER, "--agent-key-hash", keyHash, "--genesis-hash", genesisHash],
      { cwd: ROOT, encoding: "utf8" },
    ),
  ).passport_id;
  const migrationHash = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "compute-agent-migration-hash",
        "--passport-id",
        passportId,
        "--old-agent-key-hash",
        keyHash,
        "--new-agent-key-hash",
        NEXT_AGENT_KEY_HASH,
        "--migration-nonce",
        MIGRATION_NONCE,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  ).migration_hash;

  assert.equal(keyHash, AGENT_KEY_HASH);
  assert.equal(genesisHash, computeAgentGenesisHash(OWNER, keyHash, GENESIS_NONCE, METADATA_HASH));
  assert.equal(passportId, computeAgentPassportId(OWNER, keyHash, genesisHash));
  assert.equal(migrationHash, computeAgentMigrationHash(passportId, keyHash, NEXT_AGENT_KEY_HASH, MIGRATION_NONCE));
  assert(readFileSync(CLI, "utf8").includes("compute-agent-passport-id"));
});
