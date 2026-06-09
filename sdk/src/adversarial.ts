import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getAddress } from "viem";
import { hashJson } from "./canonical.ts";
import {
  collectPrivacyErrors,
  computeEvidenceId,
  validateEvidenceReport,
  type EvidenceReport,
} from "./evidence.ts";
import { validateAgentPassportRecord, type AgentPassportRecord } from "./passport.ts";
import { validateAgentReputationReport, type AgentReputationReport } from "./reputation.ts";
import { validateUnitKindProposal, validateUnitKindReview, type UnitKindProposal, type UnitKindReview } from "./unit-kind.ts";
import type { IndexedChainEvent } from "./indexer.ts";

export type AbuseSeverity = "critical" | "high" | "medium" | "info";
export type AbuseCategory =
  | "passport_sybil"
  | "reputation_farming"
  | "validator_collusion"
  | "unit_kind_typosquatting"
  | "module_spam"
  | "artifact_tampering"
  | "privacy_leakage";

export interface AbuseSignal {
  severity: AbuseSeverity;
  category: AbuseCategory;
  description: string;
  subjects: string[];
  evidence: string;
}

export interface AbuseThresholds {
  passportSybilMedium: number;
  passportSybilHigh: number;
  moduleSpamBlockWindow: number;
  moduleSpamHigh: number;
  unitKindTyposquattingDistance: number;
  validatorCollusionHigh: number;
}

export interface AbuseReport {
  schema_version: "originagent.evolution.abuse_report.v1";
  generated_at: string;
  thresholds: AbuseThresholds;
  event_count: number;
  artifact_counts: {
    evidence_reports: number;
    agent_passports: number;
    reputation_reports: number;
    unit_kind_proposals: number;
    unit_kind_reviews: number;
  };
  signals: AbuseSignal[];
  high_or_critical_count: number;
  report_hash: string;
}

export interface AbuseValidationResult {
  ok: boolean;
  errors: string[];
  computedHash: string;
}

export interface AdversarialAnalysisInput {
  events: IndexedChainEvent[];
  evidenceReports?: EvidenceReport[];
  agentPassports?: AgentPassportRecord[];
  reputationReports?: AgentReputationReport[];
  unitKindProposals?: UnitKindProposal[];
  unitKindReviews?: UnitKindReview[];
  thresholds?: Partial<AbuseThresholds>;
  generatedAt?: string;
}

export const DEFAULT_ABUSE_THRESHOLDS: AbuseThresholds = {
  passportSybilMedium: 3,
  passportSybilHigh: 5,
  moduleSpamBlockWindow: 100,
  moduleSpamHigh: 5,
  unitKindTyposquattingDistance: 2,
  validatorCollusionHigh: 3,
};

const SCHEMA_VERSION = "originagent.evolution.abuse_report.v1";
const SEVERITIES = new Set<AbuseSeverity>(["critical", "high", "medium", "info"]);
const CATEGORIES = new Set<AbuseCategory>([
  "passport_sybil",
  "reputation_farming",
  "validator_collusion",
  "unit_kind_typosquatting",
  "module_spam",
  "artifact_tampering",
  "privacy_leakage",
]);
const HEX64_RE = /^[0-9a-f]{64}$/;

export function readAbuseReport(path: string): AbuseReport {
  return JSON.parse(readFileSync(path, "utf8")) as AbuseReport;
}

export function writeAbuseReport(report: AbuseReport, path: string): AbuseReport {
  const validation = validateAbuseReport(report);
  if (!validation.ok) {
    throw new Error(`invalid abuse report: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export function computeAbuseReportHash(report: Record<string, unknown>): string {
  const payload = { ...report };
  delete payload.report_hash;
  return hashJson(payload);
}

export function analyzeAdversarialSimulation(input: AdversarialAnalysisInput): AbuseReport {
  const thresholds = { ...DEFAULT_ABUSE_THRESHOLDS, ...(input.thresholds ?? {}) };
  const events = input.events;
  const evidenceReports = input.evidenceReports ?? [];
  const agentPassports = input.agentPassports ?? [];
  const reputationReports = input.reputationReports ?? [];
  const unitKindProposals = input.unitKindProposals ?? [];
  const unitKindReviews = input.unitKindReviews ?? [];
  const signals: AbuseSignal[] = [];

  signals.push(...artifactTamperingSignals(evidenceReports, agentPassports, reputationReports, unitKindProposals, unitKindReviews));
  signals.push(...privacyLeakageSignals({ events, evidenceReports, agentPassports, reputationReports, unitKindProposals, unitKindReviews }));
  signals.push(...passportSybilSignals(events, agentPassports, thresholds));
  signals.push(...moduleSpamSignals(events, thresholds));
  signals.push(...validatorCollusionSignals(evidenceReports, thresholds));
  signals.push(...unitKindTyposquattingSignals(unitKindProposals, unitKindReviews, thresholds));
  signals.push(...reputationFarmingSignals(events, evidenceReports, reputationReports));

  signals.sort((left, right) => severityRank(left.severity) - severityRank(right.severity) || left.category.localeCompare(right.category));
  const report: AbuseReport = {
    schema_version: SCHEMA_VERSION,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    thresholds,
    event_count: events.length,
    artifact_counts: {
      evidence_reports: evidenceReports.length,
      agent_passports: agentPassports.length,
      reputation_reports: reputationReports.length,
      unit_kind_proposals: unitKindProposals.length,
      unit_kind_reviews: unitKindReviews.length,
    },
    signals,
    high_or_critical_count: signals.filter((signal) => signal.severity === "critical" || signal.severity === "high").length,
    report_hash: "",
  };
  report.report_hash = computeAbuseReportHash(report);
  const validation = validateAbuseReport(report);
  if (!validation.ok) {
    throw new Error(`invalid abuse report: ${validation.errors.join("; ")}`);
  }
  return report;
}

export function validateAbuseReport(report: unknown): AbuseValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(report)) {
    return { ok: false, errors: ["abuse report must be an object"], computedHash: "" };
  }
  const required = [
    "schema_version",
    "generated_at",
    "thresholds",
    "event_count",
    "artifact_counts",
    "signals",
    "high_or_critical_count",
    "report_hash",
  ];
  validateFields(report, required, errors);
  if (report.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  }
  if (typeof report.generated_at !== "string" || report.generated_at.length === 0) {
    errors.push("generated_at must be a non-empty string");
  }
  validateThresholds(report.thresholds, errors);
  validateArtifactCounts(report.artifact_counts, errors);
  if (typeof report.event_count !== "number" || !Number.isInteger(report.event_count) || report.event_count < 0) {
    errors.push("event_count must be a non-negative integer");
  }
  if (!Array.isArray(report.signals)) {
    errors.push("signals must be an array");
  } else {
    for (const [index, signal] of report.signals.entries()) {
      validateSignal(signal, `signals[${index}]`, errors);
    }
  }
  const computedHighOrCritical = Array.isArray(report.signals)
    ? report.signals.filter(
        (signal) => isPlainObject(signal) && (signal.severity === "critical" || signal.severity === "high"),
      ).length
    : 0;
  if (
    typeof report.high_or_critical_count !== "number" ||
    !Number.isInteger(report.high_or_critical_count) ||
    report.high_or_critical_count !== computedHighOrCritical
  ) {
    errors.push("high_or_critical_count mismatch");
  }
  if (typeof report.report_hash !== "string" || !HEX64_RE.test(report.report_hash)) {
    errors.push("report_hash must be a lowercase 64-character hex digest");
  }
  errors.push(...collectPrivacyErrors(report));

  let computedHash = "";
  if (errors.length === 0) {
    computedHash = computeAbuseReportHash(report);
    if (computedHash !== report.report_hash) {
      errors.push("report_hash mismatch");
    }
  }
  return { ok: errors.length === 0, errors, computedHash };
}

function artifactTamperingSignals(
  evidenceReports: EvidenceReport[],
  agentPassports: AgentPassportRecord[],
  reputationReports: AgentReputationReport[],
  unitKindProposals: UnitKindProposal[],
  unitKindReviews: UnitKindReview[],
): AbuseSignal[] {
  const signals: AbuseSignal[] = [];
  collectInvalidArtifacts(signals, "evidence_report", evidenceReports, validateEvidenceReport);
  collectInvalidArtifacts(signals, "agent_passport", agentPassports, validateAgentPassportRecord);
  collectInvalidArtifacts(signals, "agent_reputation_report", reputationReports, validateAgentReputationReport);
  collectInvalidArtifacts(signals, "unit_kind_proposal", unitKindProposals, validateUnitKindProposal);
  collectInvalidArtifacts(signals, "unit_kind_review", unitKindReviews, validateUnitKindReview);
  return signals;
}

function privacyLeakageSignals(value: unknown): AbuseSignal[] {
  const errors = collectPrivacyErrors(value);
  if (errors.length === 0) {
    return [];
  }
  return [
    signal(
      "critical",
      "privacy_leakage",
      `privacy scan found ${errors.length} private field or sensitive string issue(s)`,
      ["artifact_inputs"],
      "artifact:privacy_scan:inputs",
    ),
  ];
}

function passportSybilSignals(
  events: IndexedChainEvent[],
  agentPassports: AgentPassportRecord[],
  thresholds: AbuseThresholds,
): AbuseSignal[] {
  const passportsByOwner = new Map<string, Set<string>>();
  for (const event of events) {
    if (event.event_name !== "AgentPassportRegistered") {
      continue;
    }
    addToSet(passportsByOwner, normalizedAddress(event.args.owner), String(event.args.passportId));
  }
  for (const passport of agentPassports) {
    addToSet(passportsByOwner, normalizedAddress(passport.owner), passport.passport_id);
  }

  const signals: AbuseSignal[] = [];
  for (const [owner, passports] of passportsByOwner.entries()) {
    const count = passports.size;
    if (count >= thresholds.passportSybilHigh) {
      signals.push(
        signal("high", "passport_sybil", `owner controls ${count} passports`, [owner, ...passports], `event:AgentPassportRegistered:${owner}`),
      );
    } else if (count >= thresholds.passportSybilMedium) {
      signals.push(
        signal("medium", "passport_sybil", `owner controls ${count} passports`, [owner, ...passports], `event:AgentPassportRegistered:${owner}`),
      );
    }
  }
  return signals;
}

function moduleSpamSignals(events: IndexedChainEvent[], thresholds: AbuseThresholds): AbuseSignal[] {
  const bySubmitter = new Map<string, IndexedChainEvent[]>();
  for (const event of events) {
    if (event.event_name === "ModuleSubmitted") {
      addToArray(bySubmitter, normalizedAddress(event.args.submitter), event);
    }
  }
  const signals: AbuseSignal[] = [];
  for (const [submitter, submitted] of bySubmitter.entries()) {
    submitted.sort((left, right) => left.block_number - right.block_number || left.log_index - right.log_index);
    let maxWindow = 0;
    for (let left = 0, right = 0; right < submitted.length; right += 1) {
      while (submitted[right].block_number - submitted[left].block_number > thresholds.moduleSpamBlockWindow) {
        left += 1;
      }
      maxWindow = Math.max(maxWindow, right - left + 1);
    }
    if (maxWindow >= thresholds.moduleSpamHigh) {
      signals.push(
        signal(
          "high",
          "module_spam",
          `submitter published ${maxWindow} modules inside ${thresholds.moduleSpamBlockWindow} blocks`,
          [submitter],
          `event:ModuleSubmitted:${submitter}`,
        ),
      );
    }
  }
  return signals;
}

function validatorCollusionSignals(evidenceReports: EvidenceReport[], thresholds: AbuseThresholds): AbuseSignal[] {
  const byOperatorGroup = new Map<string, Set<string>>();
  const byRunner = new Map<string, Set<string>>();
  for (const report of evidenceReports) {
    if (report.evidence_type !== "validator_report") {
      continue;
    }
    addToSet(byOperatorGroup, report.operator_group_hash, normalizedAddress(report.reporter));
    addToSet(byRunner, report.runner_fingerprint_hash, normalizedAddress(report.reporter));
  }
  return [
    ...collusionSignals(byOperatorGroup, "operator_group_hash", thresholds),
    ...collusionSignals(byRunner, "runner_fingerprint_hash", thresholds),
  ];
}

function unitKindTyposquattingSignals(
  proposals: UnitKindProposal[],
  reviews: UnitKindReview[],
  thresholds: AbuseThresholds,
): AbuseSignal[] {
  const canonical = new Set<string>(["tool"]);
  for (const review of reviews) {
    if (review.recommended_status === "Canonical") {
      canonical.add(review.kind_id);
    }
  }
  const signals: AbuseSignal[] = [];
  for (const proposal of proposals) {
    for (const canonicalKind of canonical) {
      if (proposal.kind_id === canonicalKind) {
        continue;
      }
      const distance = levenshtein(proposal.kind_id, canonicalKind);
      const contains = proposal.kind_id.includes(canonicalKind) || canonicalKind.includes(proposal.kind_id);
      if (distance <= thresholds.unitKindTyposquattingDistance || contains) {
        signals.push(
          signal(
            "high",
            "unit_kind_typosquatting",
            `${proposal.kind_id}@${proposal.version} resembles canonical kind ${canonicalKind}`,
            [proposal.kind_id, canonicalKind],
            `artifact:unit_kind_proposal:${proposal.kind_id}@${proposal.version}`,
          ),
        );
        break;
      }
    }
  }
  return signals;
}

function reputationFarmingSignals(
  events: IndexedChainEvent[],
  evidenceReports: EvidenceReport[],
  reputationReports: AgentReputationReport[],
): AbuseSignal[] {
  const reporterByEvidenceId = new Map<string, string>();
  for (const report of evidenceReports) {
    try {
      reporterByEvidenceId.set(computeEvidenceId(report), normalizedAddress(report.reporter));
    } catch {
      // Invalid artifacts are reported by artifact_tampering.
    }
  }
  for (const event of events) {
    if (event.event_name === "EvidenceSubmitted") {
      reporterByEvidenceId.set(String(event.args.evidenceId), normalizedAddress(event.args.reporter));
    }
  }
  const challengeById = new Map<string, IndexedChainEvent>();
  for (const event of events) {
    if (event.event_name === "ChallengeSubmitted") {
      challengeById.set(String(event.args.challengeId), event);
    }
  }
  const signals: AbuseSignal[] = [];
  const seen = new Set<string>();
  for (const challenge of challengeById.values()) {
    const challenger = normalizedAddress(challenge.args.challenger);
    const reporter = reporterByEvidenceId.get(String(challenge.args.evidenceId));
    if (reporter && challenger === reporter) {
      const challengeId = String(challenge.args.challengeId);
      seen.add(challengeId);
      signals.push(
        signal(
          "high",
          "reputation_farming",
          "challenge submitter matches the evidence reporter",
          [challenger, challengeId],
          `event:ChallengeSubmitted:${challengeId}`,
        ),
      );
    }
  }
  for (const report of reputationReports) {
    for (const record of report.records) {
      const challenge = challengeById.get(record.source_id);
      if (!challenge || seen.has(record.source_id)) {
        continue;
      }
      const reporter = reporterByEvidenceId.get(String(challenge.args.evidenceId));
      if (reporter && normalizedAddress(report.owner) === reporter) {
        signals.push(
          signal(
            "medium",
            "reputation_farming",
            "reputation report owner is also the challenged evidence reporter",
            [report.owner, record.source_id],
            `event:ChallengeSubmitted:${record.source_id}`,
          ),
        );
      }
    }
  }
  return signals;
}

function collectInvalidArtifacts<T>(
  signals: AbuseSignal[],
  label: string,
  artifacts: T[],
  validate: (artifact: T) => { ok: boolean; errors: string[] },
): void {
  artifacts.forEach((artifact, index) => {
    const validation = validate(artifact);
    if (!validation.ok) {
      signals.push(
        signal(
          "critical",
          "artifact_tampering",
          `${label} ${index} failed validation with ${validation.errors.length} error(s)`,
          [label, String(index)],
          `artifact:${label}:${index}`,
        ),
      );
    }
  });
}

function collusionSignals(
  groups: Map<string, Set<string>>,
  label: string,
  thresholds: AbuseThresholds,
): AbuseSignal[] {
  const signals: AbuseSignal[] = [];
  for (const [group, reporters] of groups.entries()) {
    if (reporters.size >= thresholds.validatorCollusionHigh) {
      signals.push(
        signal(
          "high",
          "validator_collusion",
          `${label} ${group} is reused by ${reporters.size} validator addresses`,
          [group, ...reporters],
          `artifact:evidence_report:${label}:${group}`,
        ),
      );
    }
  }
  return signals;
}

function validateThresholds(value: unknown, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push("thresholds must be an object");
    return;
  }
  for (const field of Object.keys(DEFAULT_ABUSE_THRESHOLDS) as (keyof AbuseThresholds)[]) {
    if (typeof value[field] !== "number" || !Number.isInteger(value[field]) || Number(value[field]) <= 0) {
      errors.push(`thresholds.${field} must be a positive integer`);
    }
  }
}

function validateArtifactCounts(value: unknown, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push("artifact_counts must be an object");
    return;
  }
  for (const field of ["evidence_reports", "agent_passports", "reputation_reports", "unit_kind_proposals", "unit_kind_reviews"]) {
    if (typeof value[field] !== "number" || !Number.isInteger(value[field]) || Number(value[field]) < 0) {
      errors.push(`artifact_counts.${field} must be a non-negative integer`);
    }
  }
}

function validateSignal(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  validateFields(value, ["severity", "category", "description", "subjects", "evidence"], errors, path);
  if (!SEVERITIES.has(value.severity as AbuseSeverity)) {
    errors.push(`${path}.severity is not supported`);
  }
  if (!CATEGORIES.has(value.category as AbuseCategory)) {
    errors.push(`${path}.category is not supported`);
  }
  for (const field of ["description", "evidence"]) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      errors.push(`${path}.${field} must be a non-empty string`);
    }
  }
  if (
    typeof value.evidence === "string" &&
    !value.evidence.startsWith("event:") &&
    !value.evidence.startsWith("artifact:") &&
    !value.evidence.startsWith("derived:")
  ) {
    errors.push(`${path}.evidence must start with event:, artifact:, or derived:`);
  }
  if (!Array.isArray(value.subjects) || value.subjects.length === 0 || value.subjects.some((subject) => typeof subject !== "string")) {
    errors.push(`${path}.subjects must be a non-empty array of strings`);
  }
}

function validateFields(record: Record<string, unknown>, requiredFields: string[], errors: string[], path = "record"): void {
  for (const field of requiredFields) {
    if (!(field in record)) {
      errors.push(`missing field: ${path}.${field}`);
    }
  }
  for (const field of Object.keys(record)) {
    if (!requiredFields.includes(field)) {
      errors.push(`unknown field: ${path}.${field}`);
    }
  }
}

function signal(
  severity: AbuseSeverity,
  category: AbuseCategory,
  description: string,
  subjects: Iterable<string>,
  evidence: string,
): AbuseSignal {
  return {
    severity,
    category,
    description,
    subjects: [...subjects],
    evidence,
  };
}

function severityRank(severity: AbuseSeverity): number {
  return { critical: 0, high: 1, medium: 2, info: 3 }[severity];
}

function normalizedAddress(value: unknown): string {
  try {
    return getAddress(String(value));
  } catch {
    return String(value);
  }
}

function addToSet(map: Map<string, Set<string>>, key: string, value: string): void {
  const existing = map.get(key);
  if (existing) {
    existing.add(value);
    return;
  }
  map.set(key, new Set([value]));
}

function addToArray<T>(map: Map<string, T[]>, key: string, value: T): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
    return;
  }
  map.set(key, [value]);
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const substitution = previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
