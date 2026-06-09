import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import { computeAbuseReportHash, writeAbuseReport, type AbuseReport, type AbuseSignal } from "../src/adversarial.ts";
import { loadDeployment } from "../src/contracts.ts";
import { createAuditBundle } from "../src/indexer.ts";
import {
  computeTrustPolicyReportHash,
  evaluateTrustPolicy,
  validateTrustPolicyReport,
  writeTrustPolicyReport,
  type TrustPolicyDecision,
} from "../src/trust-policy.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const CREATED_AT = "2026-05-23T00:00:00.000Z";
const OWNER = "0x1111111111111111111111111111111111111111";
const VALIDATOR = "0x2222222222222222222222222222222222222222";
const SUBMITTER = "0x3333333333333333333333333333333333333333";
const PASSPORT_ID = `0x${"a".repeat(64)}`;

test("trust policy maps EC-12 categories into risk gates", () => {
  const report = abuseReport([
    signal("critical", "privacy_leakage", ["artifact_inputs"], "artifact:privacy_scan:inputs"),
    signal("critical", "artifact_tampering", ["unit_kind_proposal", "0"], "artifact:unit_kind_proposal:0"),
    signal("high", "passport_sybil", [OWNER, PASSPORT_ID], `event:AgentPassportRegistered:${OWNER}`),
    signal("high", "reputation_farming", [OWNER, `0x${"b".repeat(64)}`], `event:ChallengeSubmitted:0x${"b".repeat(64)}`),
    signal("high", "validator_collusion", ["c".repeat(64), VALIDATOR], `artifact:evidence_report:operator_group_hash:${"c".repeat(64)}`),
    signal("high", "unit_kind_typosquatting", ["to0l", "tool"], "artifact:unit_kind_proposal:to0l@1"),
    signal("high", "module_spam", [SUBMITTER], `event:ModuleSubmitted:${SUBMITTER}`),
  ]);

  const policy = evaluateTrustPolicy({ abuseReport: report, generatedAt: CREATED_AT });
  assert.equal(validateTrustPolicyReport(policy, report).ok, true, validateTrustPolicyReport(policy, report).errors.join("; "));
  assert.equal(computeTrustPolicyReportHash(policy), policy.report_hash);
  assert.equal(policy.summary.max_risk, "critical");
  assert.equal(policy.summary.by_risk_level.critical, 2);
  assert.equal(policy.summary.by_risk_level.high > 0, true);

  assert.equal(findDecision(policy.decisions, "passport", PASSPORT_ID).gates.test_credit, "blocked");
  assert.equal(findDecision(policy.decisions, "address", OWNER).gates.test_credit, "blocked");
  assert.equal(findDecision(policy.decisions, "validator", VALIDATOR).gates.validator_weight, "capped");
  assert.equal(findDecision(policy.decisions, "unit_kind", "to0l").gates.unit_kind_canonicalization, "blocked");
  assert.equal(findDecision(policy.decisions, "module_submitter", SUBMITTER).gates.module_recommendation, "blocked");
  assert.equal(findDecision(policy.decisions, "artifact_set", "artifact_inputs").gates.artifact_handling, "quarantined");
  assert.equal(policy.decisions.every((decision) => decision.review_reason.length > 0), true);
});

test("trust policy keeps medium in manual review and escalates repeated medium signals", () => {
  const medium = evaluateTrustPolicy({
    abuseReport: abuseReport([signal("medium", "passport_sybil", [OWNER, PASSPORT_ID], `event:AgentPassportRegistered:${OWNER}`)]),
    generatedAt: CREATED_AT,
  });
  assert.equal(findDecision(medium.decisions, "address", OWNER).risk, "medium");
  assert.equal(findDecision(medium.decisions, "address", OWNER).gates.test_credit, "manual_review");

  const escalated = evaluateTrustPolicy({
    abuseReport: abuseReport([
      signal("medium", "reputation_farming", [OWNER, `0x${"1".repeat(64)}`], `event:ChallengeSubmitted:0x${"1".repeat(64)}`),
      signal("medium", "reputation_farming", [OWNER, `0x${"2".repeat(64)}`], `event:ChallengeSubmitted:0x${"2".repeat(64)}`),
      signal("medium", "reputation_farming", [OWNER, `0x${"3".repeat(64)}`], `event:ChallengeSubmitted:0x${"3".repeat(64)}`),
    ]),
    generatedAt: CREATED_AT,
  });
  assert.equal(findDecision(escalated.decisions, "address", OWNER).risk, "high");
  assert.equal(findDecision(escalated.decisions, "address", OWNER).gates.test_credit, "blocked");
});

test("trust policy validation rejects tampering, source mismatch, and private fields", () => {
  const source = abuseReport([signal("high", "module_spam", [SUBMITTER], `event:ModuleSubmitted:${SUBMITTER}`)]);
  const policy = evaluateTrustPolicy({ abuseReport: source, generatedAt: CREATED_AT });

  assert.equal(validateTrustPolicyReport({ ...policy, report_hash: "0".repeat(64) }).ok, false);
  assert.equal(validateTrustPolicyReport({ ...policy, source_abuse_report_hash: "1".repeat(64) }, source).ok, false);
  assert.equal(validateTrustPolicyReport({ ...policy, summary: { ...policy.summary, total_subjects: 99 } }).ok, false);
  assert.equal(validateTrustPolicyReport({ ...policy, prompt: "private" }).ok, false);
});

test("trust policy accepts unresolved dispute status without changing admission gates", () => {
  const source = abuseReport([signal("medium", "passport_sybil", [OWNER, PASSPORT_ID], `event:AgentPassportRegistered:${OWNER}`)]);
  const policy = evaluateTrustPolicy({ abuseReport: source, generatedAt: CREATED_AT });
  const decision = findDecision(policy.decisions, "address", OWNER);
  decision.dispute_status = "unresolved";
  policy.report_hash = computeTrustPolicyReportHash(policy);

  assert.equal(decision.gates.test_credit, "manual_review");
  assert.equal(validateTrustPolicyReport(policy, source).ok, true, validateTrustPolicyReport(policy, source).errors.join("; "));

  const badGate = structuredClone(policy);
  badGate.decisions[0].gates.test_credit = "unresolved_dispute" as never;
  badGate.report_hash = computeTrustPolicyReportHash(badGate);
  assert.equal(validateTrustPolicyReport(badGate, source).ok, false);

  const badDispute = structuredClone(policy);
  badDispute.decisions[0].dispute_status = "unresolved";
  badDispute.decisions[0].gates.test_credit = "eligible";
  badDispute.report_hash = computeTrustPolicyReportHash(badDispute);
  assert.equal(validateTrustPolicyReport(badDispute, source).ok, false);
});

test("audit bundle includes trust policy summary without embedding full report", () => {
  const source = abuseReport([signal("high", "unit_kind_typosquatting", ["to0l", "tool"], "artifact:unit_kind_proposal:to0l@1")]);
  const policy = evaluateTrustPolicy({ abuseReport: source, generatedAt: CREATED_AT });
  const bundle = createAuditBundle(loadDeployment("local"), [], [], [], [], [], [], [], [], [], source, policy);

  assert.equal(bundle.ok, true, bundle.errors.join("; "));
  assert.equal(bundle.trust_policy_summary?.report_hash, policy.report_hash);
  assert.equal(bundle.trust_policy_summary?.total_subjects, policy.summary.total_subjects);
  assert.equal("decisions" in (bundle.trust_policy_summary ?? {}), false);
});

test("trust policy CLI evaluates and validates reports", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec13-trust-policy-"));
  const abusePath = join(tmp, "abuse-report.json");
  const otherAbusePath = join(tmp, "other-abuse-report.json");
  const outPath = join(tmp, "trust-policy-report.json");
  writeAbuseReport(abuseReport([signal("high", "module_spam", [SUBMITTER], `event:ModuleSubmitted:${SUBMITTER}`)]), abusePath);
  writeAbuseReport(abuseReport([signal("medium", "passport_sybil", [OWNER, PASSPORT_ID], `event:AgentPassportRegistered:${OWNER}`)]), otherAbusePath);

  const output = execFileSync(
    process.execPath,
    [CLI, "evaluate-trust-policy", "--abuse-report", abusePath, "--generated-at", CREATED_AT, "--out", outPath],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(JSON.parse(output).summary.max_risk, "high");
  assert.equal(JSON.parse(readFileSync(outPath, "utf8")).report_hash, JSON.parse(output).report_hash);

  const valid = JSON.parse(
    execFileSync(process.execPath, [CLI, "validate-trust-policy-report", outPath, "--source-abuse-report", abusePath], {
      cwd: ROOT,
      encoding: "utf8",
    }),
  );
  assert.equal(valid.ok, true, valid.errors.join("; "));

  const mismatch = spawnSync(process.execPath, [CLI, "validate-trust-policy-report", outPath, "--source-abuse-report", otherAbusePath], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.notEqual(mismatch.status, 0);
  assert.match(JSON.parse(mismatch.stdout).errors.join("\n"), /source_abuse_report_hash mismatch/);
});

function abuseReport(signals: AbuseSignal[]): AbuseReport {
  const report: AbuseReport = {
    schema_version: "originagent.evolution.abuse_report.v1",
    generated_at: CREATED_AT,
    thresholds: {
      passportSybilMedium: 3,
      passportSybilHigh: 5,
      moduleSpamBlockWindow: 100,
      moduleSpamHigh: 5,
      unitKindTyposquattingDistance: 2,
      validatorCollusionHigh: 3,
    },
    event_count: 0,
    artifact_counts: {
      evidence_reports: 0,
      agent_passports: 0,
      reputation_reports: 0,
      unit_kind_proposals: 0,
      unit_kind_reviews: 0,
    },
    signals,
    high_or_critical_count: signals.filter((item) => item.severity === "high" || item.severity === "critical").length,
    report_hash: "",
  };
  report.report_hash = computeAbuseReportHash(report);
  return report;
}

function signal(severity: AbuseSignal["severity"], category: AbuseSignal["category"], subjects: string[], evidence: string): AbuseSignal {
  return {
    severity,
    category,
    description: `${category} detected`,
    subjects,
    evidence,
  };
}

function findDecision(decisions: TrustPolicyDecision[], subjectType: TrustPolicyDecision["subject_type"], subjectId: string): TrustPolicyDecision {
  const normalized = subjectId.startsWith("0x") && subjectId.length === 66 ? subjectId.toLowerCase() : subjectId;
  const decision = decisions.find(
    (item) => item.subject_type === subjectType && (item.subject_id === subjectId || item.subject_id.toLowerCase() === normalized),
  );
  assert.ok(decision, `missing decision for ${subjectType}:${subjectId}`);
  return decision;
}
