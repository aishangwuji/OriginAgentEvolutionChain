import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getAddress } from "viem";
import { hashJson } from "./canonical.ts";
import { validateAbuseReport, type AbuseCategory, type AbuseReport, type AbuseSeverity } from "./adversarial.ts";
import { collectPrivacyErrors } from "./evidence.ts";

export const TRUST_POLICY_VERSION = "ec13.0.0";

export type TrustRisk = "critical" | "high" | "medium" | "low";
export type TrustSubjectType = "passport" | "address" | "validator" | "unit_kind" | "module_submitter" | "artifact_set";
export type AdmissionGate = "eligible" | "manual_review" | "blocked" | "not_applicable";
export type ValidatorWeightGate = "normal" | "capped" | "zeroed" | "not_applicable";
export type ArtifactHandlingGate = "accepted" | "manual_review" | "quarantined" | "not_applicable";
export type DisputeStatus = "resolved" | "unresolved";

export interface TrustPolicyGates {
  test_credit: AdmissionGate;
  module_recommendation: AdmissionGate;
  unit_kind_canonicalization: AdmissionGate;
  validator_weight: ValidatorWeightGate;
  artifact_handling: ArtifactHandlingGate;
}

export interface TrustPolicyDecision {
  subject_type: TrustSubjectType;
  subject_id: string;
  risk: TrustRisk;
  categories: AbuseCategory[];
  signal_count: number;
  evidences: string[];
  gates: TrustPolicyGates;
  review_reason: string;
  dispute_status?: DisputeStatus;
}

export interface TrustPolicySummary {
  total_subjects: number;
  by_risk_level: Record<TrustRisk, number>;
  max_risk: TrustRisk;
  blocked_count: number;
  manual_review_count: number;
  quarantined_count: number;
}

export interface TrustPolicyReport {
  schema_version: "originagent.evolution.trust_policy_report.v1";
  generated_at: string;
  policy_version: typeof TRUST_POLICY_VERSION;
  source_abuse_report_hash: string;
  decisions: TrustPolicyDecision[];
  summary: TrustPolicySummary;
  report_hash: string;
}

export interface TrustPolicyValidationResult {
  ok: boolean;
  errors: string[];
  computedHash: string;
}

export interface TrustPolicyAuditSummary {
  generated_at: string;
  policy_version: string;
  total_subjects: number;
  by_risk_level: Record<TrustRisk, number>;
  max_risk: TrustRisk;
  report_hash: string;
}

interface TrustSubjectRef {
  subject_type: TrustSubjectType;
  subject_id: string;
}

interface DecisionBucket extends TrustSubjectRef {
  categories: Set<AbuseCategory>;
  evidences: Set<string>;
  descriptions: string[];
  risks: TrustRisk[];
  medium_count: number;
}

const SCHEMA_VERSION = "originagent.evolution.trust_policy_report.v1";
const HEX64_RE = /^[0-9a-f]{64}$/;
const BYTES32_RE = /^(?:0x)?[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const RISKS = new Set<TrustRisk>(["critical", "high", "medium", "low"]);
const SUBJECT_TYPES = new Set<TrustSubjectType>([
  "passport",
  "address",
  "validator",
  "unit_kind",
  "module_submitter",
  "artifact_set",
]);
const ADMISSION_GATES = new Set<AdmissionGate>(["eligible", "manual_review", "blocked", "not_applicable"]);
const VALIDATOR_GATES = new Set<ValidatorWeightGate>(["normal", "capped", "zeroed", "not_applicable"]);
const ARTIFACT_GATES = new Set<ArtifactHandlingGate>(["accepted", "manual_review", "quarantined", "not_applicable"]);
const DISPUTE_STATUSES = new Set<DisputeStatus>(["resolved", "unresolved"]);
const CATEGORIES = new Set<AbuseCategory>([
  "passport_sybil",
  "reputation_farming",
  "validator_collusion",
  "unit_kind_typosquatting",
  "module_spam",
  "artifact_tampering",
  "privacy_leakage",
]);

export function readTrustPolicyReport(path: string): TrustPolicyReport {
  return JSON.parse(readFileSync(path, "utf8")) as TrustPolicyReport;
}

export function writeTrustPolicyReport(report: TrustPolicyReport, path: string): TrustPolicyReport {
  const validation = validateTrustPolicyReport(report);
  if (!validation.ok) {
    throw new Error(`invalid trust policy report: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export function computeTrustPolicyReportHash(report: Record<string, unknown>): string {
  const payload = { ...report };
  delete payload.report_hash;
  return hashJson(payload);
}

export function evaluateTrustPolicy(input: { abuseReport: AbuseReport; generatedAt?: string }): TrustPolicyReport {
  const abuseValidation = validateAbuseReport(input.abuseReport);
  if (!abuseValidation.ok) {
    throw new Error(`invalid source abuse report: ${abuseValidation.errors.join("; ")}`);
  }

  const buckets = new Map<string, DecisionBucket>();
  for (const signal of input.abuseReport.signals) {
    const risk = riskFromSeverity(signal.severity);
    for (const subject of subjectsForSignal(signal)) {
      const key = `${subject.subject_type}:${subject.subject_id}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          ...subject,
          categories: new Set(),
          evidences: new Set(),
          descriptions: [],
          risks: [],
          medium_count: 0,
        };
        buckets.set(key, bucket);
      }
      bucket.categories.add(signal.category);
      bucket.evidences.add(signal.evidence);
      bucket.descriptions.push(signal.description);
      bucket.risks.push(risk);
      if (risk === "medium") {
        bucket.medium_count += 1;
      }
    }
  }

  const decisions = [...buckets.values()].map(bucketToDecision).sort(compareDecision);
  const report: TrustPolicyReport = {
    schema_version: SCHEMA_VERSION,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    policy_version: TRUST_POLICY_VERSION,
    source_abuse_report_hash: input.abuseReport.report_hash,
    decisions,
    summary: summarizeTrustPolicyDecisions(decisions),
    report_hash: "",
  };
  report.report_hash = computeTrustPolicyReportHash(report);
  const validation = validateTrustPolicyReport(report, input.abuseReport);
  if (!validation.ok) {
    throw new Error(`invalid trust policy report: ${validation.errors.join("; ")}`);
  }
  return report;
}

export function validateTrustPolicyReport(report: unknown, sourceAbuseReport?: AbuseReport): TrustPolicyValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(report)) {
    return { ok: false, errors: ["trust policy report must be an object"], computedHash: "" };
  }
  validateFields(
    report,
    ["schema_version", "generated_at", "policy_version", "source_abuse_report_hash", "decisions", "summary", "report_hash"],
    errors,
  );
  if (report.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  }
  if (typeof report.generated_at !== "string" || report.generated_at.length === 0) {
    errors.push("generated_at must be a non-empty string");
  }
  if (report.policy_version !== TRUST_POLICY_VERSION) {
    errors.push(`policy_version must be ${TRUST_POLICY_VERSION}`);
  }
  if (typeof report.source_abuse_report_hash !== "string" || !HEX64_RE.test(report.source_abuse_report_hash)) {
    errors.push("source_abuse_report_hash must be a lowercase 64-character hex digest");
  }
  if (sourceAbuseReport) {
    const sourceValidation = validateAbuseReport(sourceAbuseReport);
    if (!sourceValidation.ok) {
      errors.push(...sourceValidation.errors.map((error) => `source abuse report: ${error}`));
    } else if (report.source_abuse_report_hash !== sourceAbuseReport.report_hash) {
      errors.push("source_abuse_report_hash mismatch");
    }
  }
  if (!Array.isArray(report.decisions)) {
    errors.push("decisions must be an array");
  } else {
    for (const [index, decision] of report.decisions.entries()) {
      validateDecision(decision, `decisions[${index}]`, errors);
    }
  }
  validateSummary(report.summary, Array.isArray(report.decisions) ? report.decisions : [], errors);
  if (typeof report.report_hash !== "string" || !HEX64_RE.test(report.report_hash)) {
    errors.push("report_hash must be a lowercase 64-character hex digest");
  }
  errors.push(...collectPrivacyErrors(report));

  let computedHash = "";
  if (errors.length === 0) {
    computedHash = computeTrustPolicyReportHash(report);
    if (computedHash !== report.report_hash) {
      errors.push("report_hash mismatch");
    }
  }
  return { ok: errors.length === 0, errors, computedHash };
}

export function summarizeTrustPolicyReport(report: TrustPolicyReport): TrustPolicyAuditSummary {
  return {
    generated_at: report.generated_at,
    policy_version: report.policy_version,
    total_subjects: report.summary.total_subjects,
    by_risk_level: report.summary.by_risk_level,
    max_risk: report.summary.max_risk,
    report_hash: report.report_hash,
  };
}

function bucketToDecision(bucket: DecisionBucket): TrustPolicyDecision {
  const risk = aggregateRisk(bucket.risks, bucket.medium_count);
  const categories = [...bucket.categories].sort();
  return {
    subject_type: bucket.subject_type,
    subject_id: bucket.subject_id,
    risk,
    categories,
    signal_count: bucket.risks.length,
    evidences: [...bucket.evidences].sort(),
    gates: gatesFor(bucket.subject_type, categories, risk),
    review_reason: reviewReason(bucket, risk),
  };
}

function summarizeTrustPolicyDecisions(decisions: TrustPolicyDecision[]): TrustPolicySummary {
  const by_risk_level: Record<TrustRisk, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  let max_risk: TrustRisk = "low";
  let blocked_count = 0;
  let manual_review_count = 0;
  let quarantined_count = 0;
  for (const decision of decisions) {
    by_risk_level[decision.risk] += 1;
    if (riskRank(decision.risk) > riskRank(max_risk)) {
      max_risk = decision.risk;
    }
    const gateValues = Object.values(decision.gates);
    if (gateValues.includes("blocked")) {
      blocked_count += 1;
    }
    if (gateValues.includes("manual_review") || decision.gates.validator_weight === "capped") {
      manual_review_count += 1;
    }
    if (decision.gates.artifact_handling === "quarantined") {
      quarantined_count += 1;
    }
  }
  return {
    total_subjects: decisions.length,
    by_risk_level,
    max_risk,
    blocked_count,
    manual_review_count,
    quarantined_count,
  };
}

function subjectsForSignal(signal: { category: AbuseCategory; severity: AbuseSeverity; subjects: string[] }): TrustSubjectRef[] {
  if (signal.category === "unit_kind_typosquatting") {
    return signal.subjects[0] ? [{ subject_type: "unit_kind", subject_id: signal.subjects[0] }] : [];
  }
  if (signal.category === "artifact_tampering" || signal.category === "privacy_leakage") {
    return [{ subject_type: "artifact_set", subject_id: signal.subjects.join(":") || signal.category }];
  }
  if (signal.category === "module_spam") {
    return signal.subjects.map((subject) => ({ subject_type: "module_submitter", subject_id: normalizeSubject(subject) }));
  }
  if (signal.category === "validator_collusion") {
    return signal.subjects.map((subject) =>
      isAddress(subject)
        ? { subject_type: "validator", subject_id: normalizeSubject(subject) }
        : { subject_type: "artifact_set", subject_id: subject },
    );
  }
  if (signal.category === "passport_sybil") {
    return signal.subjects.map((subject) => {
      if (isAddress(subject)) {
        return { subject_type: "address", subject_id: normalizeSubject(subject) };
      }
      if (isBytes32(subject)) {
        return { subject_type: "passport", subject_id: normalizeBytes32(subject) };
      }
      return { subject_type: "artifact_set", subject_id: subject };
    });
  }
  return signal.subjects.map((subject) =>
    isAddress(subject)
      ? { subject_type: "address", subject_id: normalizeSubject(subject) }
      : { subject_type: "artifact_set", subject_id: subject },
  );
}

function gatesFor(subjectType: TrustSubjectType, categories: AbuseCategory[], risk: TrustRisk): TrustPolicyGates {
  const gates: TrustPolicyGates = {
    test_credit: "not_applicable",
    module_recommendation: "not_applicable",
    unit_kind_canonicalization: "not_applicable",
    validator_weight: "not_applicable",
    artifact_handling: "not_applicable",
  };
  if (subjectType === "passport" || categories.includes("passport_sybil") || categories.includes("reputation_farming")) {
    gates.test_credit = admissionGateForRisk(risk);
  }
  if (subjectType === "module_submitter" || categories.includes("module_spam")) {
    gates.module_recommendation = admissionGateForRisk(risk);
  }
  if (subjectType === "unit_kind" || categories.includes("unit_kind_typosquatting")) {
    gates.unit_kind_canonicalization = admissionGateForRisk(risk);
  }
  if (subjectType === "validator" || categories.includes("validator_collusion")) {
    gates.validator_weight = validatorGateForRisk(risk);
  }
  if (subjectType === "artifact_set" || categories.includes("artifact_tampering") || categories.includes("privacy_leakage")) {
    gates.artifact_handling = artifactGateForRisk(risk);
  }
  return gates;
}

function admissionGateForRisk(risk: TrustRisk): AdmissionGate {
  if (risk === "critical" || risk === "high") {
    return "blocked";
  }
  if (risk === "medium") {
    return "manual_review";
  }
  return "eligible";
}

function validatorGateForRisk(risk: TrustRisk): ValidatorWeightGate {
  if (risk === "critical") {
    return "zeroed";
  }
  if (risk === "high" || risk === "medium") {
    return "capped";
  }
  return "normal";
}

function artifactGateForRisk(risk: TrustRisk): ArtifactHandlingGate {
  if (risk === "critical") {
    return "quarantined";
  }
  if (risk === "high" || risk === "medium") {
    return "manual_review";
  }
  return "accepted";
}

function reviewReason(bucket: DecisionBucket, risk: TrustRisk): string {
  const categories = [...bucket.categories].sort().join(", ");
  const firstDescription = bucket.descriptions[0] ?? "risk signal";
  const upgraded = bucket.medium_count >= 3 && risk === "high" ? " Medium-signal concentration upgraded this subject to high risk." : "";
  return `${risk} risk from ${bucket.risks.length} signal(s): ${categories}. ${firstDescription}.${upgraded}`;
}

function riskFromSeverity(severity: AbuseSeverity): TrustRisk {
  return severity === "info" ? "low" : severity;
}

function aggregateRisk(risks: TrustRisk[], mediumCount: number): TrustRisk {
  let risk: TrustRisk = "low";
  for (const candidate of risks) {
    if (riskRank(candidate) > riskRank(risk)) {
      risk = candidate;
    }
  }
  if (mediumCount >= 3 && riskRank(risk) < riskRank("high")) {
    return "high";
  }
  return risk;
}

function riskRank(risk: TrustRisk): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[risk];
}

function compareDecision(left: TrustPolicyDecision, right: TrustPolicyDecision): number {
  return (
    riskRank(right.risk) - riskRank(left.risk) ||
    left.subject_type.localeCompare(right.subject_type) ||
    left.subject_id.localeCompare(right.subject_id)
  );
}

function validateDecision(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  validateFields(
    value,
    ["subject_type", "subject_id", "risk", "categories", "signal_count", "evidences", "gates", "review_reason"],
    errors,
    path,
    ["dispute_status"],
  );
  if (!SUBJECT_TYPES.has(value.subject_type as TrustSubjectType)) {
    errors.push(`${path}.subject_type is not supported`);
  }
  if (typeof value.subject_id !== "string" || value.subject_id.length === 0) {
    errors.push(`${path}.subject_id must be a non-empty string`);
  }
  if (!RISKS.has(value.risk as TrustRisk)) {
    errors.push(`${path}.risk is not supported`);
  }
  if (!Array.isArray(value.categories) || value.categories.length === 0) {
    errors.push(`${path}.categories must be a non-empty array`);
  } else if (value.categories.some((category) => typeof category !== "string" || !CATEGORIES.has(category as AbuseCategory))) {
    errors.push(`${path}.categories contains an unsupported category`);
  }
  if (typeof value.signal_count !== "number" || !Number.isInteger(value.signal_count) || value.signal_count <= 0) {
    errors.push(`${path}.signal_count must be a positive integer`);
  }
  if (!Array.isArray(value.evidences) || value.evidences.length === 0 || value.evidences.some((item) => typeof item !== "string")) {
    errors.push(`${path}.evidences must be a non-empty array of strings`);
  }
  if (typeof value.review_reason !== "string" || value.review_reason.length === 0) {
    errors.push(`${path}.review_reason must be a non-empty string`);
  }
  validateGates(value.gates, `${path}.gates`, errors);
  if ("dispute_status" in value) {
    if (!DISPUTE_STATUSES.has(value.dispute_status as DisputeStatus)) {
      errors.push(`${path}.dispute_status is not supported`);
    } else if (
      value.dispute_status === "unresolved" &&
      isPlainObject(value.gates) &&
      !Object.values(value.gates).includes("manual_review")
    ) {
      errors.push(`${path}.dispute_status unresolved requires a manual_review gate`);
    }
  }
}

function validateGates(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  validateFields(value, ["test_credit", "module_recommendation", "unit_kind_canonicalization", "validator_weight", "artifact_handling"], errors, path);
  for (const field of ["test_credit", "module_recommendation", "unit_kind_canonicalization"]) {
    if (!ADMISSION_GATES.has(value[field] as AdmissionGate)) {
      errors.push(`${path}.${field} is not supported`);
    }
  }
  if (!VALIDATOR_GATES.has(value.validator_weight as ValidatorWeightGate)) {
    errors.push(`${path}.validator_weight is not supported`);
  }
  if (!ARTIFACT_GATES.has(value.artifact_handling as ArtifactHandlingGate)) {
    errors.push(`${path}.artifact_handling is not supported`);
  }
}

function validateSummary(value: unknown, decisions: unknown[], errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push("summary must be an object");
    return;
  }
  validateFields(value, ["total_subjects", "by_risk_level", "max_risk", "blocked_count", "manual_review_count", "quarantined_count"], errors, "summary");
  if (typeof value.total_subjects !== "number" || !Number.isInteger(value.total_subjects) || value.total_subjects !== decisions.length) {
    errors.push("summary.total_subjects mismatch");
  }
  validateRiskCounts(value.by_risk_level, decisions, errors);
  const typedDecisions = decisions.filter(isPlainObject);
  const maxRisk = typedDecisions.reduce<TrustRisk>(
    (current, decision) => (RISKS.has(decision.risk as TrustRisk) && riskRank(decision.risk as TrustRisk) > riskRank(current) ? (decision.risk as TrustRisk) : current),
    "low",
  );
  if (value.max_risk !== maxRisk) {
    errors.push("summary.max_risk mismatch");
  }
  const expectedBlocked = typedDecisions.filter((decision) => isPlainObject(decision.gates) && Object.values(decision.gates).includes("blocked")).length;
  const expectedManual = typedDecisions.filter(
    (decision) =>
      isPlainObject(decision.gates) &&
      (Object.values(decision.gates).includes("manual_review") || decision.gates.validator_weight === "capped"),
  ).length;
  const expectedQuarantined = typedDecisions.filter(
    (decision) => isPlainObject(decision.gates) && decision.gates.artifact_handling === "quarantined",
  ).length;
  if (value.blocked_count !== expectedBlocked) {
    errors.push("summary.blocked_count mismatch");
  }
  if (value.manual_review_count !== expectedManual) {
    errors.push("summary.manual_review_count mismatch");
  }
  if (value.quarantined_count !== expectedQuarantined) {
    errors.push("summary.quarantined_count mismatch");
  }
}

function validateRiskCounts(value: unknown, decisions: unknown[], errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push("summary.by_risk_level must be an object");
    return;
  }
  validateFields(value, ["critical", "high", "medium", "low"], errors, "summary.by_risk_level");
  const expected: Record<TrustRisk, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const decision of decisions) {
    if (isPlainObject(decision) && RISKS.has(decision.risk as TrustRisk)) {
      expected[decision.risk as TrustRisk] += 1;
    }
  }
  for (const risk of Object.keys(expected) as TrustRisk[]) {
    if (value[risk] !== expected[risk]) {
      errors.push(`summary.by_risk_level.${risk} mismatch`);
    }
  }
}

function validateFields(
  record: Record<string, unknown>,
  requiredFields: string[],
  errors: string[],
  path = "record",
  optionalFields: string[] = [],
): void {
  for (const field of requiredFields) {
    if (!(field in record)) {
      errors.push(`missing field: ${path}.${field}`);
    }
  }
  for (const field of Object.keys(record)) {
    if (!requiredFields.includes(field) && !optionalFields.includes(field)) {
      errors.push(`unknown field: ${path}.${field}`);
    }
  }
}

function normalizeSubject(value: string): string {
  return isAddress(value) ? getAddress(value) : value;
}

function normalizeBytes32(value: string): string {
  return value.startsWith("0x") ? `0x${value.slice(2).toLowerCase()}` : `0x${value.toLowerCase()}`;
}

function isAddress(value: string): boolean {
  return ADDRESS_RE.test(value);
}

function isBytes32(value: string): boolean {
  return BYTES32_RE.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
