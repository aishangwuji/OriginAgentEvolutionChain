import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { encodeAbiParameters, getAddress, keccak256, type Address, type Hex } from "viem";
import { hashJson, toBytes32 } from "./canonical.ts";

export type EvidenceType =
  | "local_client_report"
  | "user_signed_receipt"
  | "validator_report"
  | "unqualified_validator_report"
  | "foundation_seed_report";

export type ReportStatus = "active" | "invalidated";
export type ChallengeStatus = "submitted" | "upheld" | "rejected";

export interface EvidenceReport {
  schema_version: "originagent.evolution.evidence_report.v1";
  module_digest: string;
  proof_bundle_hash: string;
  report_hash: string;
  evidence_type: EvidenceType;
  reporter: string;
  operator_group_hash: string;
  runner_fingerprint_hash: string;
  challenge_window_end: number;
  report_status: ReportStatus;
  testnet_only: true;
  external_validator_artifact_hash?: string;
}

export interface ExternalValidatorArtifact {
  schema_version: "originagent.evolution.external_validator_artifact.v1";
  module_digest: string;
  validator: string;
  operator_group_hash: string;
  runner_fingerprint_hash: string;
  tool_tests_hash: string;
  result_digest: string;
  created_at: string;
}

export interface ChallengeRecord {
  schema_version: "originagent.evolution.challenge_record.v1";
  challenge_id: string;
  evidence_id: string;
  module_digest: string;
  reason_hash: string;
  challenger: string;
  created_at: string;
  status: ChallengeStatus;
  reporter?: string;
  resolution_hash?: string;
  resolved_at?: string;
}

export interface ChallengeSummaryEntry {
  challenge_id: string;
  evidence_id: string;
  module_digest: string;
  challenger: string;
  status: ChallengeStatus;
  reputation_delta: Record<string, number>;
}

export interface ChallengeSummary {
  schema_version: "originagent.evolution.challenge_summary.v1";
  reputation: Record<string, number>;
  invalidated_evidence_ids: string[];
  rejected_challenge_ids: string[];
  challenges: ChallengeSummaryEntry[];
}

export interface ArtifactWriteResult {
  artifact: ExternalValidatorArtifact;
  canonicalHash: string;
  fileSha256: string;
  path: string;
}

export interface EvidenceValidationResult {
  ok: boolean;
  errors: string[];
  computedHash: string;
  reportHash: string;
}

export interface EvidenceSummary {
  ok: boolean;
  score: number;
  highConfidence: boolean;
  testnetOnly: boolean;
  acceptedReports: number;
  cappedReports: string[];
  invalidatedReports: string[];
  reputationBlockedReports: string[];
  effectiveValidatorGroups: string[];
  effectiveRunnerFingerprints: string[];
  errors: string[];
}

export const EVIDENCE_WEIGHTS: Record<EvidenceType, number> = {
  local_client_report: 10,
  user_signed_receipt: 30,
  validator_report: 60,
  unqualified_validator_report: 0,
  foundation_seed_report: 40,
};

const REQUIRED_FIELDS = [
  "schema_version",
  "module_digest",
  "proof_bundle_hash",
  "report_hash",
  "evidence_type",
  "reporter",
  "operator_group_hash",
  "runner_fingerprint_hash",
  "challenge_window_end",
  "report_status",
  "testnet_only",
];
const ARTIFACT_REQUIRED_FIELDS = [
  "schema_version",
  "module_digest",
  "validator",
  "operator_group_hash",
  "runner_fingerprint_hash",
  "tool_tests_hash",
  "result_digest",
  "created_at",
];
const CHALLENGE_REQUIRED_FIELDS = [
  "schema_version",
  "challenge_id",
  "evidence_id",
  "module_digest",
  "reason_hash",
  "challenger",
  "created_at",
  "status",
];
const OPTIONAL_FIELDS = new Set(["external_validator_artifact_hash"]);
const CHALLENGE_OPTIONAL_FIELDS = new Set(["reporter", "resolution_hash", "resolved_at"]);
const EVIDENCE_TYPES = new Set<EvidenceType>([
  "local_client_report",
  "user_signed_receipt",
  "validator_report",
  "unqualified_validator_report",
  "foundation_seed_report",
]);
const REPORT_STATUSES = new Set<ReportStatus>(["active", "invalidated"]);
const CHALLENGE_STATUSES = new Set<ChallengeStatus>(["submitted", "upheld", "rejected"]);
const HEX64_RE = /^[0-9a-f]{64}$/;
const BYTES32_RE = /^(?:0x)?[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const WINDOWS_PATH_RE = /(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/][^\s"'<>]+/;
const UNIX_PRIVATE_PATH_RE = /(?:\/Users\/|\/home\/)[^\s"'<>]+/;
const URL_QUERY_RE = /https?:\/\/[^\s"'<>?]+\?[^\s"'<>]+/;
const SECRET_ASSIGNMENT_RE =
  /\b(?:api[_-]?key|secret|password|authorization|bearer)\b\s*[:=]\s*["']?[^"',;\s<>]+/i;
const FORBIDDEN_KEYS = new Set([
  "raw_prompt",
  "prompt",
  "file_content",
  "file_contents",
  "raw_tool_output",
  "facts",
  "facts_raw",
  "facts_text",
  "traceback",
  "hidden_reasoning",
  "private_telemetry",
]);

export function readEvidenceReport(path: string): EvidenceReport {
  return JSON.parse(readFileSync(path, "utf8")) as EvidenceReport;
}

export function readExternalValidatorArtifact(path: string): ExternalValidatorArtifact {
  return JSON.parse(readFileSync(path, "utf8")) as ExternalValidatorArtifact;
}

export function readChallengeRecord(path: string): ChallengeRecord {
  return JSON.parse(readFileSync(path, "utf8")) as ChallengeRecord;
}

export function readChallengeSummary(path: string): ChallengeSummary {
  return JSON.parse(readFileSync(path, "utf8")) as ChallengeSummary;
}

export function computeEvidenceReportHash(report: Record<string, unknown>): string {
  const payload = { ...report };
  delete payload.report_hash;
  return hashJson(payload);
}

export function computeExternalValidatorArtifactHash(artifact: Record<string, unknown>): string {
  return hashJson(artifact);
}

export function createExternalValidatorArtifact(input: Omit<ExternalValidatorArtifact, "schema_version">): ExternalValidatorArtifact {
  return {
    schema_version: "originagent.evolution.external_validator_artifact.v1",
    ...input,
  };
}

export function computeEvidenceId(report: EvidenceReport): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "address" },
        { type: "uint8" },
      ],
      [
        toBytes32(report.module_digest, "module_digest"),
        toBytes32(report.proof_bundle_hash, "proof_bundle_hash"),
        toBytes32(report.report_hash, "report_hash"),
        getAddress(report.reporter),
        evidenceTypeId(report.evidence_type),
      ],
    ),
  );
}

export function computeChallengeId(evidenceId: string, challenger: string, reasonHash: string): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "bytes32" }],
      [toBytes32(evidenceId, "evidence_id"), getAddress(challenger), toBytes32(reasonHash, "reason_hash")],
    ),
  );
}

export function createChallengeRecord(input: {
  evidenceId: string;
  moduleDigest: string;
  reasonHash: string;
  challenger: string;
  createdAt: string;
  status?: ChallengeStatus;
  reporter?: string;
  resolutionHash?: string;
  resolvedAt?: string;
}): ChallengeRecord {
  const record: ChallengeRecord = {
    schema_version: "originagent.evolution.challenge_record.v1",
    challenge_id: computeChallengeId(input.evidenceId, input.challenger, input.reasonHash),
    evidence_id: toBytes32(input.evidenceId, "evidence_id"),
    module_digest: toBytes32(input.moduleDigest, "module_digest"),
    reason_hash: toBytes32(input.reasonHash, "reason_hash"),
    challenger: getAddress(input.challenger),
    created_at: input.createdAt,
    status: input.status ?? "submitted",
  };
  if (input.reporter) {
    record.reporter = getAddress(input.reporter);
  }
  if (input.resolutionHash) {
    record.resolution_hash = toBytes32(input.resolutionHash, "resolution_hash");
  }
  if (input.resolvedAt) {
    record.resolved_at = input.resolvedAt;
  }
  const validation = validateChallengeRecord(record);
  if (!validation.ok) {
    throw new Error(`invalid challenge record: ${validation.errors.join("; ")}`);
  }
  return record;
}

export function writeChallengeRecord(record: ChallengeRecord, path: string): ChallengeRecord {
  const validation = validateChallengeRecord(record);
  if (!validation.ok) {
    throw new Error(`invalid challenge record: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export function writeExternalValidatorArtifact(artifact: ExternalValidatorArtifact, path: string): ArtifactWriteResult {
  const validation = validateExternalValidatorArtifact(artifact);
  if (!validation.ok) {
    throw new Error(`invalid external validator artifact: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  const content = `${JSON.stringify(artifact, null, 2)}\n`;
  writeFileSync(path, content, "utf8");
  return {
    artifact,
    canonicalHash: computeExternalValidatorArtifactHash(artifact),
    fileSha256: sha256Text(content),
    path,
  };
}

export function validateChallengeRecord(record: unknown): EvidenceValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(record)) {
    return { ok: false, errors: ["challenge record must be an object"], computedHash: "", reportHash: "" };
  }
  for (const field of CHALLENGE_REQUIRED_FIELDS) {
    if (!(field in record)) {
      errors.push(`missing field: ${field}`);
    }
  }
  for (const field of Object.keys(record)) {
    if (!CHALLENGE_REQUIRED_FIELDS.includes(field) && !CHALLENGE_OPTIONAL_FIELDS.has(field)) {
      errors.push(`unknown field: ${field}`);
    }
  }
  if (record.schema_version !== "originagent.evolution.challenge_record.v1") {
    errors.push("schema_version must be originagent.evolution.challenge_record.v1");
  }
  for (const field of ["challenge_id", "evidence_id", "module_digest", "reason_hash", "resolution_hash"]) {
    const value = record[field];
    if (value !== undefined && (typeof value !== "string" || !BYTES32_RE.test(value))) {
      errors.push(`${field} must be a 32-byte hex value`);
    }
  }
  if (typeof record.challenger !== "string" || !ADDRESS_RE.test(record.challenger)) {
    errors.push("challenger must be an EVM address");
  }
  if (record.reporter !== undefined && (typeof record.reporter !== "string" || !ADDRESS_RE.test(record.reporter))) {
    errors.push("reporter must be an EVM address");
  }
  if (typeof record.created_at !== "string" || record.created_at.length === 0) {
    errors.push("created_at must be a non-empty string");
  }
  if (record.resolved_at !== undefined && (typeof record.resolved_at !== "string" || record.resolved_at.length === 0)) {
    errors.push("resolved_at must be a non-empty string");
  }
  if (!CHALLENGE_STATUSES.has(record.status as ChallengeStatus)) {
    errors.push("status must be submitted, upheld, or rejected");
  }
  if ((record.status === "upheld" || record.status === "rejected") && typeof record.resolution_hash !== "string") {
    errors.push("resolved challenge records require resolution_hash");
  }
  if (record.status === "upheld" && typeof record.reporter !== "string") {
    errors.push("upheld challenge records require reporter");
  }
  if (errors.length === 0) {
    const expectedChallengeId = computeChallengeId(
      record.evidence_id as string,
      record.challenger as string,
      record.reason_hash as string,
    );
    if (toBytes32(record.challenge_id as string, "challenge_id") !== expectedChallengeId) {
      errors.push("challenge_id mismatch");
    }
  }
  scanPrivacy(record, "$", errors);
  const challengeId =
    typeof record.challenge_id === "string" && BYTES32_RE.test(record.challenge_id)
      ? toBytes32(record.challenge_id, "challenge_id")
      : "";
  return {
    ok: errors.length === 0,
    errors,
    computedHash: challengeId,
    reportHash: challengeId,
  };
}

export function validateExternalValidatorArtifact(artifact: unknown): EvidenceValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(artifact)) {
    return { ok: false, errors: ["external validator artifact must be an object"], computedHash: "", reportHash: "" };
  }
  for (const field of ARTIFACT_REQUIRED_FIELDS) {
    if (!(field in artifact)) {
      errors.push(`missing field: ${field}`);
    }
  }
  for (const field of Object.keys(artifact)) {
    if (!ARTIFACT_REQUIRED_FIELDS.includes(field)) {
      errors.push(`unknown field: ${field}`);
    }
  }
  if (artifact.schema_version !== "originagent.evolution.external_validator_artifact.v1") {
    errors.push("schema_version must be originagent.evolution.external_validator_artifact.v1");
  }
  for (const field of ["module_digest", "operator_group_hash", "runner_fingerprint_hash", "tool_tests_hash", "result_digest"]) {
    if (typeof artifact[field] !== "string" || !HEX64_RE.test(artifact[field])) {
      errors.push(`${field} must be a lowercase 64-character hex digest`);
    }
  }
  if (typeof artifact.validator !== "string" || !ADDRESS_RE.test(artifact.validator)) {
    errors.push("validator must be an EVM address");
  }
  if (typeof artifact.created_at !== "string" || artifact.created_at.length === 0) {
    errors.push("created_at must be a non-empty string");
  }
  scanPrivacy(artifact, "$", errors);

  const computedHash = errors.length === 0 ? computeExternalValidatorArtifactHash(artifact) : "";
  return {
    ok: errors.length === 0,
    errors,
    computedHash,
    reportHash: computedHash,
  };
}

export function createEvidenceReport(input: {
  moduleDigest: string;
  proofBundleHash: string;
  evidenceType: EvidenceType;
  reporter: string;
  operatorGroupHash: string;
  runnerFingerprintHash: string;
  challengeWindowEnd: number;
  externalValidatorArtifact?: ExternalValidatorArtifact;
}): EvidenceReport {
  if (input.evidenceType === "validator_report" && !input.externalValidatorArtifact) {
    throw new Error("validator_report requires --external-validator-artifact");
  }
  const report: EvidenceReport = {
    schema_version: "originagent.evolution.evidence_report.v1",
    module_digest: input.moduleDigest,
    proof_bundle_hash: input.proofBundleHash,
    report_hash: "",
    evidence_type: input.evidenceType,
    reporter: input.reporter,
    operator_group_hash: input.operatorGroupHash,
    runner_fingerprint_hash: input.runnerFingerprintHash,
    challenge_window_end: input.challengeWindowEnd,
    report_status: "active",
    testnet_only: true,
  };
  if (input.externalValidatorArtifact) {
    const validation = validateExternalValidatorArtifact(input.externalValidatorArtifact);
    if (!validation.ok) {
      throw new Error(`invalid external validator artifact: ${validation.errors.join("; ")}`);
    }
    report.external_validator_artifact_hash = validation.computedHash;
  }
  report.report_hash = computeEvidenceReportHash(report);
  const validation = validateEvidenceReport(report);
  if (!validation.ok) {
    throw new Error(`invalid evidence report: ${validation.errors.join("; ")}`);
  }
  return report;
}

export function writeEvidenceReport(report: EvidenceReport, path: string): EvidenceReport {
  const validation = validateEvidenceReport(report);
  if (!validation.ok) {
    throw new Error(`invalid evidence report: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export function validateEvidenceReport(report: unknown): EvidenceValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(report)) {
    return { ok: false, errors: ["evidence report must be an object"], computedHash: "", reportHash: "" };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in report)) {
      errors.push(`missing field: ${field}`);
    }
  }
  for (const field of Object.keys(report)) {
    if (!REQUIRED_FIELDS.includes(field) && !OPTIONAL_FIELDS.has(field)) {
      errors.push(`unknown field: ${field}`);
    }
  }

  if (report.schema_version !== "originagent.evolution.evidence_report.v1") {
    errors.push("schema_version must be originagent.evolution.evidence_report.v1");
  }
  for (const field of ["module_digest", "proof_bundle_hash", "report_hash"]) {
    if (typeof report[field] !== "string" || !HEX64_RE.test(report[field])) {
      errors.push(`${field} must be a lowercase 64-character hex digest`);
    }
  }
  for (const field of ["operator_group_hash", "runner_fingerprint_hash", "external_validator_artifact_hash"]) {
    const value = report[field];
    if (value !== undefined && (typeof value !== "string" || !HEX64_RE.test(value))) {
      errors.push(`${field} must be a lowercase 64-character hex digest`);
    }
  }
  if (!EVIDENCE_TYPES.has(report.evidence_type as EvidenceType)) {
    errors.push("evidence_type is not supported");
  }
  if (!REPORT_STATUSES.has(report.report_status as ReportStatus)) {
    errors.push("report_status must be active or invalidated");
  }
  if (typeof report.reporter !== "string" || !ADDRESS_RE.test(report.reporter)) {
    errors.push("reporter must be an EVM address");
  }
  if (!Number.isInteger(report.challenge_window_end) || Number(report.challenge_window_end) < 0) {
    errors.push("challenge_window_end must be a non-negative integer");
  }
  if (report.testnet_only !== true) {
    errors.push("testnet_only must be true for EC-3 evidence");
  }
  if (report.evidence_type === "validator_report" && typeof report.external_validator_artifact_hash !== "string") {
    errors.push("validator_report requires external_validator_artifact_hash");
  }
  scanPrivacy(report, "$", errors);

  let computedHash = "";
  if (errors.length === 0) {
    computedHash = computeEvidenceReportHash(report);
    if (computedHash !== report.report_hash) {
      errors.push("report_hash mismatch");
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    computedHash,
    reportHash: typeof report.report_hash === "string" ? report.report_hash : "",
  };
}

export function computeChallengeSummary(records: ChallengeRecord[]): ChallengeSummary {
  const reputation: Record<string, number> = {};
  const invalidatedEvidenceIds: string[] = [];
  const rejectedChallengeIds: string[] = [];
  const challenges: ChallengeSummaryEntry[] = [];

  for (const record of records) {
    const validation = validateChallengeRecord(record);
    if (!validation.ok) {
      throw new Error(`invalid challenge record: ${validation.errors.join("; ")}`);
    }
    const challengeId = toBytes32(record.challenge_id, "challenge_id");
    const evidenceId = toBytes32(record.evidence_id, "evidence_id");
    const challenger = getAddress(record.challenger);
    const reputationDelta: Record<string, number> = {};

    if (record.status === "upheld") {
      invalidatedEvidenceIds.push(evidenceId);
      addReputation(reputation, challenger, 5);
      addReputation(reputationDelta, challenger, 5);
      if (record.reporter) {
        const reporter = getAddress(record.reporter);
        addReputation(reputation, reporter, -10);
        addReputation(reputationDelta, reporter, -10);
      }
    } else if (record.status === "rejected") {
      rejectedChallengeIds.push(challengeId);
      addReputation(reputation, challenger, -2);
      addReputation(reputationDelta, challenger, -2);
    }

    challenges.push({
      challenge_id: challengeId,
      evidence_id: evidenceId,
      module_digest: toBytes32(record.module_digest, "module_digest"),
      challenger,
      status: record.status,
      reputation_delta: reputationDelta,
    });
  }

  return {
    schema_version: "originagent.evolution.challenge_summary.v1",
    reputation,
    invalidated_evidence_ids: invalidatedEvidenceIds,
    rejected_challenge_ids: rejectedChallengeIds,
    challenges,
  };
}

export function computeEvidenceSummary(reports: EvidenceReport[], challengeSummary?: ChallengeSummary): EvidenceSummary {
  const errors: string[] = [];
  const cappedReports: string[] = [];
  const invalidatedReports: string[] = [];
  const reputationBlockedReports: string[] = [];
  const invalidatedEvidenceIds = new Set((challengeSummary?.invalidated_evidence_ids ?? []).map((id) => toBytes32(id, "evidence_id")));
  const validatorGroups = new Set<string>();
  const runnerFingerprints = new Set<string>();
  let score = 0;
  let acceptedReports = 0;

  for (const report of reports) {
    const validation = validateEvidenceReport(report);
    if (!validation.ok) {
      errors.push(...validation.errors);
      continue;
    }
    if (report.report_status === "invalidated" || invalidatedEvidenceIds.has(computeEvidenceId(report))) {
      invalidatedReports.push(report.report_hash);
      continue;
    }
    const reporterReputation = challengeSummary?.reputation[getAddress(report.reporter)] ?? 0;
    if (reporterReputation <= -10) {
      reputationBlockedReports.push(report.report_hash);
      continue;
    }
    if (report.evidence_type === "validator_report") {
      if (validatorGroups.has(report.operator_group_hash) || runnerFingerprints.has(report.runner_fingerprint_hash)) {
        cappedReports.push(report.report_hash);
        continue;
      }
      validatorGroups.add(report.operator_group_hash);
      runnerFingerprints.add(report.runner_fingerprint_hash);
    }
    score += EVIDENCE_WEIGHTS[report.evidence_type];
    acceptedReports += 1;
  }

  return {
    ok: errors.length === 0,
    score,
    highConfidence: score >= 80 && validatorGroups.size >= 2 && runnerFingerprints.size >= 2,
    testnetOnly: true,
    acceptedReports,
    cappedReports,
    invalidatedReports,
    reputationBlockedReports,
    effectiveValidatorGroups: [...validatorGroups],
    effectiveRunnerFingerprints: [...runnerFingerprints],
    errors,
  };
}

export function evidenceTypeId(evidenceType: EvidenceType): number {
  return {
    local_client_report: 1,
    user_signed_receipt: 2,
    validator_report: 3,
    unqualified_validator_report: 4,
    foundation_seed_report: 5,
  }[evidenceType];
}

export function evidenceReportToContractArgs(report: EvidenceReport) {
  return [
    toBytes32(report.module_digest, "module_digest"),
    toBytes32(report.proof_bundle_hash, "proof_bundle_hash"),
    toBytes32(report.report_hash, "report_hash"),
    evidenceTypeId(report.evidence_type),
    toBytes32(report.operator_group_hash, "operator_group_hash"),
    toBytes32(report.runner_fingerprint_hash, "runner_fingerprint_hash"),
    report.challenge_window_end,
  ] as const;
}

export function collectPrivacyErrors(value: unknown): string[] {
  const errors: string[] = [];
  scanPrivacy(value, "$", errors);
  return errors;
}

function scanPrivacy(value: unknown, path: string, errors: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanPrivacy(item, `${path}[${index}]`, errors));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        errors.push(`forbidden private field: ${path}.${key}`);
      }
      scanPrivacy(item, `${path}.${key}`, errors);
    }
    return;
  }
  if (typeof value === "string") {
    if (WINDOWS_PATH_RE.test(value) || UNIX_PRIVATE_PATH_RE.test(value)) {
      errors.push(`local absolute path detected at ${path}`);
    }
    if (URL_QUERY_RE.test(value)) {
      errors.push(`URL query string detected at ${path}`);
    }
    if (SECRET_ASSIGNMENT_RE.test(value)) {
      errors.push(`secret-like string detected at ${path}`);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function addReputation(target: Record<string, number>, address: Address, delta: number): void {
  target[address] = (target[address] ?? 0) + delta;
}
