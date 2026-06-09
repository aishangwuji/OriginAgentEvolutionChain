import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { encodeAbiParameters, getAddress, keccak256, type Address, type Hex } from "viem";
import { hashJson, toBytes32 } from "./canonical.ts";
import { collectPrivacyErrors } from "./evidence.ts";

export type AdjudicationReportPhase = "finalized" | "expired_no_quorum";

export interface ChallengeResponse {
  schema_version: "originagent.evolution.challenge_response.v1";
  challenge_id: Hex;
  evidence_id: Hex;
  respondent: Address;
  response_hash: Hex;
  created_at: string;
  record_hash: string;
}

export interface ValidatorVerdict {
  schema_version: "originagent.evolution.validator_verdict.v1";
  challenge_id: Hex;
  validator: Address;
  claimed_upheld: boolean;
  verdict_hash: Hex;
  method_hash: Hex;
  created_at: string;
  record_hash: string;
}

export interface ValidatorVerdictCommitment {
  schema_version: "originagent.evolution.validator_verdict_commitment.v1";
  challenge_id: Hex;
  validator: Address;
  commitment_hash: Hex;
  created_at: string;
  record_hash: string;
}

export interface ValidatorVerdictReveal {
  schema_version: "originagent.evolution.validator_verdict_reveal.v1";
  challenge_id: Hex;
  validator: Address;
  claimed_upheld: boolean;
  verdict_hash: Hex;
  method_hash: Hex;
  salt: Hex;
  commitment_hash: Hex;
  created_at: string;
  record_hash: string;
}

export interface AdjudicationReportV1 {
  schema_version: "originagent.evolution.adjudication_report.v1";
  challenge_id: Hex;
  claimed_upheld: boolean;
  final_report_hash: Hex;
  quorum: number;
  effective_verdict_count: number;
  response_hashes: Hex[];
  verdict_hashes: Hex[];
  finalized_at: string;
  report_hash: string;
}

export interface AdjudicationReportV2 {
  schema_version: "originagent.evolution.adjudication_report.v2";
  challenge_id: Hex;
  phase: AdjudicationReportPhase;
  claimed_upheld: boolean | null;
  final_report_hash: Hex | null;
  expiration_report_hash: Hex | null;
  quorum: number;
  effective_verdict_count: number;
  response_hashes: Hex[];
  commitment_hashes: Hex[];
  revealed_verdict_hashes: Hex[];
  unrevealed_commitment_count: number;
  response_by: string;
  commit_by: string;
  reveal_by: string;
  finalized_at: string | null;
  expired_at: string | null;
  report_hash: string;
}

export type AdjudicationReport = AdjudicationReportV1 | AdjudicationReportV2;

export interface AdjudicationValidationResult {
  ok: boolean;
  errors: string[];
  computedHash: string;
  reportHash: string;
}

const RESPONSE_SCHEMA_VERSION = "originagent.evolution.challenge_response.v1";
const VERDICT_SCHEMA_VERSION = "originagent.evolution.validator_verdict.v1";
const COMMITMENT_SCHEMA_VERSION = "originagent.evolution.validator_verdict_commitment.v1";
const REVEAL_SCHEMA_VERSION = "originagent.evolution.validator_verdict_reveal.v1";
const REPORT_V1_SCHEMA_VERSION = "originagent.evolution.adjudication_report.v1";
const REPORT_V2_SCHEMA_VERSION = "originagent.evolution.adjudication_report.v2";
const RESPONSE_REQUIRED_FIELDS = [
  "schema_version",
  "challenge_id",
  "evidence_id",
  "respondent",
  "response_hash",
  "created_at",
  "record_hash",
];
const COMMITMENT_REQUIRED_FIELDS = [
  "schema_version",
  "challenge_id",
  "validator",
  "commitment_hash",
  "created_at",
  "record_hash",
];
const VERDICT_REQUIRED_FIELDS = [
  "schema_version",
  "challenge_id",
  "validator",
  "claimed_upheld",
  "verdict_hash",
  "method_hash",
  "created_at",
  "record_hash",
];
const REVEAL_REQUIRED_FIELDS = [
  "schema_version",
  "challenge_id",
  "validator",
  "claimed_upheld",
  "verdict_hash",
  "method_hash",
  "salt",
  "commitment_hash",
  "created_at",
  "record_hash",
];
const REPORT_V1_REQUIRED_FIELDS = [
  "schema_version",
  "challenge_id",
  "claimed_upheld",
  "final_report_hash",
  "quorum",
  "effective_verdict_count",
  "response_hashes",
  "verdict_hashes",
  "finalized_at",
  "report_hash",
];
const REPORT_V2_REQUIRED_FIELDS = [
  "schema_version",
  "challenge_id",
  "phase",
  "claimed_upheld",
  "final_report_hash",
  "expiration_report_hash",
  "quorum",
  "effective_verdict_count",
  "response_hashes",
  "commitment_hashes",
  "revealed_verdict_hashes",
  "unrevealed_commitment_count",
  "response_by",
  "commit_by",
  "reveal_by",
  "finalized_at",
  "expired_at",
  "report_hash",
];
const HEX64_RE = /^[0-9a-f]{64}$/;
const BYTES32_RE = /^(?:0x)?[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as const;

export function createChallengeResponse(input: {
  challengeId: string;
  evidenceId: string;
  respondent: string;
  responseHash: string;
  createdAt: string;
}): ChallengeResponse {
  const response: ChallengeResponse = {
    schema_version: RESPONSE_SCHEMA_VERSION,
    challenge_id: toBytes32(input.challengeId, "challenge_id"),
    evidence_id: toBytes32(input.evidenceId, "evidence_id"),
    respondent: getAddress(input.respondent),
    response_hash: toBytes32(input.responseHash, "response_hash"),
    created_at: input.createdAt,
    record_hash: "",
  };
  response.record_hash = computeChallengeResponseHash(response);
  assertValid("challenge response", validateChallengeResponse(response));
  return response;
}

export function createValidatorVerdict(input: {
  challengeId: string;
  validator: string;
  claimedUpheld: boolean;
  verdictHash: string;
  methodHash: string;
  createdAt: string;
}): ValidatorVerdict {
  const verdict: ValidatorVerdict = {
    schema_version: VERDICT_SCHEMA_VERSION,
    challenge_id: toBytes32(input.challengeId, "challenge_id"),
    validator: getAddress(input.validator),
    claimed_upheld: input.claimedUpheld,
    verdict_hash: toBytes32(input.verdictHash, "verdict_hash"),
    method_hash: toBytes32(input.methodHash, "method_hash"),
    created_at: input.createdAt,
    record_hash: "",
  };
  verdict.record_hash = computeValidatorVerdictHash(verdict);
  assertValid("validator verdict", validateValidatorVerdict(verdict));
  return verdict;
}

export function createValidatorVerdictCommitment(input: {
  challengeId: string;
  validator: string;
  commitmentHash: string;
  createdAt: string;
}): ValidatorVerdictCommitment {
  const commitment: ValidatorVerdictCommitment = {
    schema_version: COMMITMENT_SCHEMA_VERSION,
    challenge_id: toBytes32(input.challengeId, "challenge_id"),
    validator: getAddress(input.validator),
    commitment_hash: toBytes32(input.commitmentHash, "commitment_hash"),
    created_at: input.createdAt,
    record_hash: "",
  };
  commitment.record_hash = computeValidatorVerdictCommitmentRecordHash(commitment);
  assertValid("validator verdict commitment", validateValidatorVerdictCommitment(commitment));
  return commitment;
}

export function createValidatorVerdictReveal(input: {
  challengeId: string;
  validator: string;
  claimedUpheld: boolean;
  verdictHash: string;
  methodHash: string;
  salt: string;
  createdAt: string;
}): ValidatorVerdictReveal {
  const reveal: ValidatorVerdictReveal = {
    schema_version: REVEAL_SCHEMA_VERSION,
    challenge_id: toBytes32(input.challengeId, "challenge_id"),
    validator: getAddress(input.validator),
    claimed_upheld: input.claimedUpheld,
    verdict_hash: toBytes32(input.verdictHash, "verdict_hash"),
    method_hash: toBytes32(input.methodHash, "method_hash"),
    salt: toBytes32(input.salt, "salt"),
    commitment_hash: computeVerdictCommitmentHash({
      challengeId: input.challengeId,
      validator: input.validator,
      claimedUpheld: input.claimedUpheld,
      verdictHash: input.verdictHash,
      methodHash: input.methodHash,
      salt: input.salt,
    }),
    created_at: input.createdAt,
    record_hash: "",
  };
  reveal.record_hash = computeValidatorVerdictRevealHash(reveal);
  assertValid("validator verdict reveal", validateValidatorVerdictReveal(reveal));
  return reveal;
}

type CreateAdjudicationReportV1Input = {
  challengeId: string;
  claimedUpheld: boolean;
  finalReportHash: string;
  quorum: number;
  effectiveVerdictCount: number;
  responseHashes?: string[];
  verdictHashes: string[];
  finalizedAt: string;
};

type CreateAdjudicationReportV2Input = {
  challengeId: string;
  phase: AdjudicationReportPhase;
  claimedUpheld?: boolean;
  finalReportHash?: string;
  expirationReportHash?: string;
  quorum: number;
  effectiveVerdictCount: number;
  responseHashes?: string[];
  commitmentHashes: string[];
  revealedVerdictHashes: string[];
  unrevealedCommitmentCount: number;
  responseBy: string;
  commitBy: string;
  revealBy: string;
  finalizedAt?: string;
  expiredAt?: string;
};

export function createAdjudicationReport(input: CreateAdjudicationReportV1Input): AdjudicationReportV1;
export function createAdjudicationReport(input: CreateAdjudicationReportV2Input): AdjudicationReportV2;
export function createAdjudicationReport(
  input: CreateAdjudicationReportV1Input | CreateAdjudicationReportV2Input,
): AdjudicationReport {
  if ("phase" in input) {
    return createAdjudicationReportV2(input);
  }
  const report: AdjudicationReportV1 = {
    schema_version: REPORT_V1_SCHEMA_VERSION,
    challenge_id: toBytes32(input.challengeId, "challenge_id"),
    claimed_upheld: input.claimedUpheld,
    final_report_hash: toBytes32(input.finalReportHash, "final_report_hash"),
    quorum: input.quorum,
    effective_verdict_count: input.effectiveVerdictCount,
    response_hashes: (input.responseHashes ?? []).map((hash) => toBytes32(hash, "response_hash")),
    verdict_hashes: input.verdictHashes.map((hash) => toBytes32(hash, "verdict_hash")),
    finalized_at: input.finalizedAt,
    report_hash: "",
  };
  report.report_hash = computeAdjudicationReportHash(report);
  assertValid("adjudication report", validateAdjudicationReport(report));
  return report;
}

function createAdjudicationReportV2(input: CreateAdjudicationReportV2Input): AdjudicationReportV2 {
  const report: AdjudicationReportV2 = {
    schema_version: REPORT_V2_SCHEMA_VERSION,
    challenge_id: toBytes32(input.challengeId, "challenge_id"),
    phase: input.phase,
    claimed_upheld: input.phase === "finalized" ? input.claimedUpheld ?? null : null,
    final_report_hash: input.phase === "finalized" ? toBytes32(input.finalReportHash ?? "", "final_report_hash") : null,
    expiration_report_hash: input.phase === "expired_no_quorum"
      ? toBytes32(input.expirationReportHash ?? "", "expiration_report_hash")
      : null,
    quorum: input.quorum,
    effective_verdict_count: input.effectiveVerdictCount,
    response_hashes: (input.responseHashes ?? []).map((hash) => toBytes32(hash, "response_hash")),
    commitment_hashes: input.commitmentHashes.map((hash) => toBytes32(hash, "commitment_hash")),
    revealed_verdict_hashes: input.revealedVerdictHashes.map((hash) => toBytes32(hash, "verdict_hash")),
    unrevealed_commitment_count: input.unrevealedCommitmentCount,
    response_by: input.responseBy,
    commit_by: input.commitBy,
    reveal_by: input.revealBy,
    finalized_at: input.phase === "finalized" ? input.finalizedAt ?? null : null,
    expired_at: input.phase === "expired_no_quorum" ? input.expiredAt ?? null : null,
    report_hash: "",
  };
  report.report_hash = computeAdjudicationReportHash(report);
  assertValid("adjudication report", validateAdjudicationReport(report));
  return report;
}

export function readChallengeResponse(path: string): ChallengeResponse {
  return JSON.parse(readFileSync(path, "utf8")) as ChallengeResponse;
}

export function readValidatorVerdict(path: string): ValidatorVerdict {
  return JSON.parse(readFileSync(path, "utf8")) as ValidatorVerdict;
}

export function readValidatorVerdictCommitment(path: string): ValidatorVerdictCommitment {
  return JSON.parse(readFileSync(path, "utf8")) as ValidatorVerdictCommitment;
}

export function readValidatorVerdictReveal(path: string): ValidatorVerdictReveal {
  return JSON.parse(readFileSync(path, "utf8")) as ValidatorVerdictReveal;
}

export function readAdjudicationReport(path: string): AdjudicationReport {
  return JSON.parse(readFileSync(path, "utf8")) as AdjudicationReport;
}

export function writeChallengeResponse(response: ChallengeResponse, path: string): ChallengeResponse {
  assertValid("challenge response", validateChallengeResponse(response));
  writeJson(path, response);
  return response;
}

export function writeValidatorVerdict(verdict: ValidatorVerdict, path: string): ValidatorVerdict {
  assertValid("validator verdict", validateValidatorVerdict(verdict));
  writeJson(path, verdict);
  return verdict;
}

export function writeValidatorVerdictCommitment(
  commitment: ValidatorVerdictCommitment,
  path: string,
): ValidatorVerdictCommitment {
  assertValid("validator verdict commitment", validateValidatorVerdictCommitment(commitment));
  writeJson(path, commitment);
  return commitment;
}

export function writeValidatorVerdictReveal(reveal: ValidatorVerdictReveal, path: string): ValidatorVerdictReveal {
  assertValid("validator verdict reveal", validateValidatorVerdictReveal(reveal));
  writeJson(path, reveal);
  return reveal;
}

export function writeAdjudicationReport(report: AdjudicationReport, path: string): AdjudicationReport {
  assertValid("adjudication report", validateAdjudicationReport(report));
  writeJson(path, report);
  return report;
}

export function computeVerdictCommitmentHash(input: {
  challengeId: string;
  validator: string;
  claimedUpheld: boolean;
  verdictHash: string;
  methodHash: string;
  salt: string;
}): Hex {
  return keccak256(encodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "address" },
      { type: "bool" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "bytes32" },
    ],
    [
      toBytes32(input.challengeId, "challenge_id"),
      getAddress(input.validator),
      input.claimedUpheld,
      toBytes32(input.verdictHash, "verdict_hash"),
      toBytes32(input.methodHash, "method_hash"),
      toBytes32(input.salt, "salt"),
    ],
  ));
}

export function computeChallengeResponseHash(response: Record<string, unknown>): string {
  return hashWithout(response, "record_hash");
}

export function computeValidatorVerdictHash(verdict: Record<string, unknown>): string {
  return hashWithout(verdict, "record_hash");
}

export function computeValidatorVerdictCommitmentRecordHash(commitment: Record<string, unknown>): string {
  return hashWithout(commitment, "record_hash");
}

export function computeValidatorVerdictRevealHash(reveal: Record<string, unknown>): string {
  return hashWithout(reveal, "record_hash");
}

export function computeAdjudicationReportHash(report: Record<string, unknown>): string {
  return hashWithout(report, "report_hash");
}

export function validateChallengeResponse(response: unknown): AdjudicationValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(response)) {
    return { ok: false, errors: ["challenge response must be an object"], computedHash: "", reportHash: "" };
  }
  validateFields(response, RESPONSE_REQUIRED_FIELDS, errors);
  if (response.schema_version !== RESPONSE_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${RESPONSE_SCHEMA_VERSION}`);
  }
  validateBytes32(response, ["challenge_id", "evidence_id", "response_hash"], errors);
  validateAddress(response, "respondent", errors);
  validateTimestamp(response, "created_at", errors);
  validateHex64(response, "record_hash", errors);
  errors.push(...collectPrivacyErrors(response));
  return finishHashValidation(response, "record_hash", computeChallengeResponseHash, errors);
}

export function validateValidatorVerdict(verdict: unknown): AdjudicationValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(verdict)) {
    return { ok: false, errors: ["validator verdict must be an object"], computedHash: "", reportHash: "" };
  }
  validateFields(verdict, VERDICT_REQUIRED_FIELDS, errors);
  if (verdict.schema_version !== VERDICT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${VERDICT_SCHEMA_VERSION}`);
  }
  validateBytes32(verdict, ["challenge_id", "verdict_hash", "method_hash"], errors);
  validateAddress(verdict, "validator", errors);
  if (typeof verdict.claimed_upheld !== "boolean") {
    errors.push("claimed_upheld must be boolean");
  }
  validateTimestamp(verdict, "created_at", errors);
  validateHex64(verdict, "record_hash", errors);
  errors.push(...collectPrivacyErrors(verdict));
  return finishHashValidation(verdict, "record_hash", computeValidatorVerdictHash, errors);
}

export function validateValidatorVerdictCommitment(commitment: unknown): AdjudicationValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(commitment)) {
    return { ok: false, errors: ["validator verdict commitment must be an object"], computedHash: "", reportHash: "" };
  }
  validateFields(commitment, COMMITMENT_REQUIRED_FIELDS, errors);
  if (commitment.schema_version !== COMMITMENT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${COMMITMENT_SCHEMA_VERSION}`);
  }
  validateBytes32(commitment, ["challenge_id", "commitment_hash"], errors);
  validateAddress(commitment, "validator", errors);
  validateTimestamp(commitment, "created_at", errors);
  validateHex64(commitment, "record_hash", errors);
  errors.push(...collectPrivacyErrors(commitment));
  return finishHashValidation(commitment, "record_hash", computeValidatorVerdictCommitmentRecordHash, errors);
}

export function validateValidatorVerdictReveal(reveal: unknown): AdjudicationValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(reveal)) {
    return { ok: false, errors: ["validator verdict reveal must be an object"], computedHash: "", reportHash: "" };
  }
  validateFields(reveal, REVEAL_REQUIRED_FIELDS, errors);
  if (reveal.schema_version !== REVEAL_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${REVEAL_SCHEMA_VERSION}`);
  }
  validateBytes32(reveal, ["challenge_id", "verdict_hash", "method_hash", "salt", "commitment_hash"], errors);
  validateAddress(reveal, "validator", errors);
  if (typeof reveal.claimed_upheld !== "boolean") {
    errors.push("claimed_upheld must be boolean");
  }
  validateTimestamp(reveal, "created_at", errors);
  validateHex64(reveal, "record_hash", errors);
  if (errors.length === 0) {
    const expected = computeVerdictCommitmentHash({
      challengeId: reveal.challenge_id as string,
      validator: reveal.validator as string,
      claimedUpheld: reveal.claimed_upheld as boolean,
      verdictHash: reveal.verdict_hash as string,
      methodHash: reveal.method_hash as string,
      salt: reveal.salt as string,
    });
    if (expected !== reveal.commitment_hash) {
      errors.push("commitment_hash mismatch");
    }
  }
  errors.push(...collectPrivacyErrors(reveal));
  return finishHashValidation(reveal, "record_hash", computeValidatorVerdictRevealHash, errors);
}

export function validateAdjudicationReport(report: unknown): AdjudicationValidationResult {
  if (!isPlainObject(report)) {
    return { ok: false, errors: ["adjudication report must be an object"], computedHash: "", reportHash: "" };
  }
  if (report.schema_version === REPORT_V1_SCHEMA_VERSION) {
    return validateAdjudicationReportV1(report);
  }
  if (report.schema_version === REPORT_V2_SCHEMA_VERSION) {
    return validateAdjudicationReportV2(report);
  }
  return {
    ok: false,
    errors: [`schema_version must be ${REPORT_V1_SCHEMA_VERSION} or ${REPORT_V2_SCHEMA_VERSION}`],
    computedHash: "",
    reportHash: typeof report.report_hash === "string" ? report.report_hash : "",
  };
}

function validateAdjudicationReportV1(report: Record<string, unknown>): AdjudicationValidationResult {
  const errors: string[] = [];
  validateFields(report, REPORT_V1_REQUIRED_FIELDS, errors);
  validateBytes32(report, ["challenge_id", "final_report_hash"], errors);
  if (typeof report.claimed_upheld !== "boolean") {
    errors.push("claimed_upheld must be boolean");
  }
  validateInteger(report, "quorum", 2, errors);
  validateInteger(report, "effective_verdict_count", 0, errors);
  validateHashArray(report, "response_hashes", errors);
  validateHashArray(report, "verdict_hashes", errors);
  if (
    typeof report.quorum === "number" &&
    typeof report.effective_verdict_count === "number" &&
    report.effective_verdict_count < report.quorum
  ) {
    errors.push("effective_verdict_count must be greater than or equal to quorum");
  }
  validateTimestamp(report, "finalized_at", errors);
  validateHex64(report, "report_hash", errors);
  errors.push(...collectPrivacyErrors(report));
  return finishHashValidation(report, "report_hash", computeAdjudicationReportHash, errors);
}

function validateAdjudicationReportV2(report: Record<string, unknown>): AdjudicationValidationResult {
  const errors: string[] = [];
  validateFields(report, REPORT_V2_REQUIRED_FIELDS, errors);
  validateBytes32(report, ["challenge_id"], errors);
  if (report.phase !== "finalized" && report.phase !== "expired_no_quorum") {
    errors.push("phase must be finalized or expired_no_quorum");
  }
  validateNullableBytes32(report, "final_report_hash", errors);
  validateNullableBytes32(report, "expiration_report_hash", errors);
  validateInteger(report, "quorum", 2, errors);
  validateInteger(report, "effective_verdict_count", 0, errors);
  validateInteger(report, "unrevealed_commitment_count", 0, errors);
  validateHashArray(report, "response_hashes", errors);
  validateHashArray(report, "commitment_hashes", errors);
  validateHashArray(report, "revealed_verdict_hashes", errors);
  validateTimestamp(report, "response_by", errors);
  validateTimestamp(report, "commit_by", errors);
  validateTimestamp(report, "reveal_by", errors);
  validateNullableTimestamp(report, "finalized_at", errors);
  validateNullableTimestamp(report, "expired_at", errors);
  validateReportV2Phase(report, errors);
  validateHex64(report, "report_hash", errors);
  errors.push(...collectPrivacyErrors(report));
  return finishHashValidation(report, "report_hash", computeAdjudicationReportHash, errors);
}

function validateReportV2Phase(report: Record<string, unknown>, errors: string[]): void {
  if (report.phase === "finalized") {
    if (typeof report.claimed_upheld !== "boolean") {
      errors.push("claimed_upheld must be boolean for finalized reports");
    }
    if (typeof report.final_report_hash !== "string") {
      errors.push("final_report_hash is required for finalized reports");
    }
    if (report.expiration_report_hash !== null) {
      errors.push("expiration_report_hash must be null for finalized reports");
    }
    if (typeof report.finalized_at !== "string") {
      errors.push("finalized_at is required for finalized reports");
    }
    if (report.expired_at !== null) {
      errors.push("expired_at must be null for finalized reports");
    }
    if (
      typeof report.quorum === "number" &&
      typeof report.effective_verdict_count === "number" &&
      report.effective_verdict_count < report.quorum
    ) {
      errors.push("effective_verdict_count must be greater than or equal to quorum for finalized reports");
    }
  }
  if (report.phase === "expired_no_quorum") {
    if (report.claimed_upheld !== null) {
      errors.push("claimed_upheld must be null for expired reports");
    }
    if (report.final_report_hash !== null) {
      errors.push("final_report_hash must be null for expired reports");
    }
    if (typeof report.expiration_report_hash !== "string") {
      errors.push("expiration_report_hash is required for expired reports");
    }
    if (report.finalized_at !== null) {
      errors.push("finalized_at must be null for expired reports");
    }
    if (typeof report.expired_at !== "string") {
      errors.push("expired_at is required for expired reports");
    }
  }
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

function validateBytes32(record: Record<string, unknown>, fields: string[], errors: string[]): void {
  for (const field of fields) {
    const value = record[field];
    if (typeof value !== "string" || !BYTES32_RE.test(value)) {
      errors.push(`${field} must be a 32-byte hex value`);
    } else if (toBytes32(value, field) === ZERO_BYTES32) {
      errors.push(`${field} must not be zero`);
    }
  }
}

function validateNullableBytes32(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (record[field] === null) {
    return;
  }
  validateBytes32(record, [field], errors);
}

function validateHashArray(record: Record<string, unknown>, field: string, errors: string[]): void {
  const values = record[field];
  if (!Array.isArray(values)) {
    errors.push(`${field} must be an array`);
    return;
  }
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (typeof value !== "string" || !BYTES32_RE.test(value)) {
      errors.push(`${field}[${index}] must be a 32-byte hex value`);
      continue;
    }
    const normalized = toBytes32(value, `${field}[${index}]`);
    if (normalized === ZERO_BYTES32) {
      errors.push(`${field}[${index}] must not be zero`);
    }
    if (seen.has(normalized)) {
      errors.push(`${field}[${index}] duplicates ${normalized}`);
    }
    seen.add(normalized);
  }
}

function validateHex64(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (typeof record[field] !== "string" || !HEX64_RE.test(record[field])) {
    errors.push(`${field} must be a lowercase 64-character hex digest`);
  }
}

function validateTimestamp(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (typeof record[field] !== "string" || record[field].length === 0) {
    errors.push(`${field} must be a non-empty string`);
  }
}

function validateNullableTimestamp(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (record[field] === null) {
    return;
  }
  validateTimestamp(record, field, errors);
}

function validateInteger(record: Record<string, unknown>, field: string, min: number, errors: string[]): void {
  if (typeof record[field] !== "number" || !Number.isInteger(record[field]) || Number(record[field]) < min) {
    errors.push(`${field} must be an integer >= ${min}`);
  }
}

function finishHashValidation(
  record: Record<string, unknown>,
  hashField: "record_hash" | "report_hash",
  compute: (record: Record<string, unknown>) => string,
  errors: string[],
): AdjudicationValidationResult {
  let computedHash = "";
  if (errors.length === 0) {
    computedHash = compute(record);
    if (computedHash !== record[hashField]) {
      errors.push(`${hashField} mismatch`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    computedHash,
    reportHash: typeof record[hashField] === "string" ? record[hashField] : "",
  };
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

function assertValid(label: string, validation: AdjudicationValidationResult): void {
  if (!validation.ok) {
    throw new Error(`invalid ${label}: ${validation.errors.join("; ")}`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
