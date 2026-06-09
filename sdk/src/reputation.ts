import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getAddress, type Address, type Hex } from "viem";
import { hashJson, toBytes32 } from "./canonical.ts";
import { collectPrivacyErrors } from "./evidence.ts";

export type AgentReputationSource = "challenge_upheld" | "challenge_rejected";

export interface AgentReputationRecord {
  schema_version: "originagent.evolution.agent_reputation_record.v1";
  passport_id: Hex;
  owner: Address;
  source: AgentReputationSource;
  source_id: Hex;
  subject_address: Address;
  delta: number;
  created_at: string;
}

export interface AgentReputationReport {
  schema_version: "originagent.evolution.agent_reputation_report.v1";
  passport_id: Hex;
  owner: Address;
  score: number;
  positive_count: number;
  negative_count: number;
  records: AgentReputationRecord[];
  continuity_signals: string[];
  warnings: string[];
  report_hash: string;
}

export interface ReputationValidationResult {
  ok: boolean;
  errors: string[];
  computedHash: string;
}

const RECORD_REQUIRED_FIELDS = [
  "schema_version",
  "passport_id",
  "owner",
  "source",
  "source_id",
  "subject_address",
  "delta",
  "created_at",
];
const REPORT_REQUIRED_FIELDS = [
  "schema_version",
  "passport_id",
  "owner",
  "score",
  "positive_count",
  "negative_count",
  "records",
  "continuity_signals",
  "warnings",
  "report_hash",
];
const SOURCES = new Set<AgentReputationSource>(["challenge_upheld", "challenge_rejected"]);
const BYTES32_RE = /^(?:0x)?[0-9a-fA-F]{64}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as const;

export function createAgentReputationRecord(input: {
  passportId: string;
  owner: string;
  source: AgentReputationSource;
  sourceId: string;
  subjectAddress: string;
  createdAt: string;
}): AgentReputationRecord {
  const record: AgentReputationRecord = {
    schema_version: "originagent.evolution.agent_reputation_record.v1",
    passport_id: toBytes32(input.passportId, "passport_id"),
    owner: getAddress(input.owner),
    source: input.source,
    source_id: toBytes32(input.sourceId, "source_id"),
    subject_address: getAddress(input.subjectAddress),
    delta: reputationDeltaForSource(input.source),
    created_at: input.createdAt,
  };
  const validation = validateAgentReputationRecord(record);
  if (!validation.ok) {
    throw new Error(`invalid agent reputation record: ${validation.errors.join("; ")}`);
  }
  return record;
}

export function createAgentReputationReport(input: {
  passportId: string;
  owner: string;
  records: AgentReputationRecord[];
  continuitySignals?: string[];
  warnings?: string[];
}): AgentReputationReport {
  const passportId = toBytes32(input.passportId, "passport_id");
  const owner = getAddress(input.owner);
  const records = input.records.map(normalizeRecord);
  const score = records.reduce((sum, record) => sum + record.delta, 0);
  const report: AgentReputationReport = {
    schema_version: "originagent.evolution.agent_reputation_report.v1",
    passport_id: passportId,
    owner,
    score,
    positive_count: records.filter((record) => record.delta > 0).length,
    negative_count: records.filter((record) => record.delta < 0).length,
    records,
    continuity_signals: input.continuitySignals ?? [],
    warnings: input.warnings ?? [],
    report_hash: "",
  };
  report.report_hash = computeReputationReportHash(report);
  const validation = validateAgentReputationReport(report);
  if (!validation.ok) {
    throw new Error(`invalid agent reputation report: ${validation.errors.join("; ")}`);
  }
  return report;
}

export function readAgentReputationRecord(path: string): AgentReputationRecord {
  return JSON.parse(readFileSync(path, "utf8")) as AgentReputationRecord;
}

export function readAgentReputationReport(path: string): AgentReputationReport {
  return JSON.parse(readFileSync(path, "utf8")) as AgentReputationReport;
}

export function writeAgentReputationRecord(record: AgentReputationRecord, path: string): AgentReputationRecord {
  const validation = validateAgentReputationRecord(record);
  if (!validation.ok) {
    throw new Error(`invalid agent reputation record: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export function writeAgentReputationReport(report: AgentReputationReport, path: string): AgentReputationReport {
  const validation = validateAgentReputationReport(report);
  if (!validation.ok) {
    throw new Error(`invalid agent reputation report: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export function computeReputationReportHash(report: Record<string, unknown>): string {
  const payload = { ...report };
  delete payload.report_hash;
  return hashJson(payload);
}

export function validateAgentReputationRecord(record: unknown): ReputationValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(record)) {
    return { ok: false, errors: ["agent reputation record must be an object"], computedHash: "" };
  }
  validateFields(record, RECORD_REQUIRED_FIELDS, errors);
  if (record.schema_version !== "originagent.evolution.agent_reputation_record.v1") {
    errors.push("schema_version must be originagent.evolution.agent_reputation_record.v1");
  }
  validateBytes32(record, ["passport_id", "source_id"], errors);
  rejectZero(record, ["passport_id", "source_id"], errors);
  validateAddress(record, "owner", errors);
  validateAddress(record, "subject_address", errors);
  if (!SOURCES.has(record.source as AgentReputationSource)) {
    errors.push("source must be challenge_upheld or challenge_rejected");
  } else if (record.delta !== reputationDeltaForSource(record.source as AgentReputationSource)) {
    errors.push(`${record.source} requires delta ${reputationDeltaForSource(record.source as AgentReputationSource)}`);
  }
  if (
    typeof record.owner === "string" &&
    ADDRESS_RE.test(record.owner) &&
    typeof record.subject_address === "string" &&
    ADDRESS_RE.test(record.subject_address) &&
    getAddress(record.owner) !== getAddress(record.subject_address)
  ) {
    errors.push("subject_address must match owner for EC-10 v1");
  }
  if (typeof record.delta !== "number" || !Number.isInteger(record.delta)) {
    errors.push("delta must be an integer");
  }
  if (typeof record.created_at !== "string" || record.created_at.length === 0) {
    errors.push("created_at must be a non-empty string");
  }
  errors.push(...collectPrivacyErrors(record));
  const computedHash =
    typeof record.source_id === "string" && BYTES32_RE.test(record.source_id)
      ? toBytes32(record.source_id, "source_id")
      : "";
  return { ok: errors.length === 0, errors, computedHash };
}

export function validateAgentReputationReport(report: unknown): ReputationValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(report)) {
    return { ok: false, errors: ["agent reputation report must be an object"], computedHash: "" };
  }
  validateFields(report, REPORT_REQUIRED_FIELDS, errors);
  if (report.schema_version !== "originagent.evolution.agent_reputation_report.v1") {
    errors.push("schema_version must be originagent.evolution.agent_reputation_report.v1");
  }
  validateBytes32(report, ["passport_id"], errors);
  rejectZero(report, ["passport_id"], errors);
  validateAddress(report, "owner", errors);
  for (const field of ["score", "positive_count", "negative_count"]) {
    if (typeof report[field] !== "number" || !Number.isInteger(report[field])) {
      errors.push(`${field} must be an integer`);
    }
  }
  if (!Array.isArray(report.records)) {
    errors.push("records must be an array");
  }
  if (!Array.isArray(report.continuity_signals) || report.continuity_signals.some((item) => typeof item !== "string")) {
    errors.push("continuity_signals must be an array of strings");
  }
  if (!Array.isArray(report.warnings) || report.warnings.some((item) => typeof item !== "string")) {
    errors.push("warnings must be an array of strings");
  }
  if (typeof report.report_hash !== "string" || !HEX64_RE.test(report.report_hash)) {
    errors.push("report_hash must be a lowercase 64-character hex digest");
  }

  if (Array.isArray(report.records)) {
    let score = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    for (const record of report.records) {
      const validation = validateAgentReputationRecord(record);
      if (!validation.ok) {
        errors.push(...validation.errors.map((error) => `record: ${error}`));
        continue;
      }
      const typed = record as AgentReputationRecord;
      if (toBytes32(typed.passport_id, "passport_id") !== toBytes32(String(report.passport_id), "passport_id")) {
        errors.push(`record passport_id mismatch for source ${typed.source_id}`);
      }
      if (getAddress(typed.owner) !== getAddress(String(report.owner))) {
        errors.push(`record owner mismatch for source ${typed.source_id}`);
      }
      score += typed.delta;
      if (typed.delta > 0) {
        positiveCount += 1;
      } else if (typed.delta < 0) {
        negativeCount += 1;
      }
    }
    if (typeof report.score === "number" && report.score !== score) {
      errors.push("score mismatch");
    }
    if (typeof report.positive_count === "number" && report.positive_count !== positiveCount) {
      errors.push("positive_count mismatch");
    }
    if (typeof report.negative_count === "number" && report.negative_count !== negativeCount) {
      errors.push("negative_count mismatch");
    }
  }

  let computedHash = "";
  if (errors.length === 0) {
    computedHash = computeReputationReportHash(report);
    if (computedHash !== report.report_hash) {
      errors.push("report_hash mismatch");
    }
  }
  errors.push(...collectPrivacyErrors(report));
  return { ok: errors.length === 0, errors, computedHash };
}

export function reputationDeltaForSource(source: AgentReputationSource): number {
  if (source === "challenge_upheld") {
    return 5;
  }
  if (source === "challenge_rejected") {
    return -2;
  }
  throw new Error("source must be challenge_upheld or challenge_rejected");
}

function normalizeRecord(record: AgentReputationRecord): AgentReputationRecord {
  const validation = validateAgentReputationRecord(record);
  if (!validation.ok) {
    throw new Error(`invalid agent reputation record: ${validation.errors.join("; ")}`);
  }
  return {
    ...record,
    passport_id: toBytes32(record.passport_id, "passport_id"),
    owner: getAddress(record.owner),
    source_id: toBytes32(record.source_id, "source_id"),
    subject_address: getAddress(record.subject_address),
  };
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
