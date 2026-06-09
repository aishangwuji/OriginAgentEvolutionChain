import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getAddress, type Address } from "viem";
import { hashJson, type JsonValue } from "./canonical.ts";
import { collectPrivacyErrors } from "./evidence.ts";

export const MODULE_MANIFEST_SCHEMA_VERSION = "originagent.evolution.module_manifest.v1";
export const MODULE_ACQUISITION_RECEIPT_SCHEMA_VERSION = "originagent.evolution.module_acquisition_receipt.v1";
export const VERIFICATION_RUN_RECEIPT_SCHEMA_VERSION = "originagent.evolution.verification_run_receipt.v1";
export const COMMUNITY_WORK_CLAIM_SCHEMA_VERSION = "originagent.evolution.community_work_claim.v1";

export type DigestAlgorithm = "sha256" | "keccak256";
export type VerificationRunResult = "passed" | "failed" | "inconclusive";
export type CommunityWorkKind = "development" | "testing" | "audit" | "documentation" | "operation";

export interface ModuleManifest {
  schema_version: typeof MODULE_MANIFEST_SCHEMA_VERSION;
  module_id: string;
  module_name: string;
  version: string;
  storage_uri: string;
  storage_kind?: string;
  module_digest: string;
  digest_algorithm: DigestAlgorithm;
  responsible_address: Address;
  agent_passport_id?: string;
  source_repository_uri?: string;
  created_at: string;
  manifest_hash: string;
}

export interface ModuleAcquisitionReceipt {
  schema_version: typeof MODULE_ACQUISITION_RECEIPT_SCHEMA_VERSION;
  module_id: string;
  manifest_hash: string;
  storage_uri: string;
  downloaded_digest: string;
  expected_digest: string;
  hash_matched: boolean;
  acquired_by: Address;
  acquired_at: string;
  created_at: string;
  receipt_hash: string;
}

export interface VerificationRunReceipt {
  schema_version: typeof VERIFICATION_RUN_RECEIPT_SCHEMA_VERSION;
  module_id: string;
  manifest_hash: string;
  acquisition_receipt_hash: string;
  validator_address: Address;
  environment_hash: string;
  run_result: VerificationRunResult;
  log_uri: string;
  log_digest: string;
  started_at: string;
  completed_at: string;
  created_at: string;
  receipt_hash: string;
}

export interface CommunityWorkClaim {
  schema_version: typeof COMMUNITY_WORK_CLAIM_SCHEMA_VERSION;
  claim_id: string;
  responsible_address: Address;
  agent_passport_id?: string;
  work_kind: CommunityWorkKind;
  summary: string;
  proof_uri: string;
  proof_digest: string;
  artifact_hashes: string[];
  referenced_events?: string[];
  created_at: string;
  claim_hash: string;
}

export interface ModuleVerificationValidationResult {
  ok: boolean;
  errors: string[];
  computedHash: string;
}

export type VerificationEnvironment = Record<string, JsonValue>;

const DIGEST_ALGORITHMS = new Set<DigestAlgorithm>(["sha256", "keccak256"]);
const RUN_RESULTS = new Set<VerificationRunResult>(["passed", "failed", "inconclusive"]);
const WORK_KINDS = new Set<CommunityWorkKind>(["development", "testing", "audit", "documentation", "operation"]);
const HEX64_RE = /^[0-9a-f]{64}$/;
const BYTES32_RE = /^(?:0x)?[0-9a-fA-F]{64}$/;
const URL_QUERY_RE = /^[a-z][a-z0-9+.-]*:\/\/[^\s"'<>?]+\?[^\s"'<>]+/i;

const MANIFEST_REQUIRED_FIELDS = [
  "schema_version",
  "module_id",
  "module_name",
  "version",
  "storage_uri",
  "module_digest",
  "digest_algorithm",
  "responsible_address",
  "created_at",
  "manifest_hash",
];
const MANIFEST_OPTIONAL_FIELDS = new Set(["storage_kind", "agent_passport_id", "source_repository_uri"]);
const ACQUISITION_REQUIRED_FIELDS = [
  "schema_version",
  "module_id",
  "manifest_hash",
  "storage_uri",
  "downloaded_digest",
  "expected_digest",
  "hash_matched",
  "acquired_by",
  "acquired_at",
  "created_at",
  "receipt_hash",
];
const RUN_REQUIRED_FIELDS = [
  "schema_version",
  "module_id",
  "manifest_hash",
  "acquisition_receipt_hash",
  "validator_address",
  "environment_hash",
  "run_result",
  "log_uri",
  "log_digest",
  "started_at",
  "completed_at",
  "created_at",
  "receipt_hash",
];
const CLAIM_REQUIRED_FIELDS = [
  "schema_version",
  "claim_id",
  "responsible_address",
  "work_kind",
  "summary",
  "proof_uri",
  "proof_digest",
  "artifact_hashes",
  "created_at",
  "claim_hash",
];
const CLAIM_OPTIONAL_FIELDS = new Set(["agent_passport_id", "referenced_events"]);

export function createModuleManifest(
  input: Omit<ModuleManifest, "schema_version" | "responsible_address" | "manifest_hash"> & { responsible_address: string },
): ModuleManifest {
  const manifest: ModuleManifest = {
    schema_version: MODULE_MANIFEST_SCHEMA_VERSION,
    module_id: input.module_id,
    module_name: input.module_name,
    version: input.version,
    storage_uri: input.storage_uri,
    module_digest: input.module_digest,
    digest_algorithm: input.digest_algorithm,
    responsible_address: getAddress(input.responsible_address),
    created_at: input.created_at,
    manifest_hash: "",
  };
  if (input.storage_kind !== undefined) {
    manifest.storage_kind = input.storage_kind;
  }
  if (input.agent_passport_id !== undefined) {
    manifest.agent_passport_id = input.agent_passport_id;
  }
  if (input.source_repository_uri !== undefined) {
    manifest.source_repository_uri = input.source_repository_uri;
  }
  manifest.manifest_hash = hashModuleManifest(manifest);
  assertValid("module manifest", validateModuleManifest(manifest));
  return manifest;
}

export function createModuleAcquisitionReceipt(
  input: Omit<ModuleAcquisitionReceipt, "schema_version" | "acquired_by" | "receipt_hash"> & { acquired_by: string },
): ModuleAcquisitionReceipt {
  const receipt: ModuleAcquisitionReceipt = {
    schema_version: MODULE_ACQUISITION_RECEIPT_SCHEMA_VERSION,
    ...input,
    acquired_by: getAddress(input.acquired_by),
    receipt_hash: "",
  };
  receipt.receipt_hash = hashModuleAcquisitionReceipt(receipt);
  assertValid("module acquisition receipt", validateModuleAcquisitionReceipt(receipt));
  return receipt;
}

export function createVerificationRunReceipt(
  input: Omit<VerificationRunReceipt, "schema_version" | "validator_address" | "receipt_hash"> & { validator_address: string },
): VerificationRunReceipt {
  const receipt: VerificationRunReceipt = {
    schema_version: VERIFICATION_RUN_RECEIPT_SCHEMA_VERSION,
    ...input,
    validator_address: getAddress(input.validator_address),
    receipt_hash: "",
  };
  receipt.receipt_hash = hashVerificationRunReceipt(receipt);
  assertValid("verification run receipt", validateVerificationRunReceipt(receipt));
  return receipt;
}

export function createCommunityWorkClaim(
  input: Omit<CommunityWorkClaim, "schema_version" | "responsible_address" | "claim_hash"> & { responsible_address: string },
): CommunityWorkClaim {
  const claim: CommunityWorkClaim = {
    schema_version: COMMUNITY_WORK_CLAIM_SCHEMA_VERSION,
    claim_id: input.claim_id,
    responsible_address: getAddress(input.responsible_address),
    work_kind: input.work_kind,
    summary: input.summary,
    proof_uri: input.proof_uri,
    proof_digest: input.proof_digest,
    artifact_hashes: input.artifact_hashes,
    created_at: input.created_at,
    claim_hash: "",
  };
  if (input.agent_passport_id !== undefined) {
    claim.agent_passport_id = input.agent_passport_id;
  }
  if (input.referenced_events !== undefined) {
    claim.referenced_events = input.referenced_events;
  }
  claim.claim_hash = hashCommunityWorkClaim(claim);
  assertValid("community work claim", validateCommunityWorkClaim(claim));
  return claim;
}

export function readModuleManifest(path: string): ModuleManifest {
  return JSON.parse(readFileSync(path, "utf8")) as ModuleManifest;
}

export function readModuleAcquisitionReceipt(path: string): ModuleAcquisitionReceipt {
  return JSON.parse(readFileSync(path, "utf8")) as ModuleAcquisitionReceipt;
}

export function readVerificationRunReceipt(path: string): VerificationRunReceipt {
  return JSON.parse(readFileSync(path, "utf8")) as VerificationRunReceipt;
}

export function readCommunityWorkClaim(path: string): CommunityWorkClaim {
  return JSON.parse(readFileSync(path, "utf8")) as CommunityWorkClaim;
}

export function writeModuleManifest(manifest: ModuleManifest, path: string): ModuleManifest {
  assertValid("module manifest", validateModuleManifest(manifest));
  writeJson(path, manifest);
  return manifest;
}

export function writeModuleAcquisitionReceipt(receipt: ModuleAcquisitionReceipt, path: string): ModuleAcquisitionReceipt {
  assertValid("module acquisition receipt", validateModuleAcquisitionReceipt(receipt));
  writeJson(path, receipt);
  return receipt;
}

export function writeVerificationRunReceipt(receipt: VerificationRunReceipt, path: string): VerificationRunReceipt {
  assertValid("verification run receipt", validateVerificationRunReceipt(receipt));
  writeJson(path, receipt);
  return receipt;
}

export function writeCommunityWorkClaim(claim: CommunityWorkClaim, path: string): CommunityWorkClaim {
  assertValid("community work claim", validateCommunityWorkClaim(claim));
  writeJson(path, claim);
  return claim;
}

export function hashModuleManifest(manifest: Record<string, unknown>): string {
  return hashWithout(manifest, "manifest_hash");
}

export function hashModuleAcquisitionReceipt(receipt: Record<string, unknown>): string {
  return hashWithout(receipt, "receipt_hash");
}

export function hashVerificationRunReceipt(receipt: Record<string, unknown>): string {
  return hashWithout(receipt, "receipt_hash");
}

export function hashCommunityWorkClaim(claim: Record<string, unknown>): string {
  return hashWithout(claim, "claim_hash");
}

export function hashVerificationEnvironment(environment: VerificationEnvironment): string {
  return hashJson(environment);
}

export function validateModuleManifest(manifest: unknown): ModuleVerificationValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(manifest)) {
    return { ok: false, errors: ["module manifest must be an object"], computedHash: "" };
  }
  validateFields(manifest, MANIFEST_REQUIRED_FIELDS, MANIFEST_OPTIONAL_FIELDS, errors);
  if (manifest.schema_version !== MODULE_MANIFEST_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${MODULE_MANIFEST_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(manifest, "module_id", errors);
  validateNonEmptyString(manifest, "module_name", errors);
  validateNonEmptyString(manifest, "version", errors);
  validateUri(manifest, "storage_uri", errors);
  validateOptionalUri(manifest, "source_repository_uri", errors);
  validateOptionalNonEmptyString(manifest, "storage_kind", errors);
  validateHex64(manifest, ["module_digest", "manifest_hash"], errors);
  if (!DIGEST_ALGORITHMS.has(manifest.digest_algorithm as DigestAlgorithm)) {
    errors.push("digest_algorithm must be sha256 or keccak256");
  }
  validateAddress(manifest, "responsible_address", errors);
  validateOptionalBytes32(manifest, "agent_passport_id", errors);
  validateTimestamp(manifest, "created_at", errors);
  errors.push(...collectPrivacyErrors(manifest));
  return finishHashValidation(manifest, "manifest_hash", hashModuleManifest, errors);
}

export function validateModuleAcquisitionReceipt(receipt: unknown): ModuleVerificationValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(receipt)) {
    return { ok: false, errors: ["module acquisition receipt must be an object"], computedHash: "" };
  }
  validateFields(receipt, ACQUISITION_REQUIRED_FIELDS, undefined, errors);
  if (receipt.schema_version !== MODULE_ACQUISITION_RECEIPT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${MODULE_ACQUISITION_RECEIPT_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(receipt, "module_id", errors);
  validateUri(receipt, "storage_uri", errors);
  validateHex64(receipt, ["manifest_hash", "downloaded_digest", "expected_digest", "receipt_hash"], errors);
  if (typeof receipt.hash_matched !== "boolean") {
    errors.push("hash_matched must be boolean");
  }
  validateAddress(receipt, "acquired_by", errors);
  validateTimestamp(receipt, "acquired_at", errors);
  validateTimestamp(receipt, "created_at", errors);
  errors.push(...collectPrivacyErrors(receipt));
  return finishHashValidation(receipt, "receipt_hash", hashModuleAcquisitionReceipt, errors);
}

export function validateVerificationRunReceipt(receipt: unknown): ModuleVerificationValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(receipt)) {
    return { ok: false, errors: ["verification run receipt must be an object"], computedHash: "" };
  }
  validateFields(receipt, RUN_REQUIRED_FIELDS, undefined, errors);
  if (receipt.schema_version !== VERIFICATION_RUN_RECEIPT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${VERIFICATION_RUN_RECEIPT_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(receipt, "module_id", errors);
  validateHex64(receipt, ["manifest_hash", "acquisition_receipt_hash", "environment_hash", "log_digest", "receipt_hash"], errors);
  validateAddress(receipt, "validator_address", errors);
  if (!RUN_RESULTS.has(receipt.run_result as VerificationRunResult)) {
    errors.push("run_result must be passed, failed, or inconclusive");
  }
  validateUri(receipt, "log_uri", errors);
  validateTimestamp(receipt, "started_at", errors);
  validateTimestamp(receipt, "completed_at", errors);
  validateTimestamp(receipt, "created_at", errors);
  if (
    typeof receipt.started_at === "string" &&
    typeof receipt.completed_at === "string" &&
    Date.parse(receipt.completed_at) < Date.parse(receipt.started_at)
  ) {
    errors.push("completed_at must be greater than or equal to started_at");
  }
  errors.push(...collectPrivacyErrors(receipt));
  return finishHashValidation(receipt, "receipt_hash", hashVerificationRunReceipt, errors);
}

export function validateCommunityWorkClaim(claim: unknown): ModuleVerificationValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(claim)) {
    return { ok: false, errors: ["community work claim must be an object"], computedHash: "" };
  }
  validateFields(claim, CLAIM_REQUIRED_FIELDS, CLAIM_OPTIONAL_FIELDS, errors);
  if (claim.schema_version !== COMMUNITY_WORK_CLAIM_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${COMMUNITY_WORK_CLAIM_SCHEMA_VERSION}`);
  }
  validateNonEmptyString(claim, "claim_id", errors);
  validateAddress(claim, "responsible_address", errors);
  validateOptionalBytes32(claim, "agent_passport_id", errors);
  if (!WORK_KINDS.has(claim.work_kind as CommunityWorkKind)) {
    errors.push("work_kind must be development, testing, audit, documentation, or operation");
  }
  validateNonEmptyString(claim, "summary", errors);
  validateUri(claim, "proof_uri", errors);
  validateHex64(claim, ["proof_digest", "claim_hash"], errors);
  validateHashArray(claim, "artifact_hashes", 1, errors);
  validateOptionalStringArray(claim, "referenced_events", errors);
  validateTimestamp(claim, "created_at", errors);
  errors.push(...collectPrivacyErrors(claim));
  return finishHashValidation(claim, "claim_hash", hashCommunityWorkClaim, errors);
}

function validateFields(
  record: Record<string, unknown>,
  requiredFields: string[],
  optionalFields: Set<string> | undefined,
  errors: string[],
): void {
  for (const field of requiredFields) {
    if (!(field in record)) {
      errors.push(`missing field: ${field}`);
    }
  }
  for (const field of Object.keys(record)) {
    if (!requiredFields.includes(field) && !(optionalFields?.has(field) ?? false)) {
      errors.push(`unknown field: ${field}`);
    }
  }
}

function validateNonEmptyString(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (typeof record[field] !== "string" || record[field].length === 0) {
    errors.push(`${field} must be a non-empty string`);
  }
}

function validateOptionalNonEmptyString(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (record[field] !== undefined) {
    validateNonEmptyString(record, field, errors);
  }
}

function validateUri(record: Record<string, unknown>, field: string, errors: string[]): void {
  validateNonEmptyString(record, field, errors);
  const value = record[field];
  if (typeof value === "string" && URL_QUERY_RE.test(value)) {
    errors.push(`${field} must not contain a query string`);
  }
}

function validateOptionalUri(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (record[field] !== undefined) {
    validateUri(record, field, errors);
  }
}

function validateHex64(record: Record<string, unknown>, fields: string[], errors: string[]): void {
  for (const field of fields) {
    if (typeof record[field] !== "string" || !HEX64_RE.test(record[field])) {
      errors.push(`${field} must be a lowercase 64-character hex digest`);
    }
  }
}

function validateHashArray(record: Record<string, unknown>, field: string, minLength: number, errors: string[]): void {
  const value = record[field];
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return;
  }
  if (value.length < minLength) {
    errors.push(`${field} must contain at least ${minLength} item`);
  }
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || !HEX64_RE.test(item)) {
      errors.push(`${field}[${index}] must be a lowercase 64-character hex digest`);
      continue;
    }
    if (seen.has(item)) {
      errors.push(`${field}[${index}] duplicates ${item}`);
    }
    seen.add(item);
  }
}

function validateOptionalStringArray(record: Record<string, unknown>, field: string, errors: string[]): void {
  const value = record[field];
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return;
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.length === 0) {
      errors.push(`${field}[${index}] must be a non-empty string`);
    }
  }
}

function validateAddress(record: Record<string, unknown>, field: string, errors: string[]): void {
  const value = record[field];
  if (typeof value !== "string") {
    errors.push(`${field} must be an EVM address`);
    return;
  }
  try {
    getAddress(value);
  } catch {
    errors.push(`${field} must be an EVM address`);
  }
}

function validateOptionalBytes32(record: Record<string, unknown>, field: string, errors: string[]): void {
  const value = record[field];
  if (value !== undefined && (typeof value !== "string" || !BYTES32_RE.test(value))) {
    errors.push(`${field} must be a 32-byte hex value`);
  }
}

function validateTimestamp(record: Record<string, unknown>, field: string, errors: string[]): void {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${field} must be a non-empty string`);
    return;
  }
  if (Number.isNaN(Date.parse(value))) {
    errors.push(`${field} must be an ISO-compatible timestamp`);
  }
}

function finishHashValidation(
  record: Record<string, unknown>,
  hashField: "manifest_hash" | "receipt_hash" | "claim_hash",
  compute: (record: Record<string, unknown>) => string,
  errors: string[],
): ModuleVerificationValidationResult {
  let computedHash = "";
  if (errors.length === 0) {
    computedHash = compute(record);
    if (computedHash !== record[hashField]) {
      errors.push(`${hashField} mismatch`);
    }
  }
  return { ok: errors.length === 0, errors, computedHash };
}

function hashWithout(record: Record<string, unknown>, field: string): string {
  const payload = { ...record };
  delete payload[field];
  return hashJson(payload);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertValid(label: string, validation: ModuleVerificationValidationResult): void {
  if (!validation.ok) {
    throw new Error(`invalid ${label}: ${validation.errors.join("; ")}`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
