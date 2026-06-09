import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { encodeAbiParameters, getAddress, keccak256, type Address, type Hex } from "viem";
import { sha256Hex, toBytes32 } from "./canonical.ts";
import { collectPrivacyErrors } from "./evidence.ts";

export interface AgentPassportRecord {
  schema_version: "originagent.evolution.agent_passport_record.v1";
  passport_id: Hex;
  owner: Address;
  agent_key_hash: Hex;
  genesis_nonce: Hex;
  genesis_hash: Hex;
  metadata_hash: Hex;
}

export interface AgentMigrationRecord {
  schema_version: "originagent.evolution.agent_migration_record.v1";
  passport_id: Hex;
  owner: Address;
  old_agent_key_hash: Hex;
  new_agent_key_hash: Hex;
  migration_nonce: Hex;
  migration_hash: Hex;
}

export interface PassportValidationResult {
  ok: boolean;
  errors: string[];
  computedHash: string;
}

const PASSPORT_REQUIRED_FIELDS = [
  "schema_version",
  "passport_id",
  "owner",
  "agent_key_hash",
  "genesis_nonce",
  "genesis_hash",
  "metadata_hash",
];
const MIGRATION_REQUIRED_FIELDS = [
  "schema_version",
  "passport_id",
  "owner",
  "old_agent_key_hash",
  "new_agent_key_hash",
  "migration_nonce",
  "migration_hash",
];
const BYTES32_RE = /^(?:0x)?[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as const;

export function computeAgentKeyHash(publicKey: string): Hex {
  const key = toBytes32(publicKey, "public-key");
  return `0x${sha256Hex(Buffer.from(key.slice(2), "hex"))}`;
}

export function computeAgentGenesisHash(
  owner: string,
  agentKeyHash: string,
  genesisNonce: string,
  metadataHash: string,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
      [
        getAddress(owner),
        toBytes32(agentKeyHash, "agent_key_hash"),
        toBytes32(genesisNonce, "genesis_nonce"),
        toBytes32(metadataHash, "metadata_hash"),
      ],
    ),
  );
}

export function computeAgentPassportId(owner: string, agentKeyHash: string, genesisHash: string): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }, { type: "bytes32" }],
      [getAddress(owner), toBytes32(agentKeyHash, "agent_key_hash"), toBytes32(genesisHash, "genesis_hash")],
    ),
  );
}

export function computeAgentMigrationHash(
  passportId: string,
  oldAgentKeyHash: string,
  newAgentKeyHash: string,
  migrationNonce: string,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
      [
        toBytes32(passportId, "passport_id"),
        toBytes32(oldAgentKeyHash, "old_agent_key_hash"),
        toBytes32(newAgentKeyHash, "new_agent_key_hash"),
        toBytes32(migrationNonce, "migration_nonce"),
      ],
    ),
  );
}

export function createAgentPassportRecord(input: {
  owner: string;
  agentKeyHash: string;
  genesisNonce: string;
  metadataHash: string;
}): AgentPassportRecord {
  const owner = getAddress(input.owner);
  const agentKeyHash = toBytes32(input.agentKeyHash, "agent_key_hash");
  const genesisNonce = toBytes32(input.genesisNonce, "genesis_nonce");
  const metadataHash = toBytes32(input.metadataHash, "metadata_hash");
  const genesisHash = computeAgentGenesisHash(owner, agentKeyHash, genesisNonce, metadataHash);
  const record: AgentPassportRecord = {
    schema_version: "originagent.evolution.agent_passport_record.v1",
    passport_id: computeAgentPassportId(owner, agentKeyHash, genesisHash),
    owner,
    agent_key_hash: agentKeyHash,
    genesis_nonce: genesisNonce,
    genesis_hash: genesisHash,
    metadata_hash: metadataHash,
  };
  const validation = validateAgentPassportRecord(record);
  if (!validation.ok) {
    throw new Error(`invalid agent passport record: ${validation.errors.join("; ")}`);
  }
  return record;
}

export function createAgentMigrationRecord(input: {
  passportId: string;
  owner: string;
  oldAgentKeyHash: string;
  newAgentKeyHash: string;
  migrationNonce: string;
}): AgentMigrationRecord {
  const record: AgentMigrationRecord = {
    schema_version: "originagent.evolution.agent_migration_record.v1",
    passport_id: toBytes32(input.passportId, "passport_id"),
    owner: getAddress(input.owner),
    old_agent_key_hash: toBytes32(input.oldAgentKeyHash, "old_agent_key_hash"),
    new_agent_key_hash: toBytes32(input.newAgentKeyHash, "new_agent_key_hash"),
    migration_nonce: toBytes32(input.migrationNonce, "migration_nonce"),
    migration_hash: computeAgentMigrationHash(
      input.passportId,
      input.oldAgentKeyHash,
      input.newAgentKeyHash,
      input.migrationNonce,
    ),
  };
  const validation = validateAgentMigrationRecord(record);
  if (!validation.ok) {
    throw new Error(`invalid agent migration record: ${validation.errors.join("; ")}`);
  }
  return record;
}

export function readAgentPassportRecord(path: string): AgentPassportRecord {
  return JSON.parse(readFileSync(path, "utf8")) as AgentPassportRecord;
}

export function readAgentMigrationRecord(path: string): AgentMigrationRecord {
  return JSON.parse(readFileSync(path, "utf8")) as AgentMigrationRecord;
}

export function writeAgentPassportRecord(record: AgentPassportRecord, path: string): AgentPassportRecord {
  const validation = validateAgentPassportRecord(record);
  if (!validation.ok) {
    throw new Error(`invalid agent passport record: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export function writeAgentMigrationRecord(record: AgentMigrationRecord, path: string): AgentMigrationRecord {
  const validation = validateAgentMigrationRecord(record);
  if (!validation.ok) {
    throw new Error(`invalid agent migration record: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export function validateAgentPassportRecord(record: unknown): PassportValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(record)) {
    return { ok: false, errors: ["agent passport record must be an object"], computedHash: "" };
  }
  validateFields(record, PASSPORT_REQUIRED_FIELDS, errors);
  if (record.schema_version !== "originagent.evolution.agent_passport_record.v1") {
    errors.push("schema_version must be originagent.evolution.agent_passport_record.v1");
  }
  validateAddress(record, "owner", errors);
  validateBytes32Fields(record, ["passport_id", "agent_key_hash", "genesis_nonce", "genesis_hash", "metadata_hash"], errors);
  rejectZero(record, ["agent_key_hash", "genesis_nonce", "genesis_hash"], errors);
  if (errors.length === 0) {
    const genesisHash = computeAgentGenesisHash(
      record.owner as string,
      record.agent_key_hash as string,
      record.genesis_nonce as string,
      record.metadata_hash as string,
    );
    const passportId = computeAgentPassportId(record.owner as string, record.agent_key_hash as string, genesisHash);
    if (toBytes32(record.genesis_hash as string, "genesis_hash") !== genesisHash) {
      errors.push("genesis_hash mismatch");
    }
    if (toBytes32(record.passport_id as string, "passport_id") !== passportId) {
      errors.push("passport_id mismatch");
    }
  }
  errors.push(...collectPrivacyErrors(record));
  const computedHash =
    typeof record.passport_id === "string" && BYTES32_RE.test(record.passport_id)
      ? toBytes32(record.passport_id, "passport_id")
      : "";
  return { ok: errors.length === 0, errors, computedHash };
}

export function validateAgentMigrationRecord(record: unknown): PassportValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(record)) {
    return { ok: false, errors: ["agent migration record must be an object"], computedHash: "" };
  }
  validateFields(record, MIGRATION_REQUIRED_FIELDS, errors);
  if (record.schema_version !== "originagent.evolution.agent_migration_record.v1") {
    errors.push("schema_version must be originagent.evolution.agent_migration_record.v1");
  }
  validateAddress(record, "owner", errors);
  validateBytes32Fields(
    record,
    ["passport_id", "old_agent_key_hash", "new_agent_key_hash", "migration_nonce", "migration_hash"],
    errors,
  );
  rejectZero(record, ["passport_id", "old_agent_key_hash", "new_agent_key_hash", "migration_nonce", "migration_hash"], errors);
  if (
    typeof record.old_agent_key_hash === "string" &&
    typeof record.new_agent_key_hash === "string" &&
    BYTES32_RE.test(record.old_agent_key_hash) &&
    BYTES32_RE.test(record.new_agent_key_hash) &&
    toBytes32(record.old_agent_key_hash, "old_agent_key_hash") === toBytes32(record.new_agent_key_hash, "new_agent_key_hash")
  ) {
    errors.push("new_agent_key_hash must differ from old_agent_key_hash");
  }
  if (errors.length === 0) {
    const migrationHash = computeAgentMigrationHash(
      record.passport_id as string,
      record.old_agent_key_hash as string,
      record.new_agent_key_hash as string,
      record.migration_nonce as string,
    );
    if (toBytes32(record.migration_hash as string, "migration_hash") !== migrationHash) {
      errors.push("migration_hash mismatch");
    }
  }
  errors.push(...collectPrivacyErrors(record));
  const computedHash =
    typeof record.migration_hash === "string" && BYTES32_RE.test(record.migration_hash)
      ? toBytes32(record.migration_hash, "migration_hash")
      : "";
  return { ok: errors.length === 0, errors, computedHash };
}

function validateFields(record: Record<string, unknown>, requiredFields: string[], errors: string[]): void {
  for (const field of requiredFields) {
    if (!(field in record)) {
      errors.push(`missing field: ${field}`);
    }
  }
  for (const field of Object.keys(record)) {
    if (!requiredFields.includes(field)) {
      errors.push(`unknown field: ${field}`);
    }
  }
}

function validateAddress(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (typeof record[field] !== "string" || !ADDRESS_RE.test(record[field])) {
    errors.push(`${field} must be an EVM address`);
  }
}

function validateBytes32Fields(record: Record<string, unknown>, fields: string[], errors: string[]): void {
  for (const field of fields) {
    if (typeof record[field] !== "string" || !BYTES32_RE.test(record[field])) {
      errors.push(`${field} must be a 32-byte hex value`);
    }
  }
}

function rejectZero(record: Record<string, unknown>, fields: string[], errors: string[]): void {
  for (const field of fields) {
    if (typeof record[field] === "string" && BYTES32_RE.test(record[field]) && toBytes32(record[field], field) === ZERO_BYTES32) {
      errors.push(`${field} must not be zero`);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
