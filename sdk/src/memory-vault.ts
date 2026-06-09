import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { canonicalStringify } from "./canonical.ts";
import { collectPrivacyErrors } from "./evidence.ts";

export interface MemoryVaultFileSummary {
  path: string;
  sha256: string;
  size: number;
}

export interface MemoryVaultArtifact {
  schema_version: "originagent.evolution.memory_vault.v1";
  vault_digest: string;
  metadata: {
    passport_id: `0x${string}`;
    agent_key_hash: `0x${string}`;
    vault_nonce: `0x${string}`;
    created_at: string;
    source_ledger_terminal_hash: string;
    included_files: MemoryVaultFileSummary[];
    payload_digest: string;
    encrypted_payload_digest: string;
    encryption: {
      algorithm: "AES-256-GCM";
      nonce_b64: string;
    };
    [key: string]: unknown;
  };
  encrypted_payload_b64: string;
}

export interface MemoryVaultValidationResult {
  ok: boolean;
  errors: string[];
  vaultDigest: string;
}

const VAULT_SCHEMA_VERSION = "originagent.evolution.memory_vault.v1";
const VAULT_DIGEST_DOMAIN = "originagent.ec9.vault.v1";
const ENCRYPTION_ALGORITHM = "AES-256-GCM";
const ALLOWED_MEMORY_FILES = new Set([
  "SOUL.md",
  "USER.md",
  "memory/MEMORY.md",
  "memory/facts.jsonl",
  "memory/evolution_events.jsonl",
]);
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;

export function readMemoryVault(path: string): MemoryVaultArtifact {
  return JSON.parse(readFileSync(path, "utf8")) as MemoryVaultArtifact;
}

export function validateMemoryVault(vault: unknown): MemoryVaultValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(vault)) {
    return { ok: false, errors: ["memory vault must be an object"], vaultDigest: "" };
  }
  if (vault.schema_version !== VAULT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${VAULT_SCHEMA_VERSION}`);
  }
  const metadata = vault.metadata;
  if (!isPlainObject(metadata)) {
    errors.push("metadata must be an object");
    return { ok: false, errors, vaultDigest: stringValue(vault.vault_digest) };
  }
  for (const field of [
    "passport_id",
    "agent_key_hash",
    "vault_nonce",
    "created_at",
    "source_ledger_terminal_hash",
    "included_files",
    "payload_digest",
    "encrypted_payload_digest",
    "encryption",
  ]) {
    if (!(field in metadata)) {
      errors.push(`missing metadata.${field}`);
    }
  }
  for (const field of ["passport_id", "agent_key_hash", "vault_nonce"]) {
    if (typeof metadata[field] !== "string" || !BYTES32_RE.test(metadata[field] as string)) {
      errors.push(`metadata.${field} must be 0x-prefixed bytes32`);
    }
  }
  for (const field of ["payload_digest", "encrypted_payload_digest"]) {
    if (typeof metadata[field] !== "string" || !HEX64_RE.test(metadata[field] as string)) {
      errors.push(`metadata.${field} must be lowercase sha256 hex`);
    }
  }
  if (
    metadata.source_ledger_terminal_hash !== "" &&
    (typeof metadata.source_ledger_terminal_hash !== "string" || !HEX64_RE.test(metadata.source_ledger_terminal_hash))
  ) {
    errors.push("metadata.source_ledger_terminal_hash must be empty or lowercase sha256 hex");
  }
  validateIncludedFiles(metadata.included_files, errors);
  validateEncryption(metadata.encryption, errors);
  const encryptedPayload = decodeBase64Url(stringValue(vault.encrypted_payload_b64), "encrypted_payload_b64", errors);
  if (encryptedPayload && metadata.encrypted_payload_digest !== sha256(encryptedPayload)) {
    errors.push("encrypted_payload_digest mismatch");
  }
  if (typeof vault.vault_digest !== "string" || !HEX64_RE.test(vault.vault_digest)) {
    errors.push("vault_digest must be lowercase sha256 hex");
  } else if (errors.length === 0) {
    const expected = computeMemoryVaultDigest(metadata, metadata.encrypted_payload_digest as string);
    if (vault.vault_digest !== expected) {
      errors.push("vault_digest mismatch");
    }
  }
  errors.push(...collectPrivacyErrors({ schema_version: vault.schema_version, vault_digest: vault.vault_digest, metadata }));
  return {
    ok: errors.length === 0,
    errors,
    vaultDigest: typeof vault.vault_digest === "string" ? vault.vault_digest : "",
  };
}

export function computeMemoryVaultDigest(metadata: unknown, encryptedPayloadDigest: string): string {
  const metadataDigest = sha256(Buffer.from(canonicalStringify(metadata), "utf8"));
  return sha256(
    Buffer.concat([
      Buffer.from(VAULT_DIGEST_DOMAIN, "utf8"),
      Buffer.from(metadataDigest, "hex"),
      Buffer.from(encryptedPayloadDigest, "hex"),
    ]),
  );
}

function validateIncludedFiles(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("metadata.included_files must be a list");
    return;
  }
  for (const item of value) {
    if (
      !isPlainObject(item) ||
      typeof item.path !== "string" ||
      !ALLOWED_MEMORY_FILES.has(item.path) ||
      typeof item.sha256 !== "string" ||
      !HEX64_RE.test(item.sha256) ||
      !Number.isInteger(item.size) ||
      item.size < 0
    ) {
      errors.push("metadata.included_files entries must contain allowed path, sha256, and size");
      return;
    }
  }
}

function validateEncryption(value: unknown, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push("metadata.encryption must be an object");
    return;
  }
  if (value.algorithm !== ENCRYPTION_ALGORITHM) {
    errors.push(`metadata.encryption.algorithm must be ${ENCRYPTION_ALGORITHM}`);
  }
  const nonce = decodeBase64Url(stringValue(value.nonce_b64), "metadata.encryption.nonce_b64", errors);
  if (nonce && nonce.length !== 12) {
    errors.push("metadata.encryption.nonce_b64 must decode to 12 bytes");
  }
}

function decodeBase64Url(value: string, field: string, errors: string[]): Buffer | undefined {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    errors.push(`${field} must be base64url data`);
    return undefined;
  }
}

function sha256(value: Buffer | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
