import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import type { Address } from "viem";

import { computeAbuseReportHash, DEFAULT_ABUSE_THRESHOLDS, type AbuseReport } from "../src/adversarial.ts";
import { loadDeployment, type ContractName, type DeploymentInfo } from "../src/contracts.ts";
import { createAuditBundle, type IndexedChainEvent } from "../src/indexer.ts";
import {
  computeTestCreditActionHash,
  createTestCreditAction,
  createTestCreditReport,
  validateTestCreditAction,
  validateTestCreditReport,
  type TestCreditAction,
  type TestCreditReport,
} from "../src/test-credit.ts";
import { evaluateTrustPolicy, type TrustPolicyReport } from "../src/trust-policy.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const PASSPORT = `0x${"a".repeat(64)}`;
const OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const TRUST_HASH = "1".repeat(64);
const CREATED_AT = "2026-05-23T00:00:00.000Z";

test("test credit action and report hashes are stable and recomputable", () => {
  const grant = eligibleAction("grant", "passport_bootstrap");
  const consume = eligibleAction("consume", "audit_request_fee");
  const report = createTestCreditReport({
    passportId: PASSPORT,
    owner: OWNER,
    actions: [grant, consume],
  });

  assert.equal(validateTestCreditAction(grant).computedHash, grant.action_hash);
  assert.equal(validateTestCreditReport(report).computedHash, report.report_hash);
  assert.equal(report.granted, 100);
  assert.equal(report.consumed, 5);
  assert.equal(report.balance_delta, 95);
});

test("test credit validation rejects tampering and invalid gates", () => {
  const grant = eligibleAction("grant", "passport_bootstrap");
  const report = createTestCreditReport({ passportId: PASSPORT, owner: OWNER, actions: [grant] });

  const actionCases: TestCreditAction[] = [
    { ...grant, passport_id: `0x${"b".repeat(64)}` },
    { ...grant, owner: "0x7777777777777777777777777777777777777777" },
    { ...grant, amount: 99 },
    { ...grant, gate: "blocked" },
    { ...grant, trust_policy_report_hash: "2".repeat(64) },
    { ...grant, action_hash: "0".repeat(64) },
  ];
  for (const action of actionCases) {
    assert.equal(validateTestCreditAction(action).ok, false);
  }

  const reportCases: TestCreditReport[] = [
    { ...report, passport_id: `0x${"b".repeat(64)}` },
    { ...report, owner: "0x7777777777777777777777777777777777777777" },
    { ...report, granted: 99 },
    { ...report, trust_policy_report_hash: "2".repeat(64) },
    { ...report, report_hash: "0".repeat(64) },
  ];
  for (const candidate of reportCases) {
    assert.equal(validateTestCreditReport(candidate).ok, false);
  }
});

test("test credit supports off-chain challenge bond settlement reasons", () => {
  const lock = eligibleAction("consume", "challenge_bond_lock");
  const consume = eligibleAction("consume", "challenge_bond_consume");
  const oneCreditFee = createTestCreditAction({
    passportId: PASSPORT,
    owner: OWNER,
    action: "consume",
    reason: "challenge_bond_partial_fee",
    amount: 1,
    trustPolicyReportHash: TRUST_HASH,
    createdAt: CREATED_AT,
  });
  const refund = createTestCreditAction({
    passportId: PASSPORT,
    owner: OWNER,
    action: "grant",
    reason: "challenge_bond_refund",
    amount: 9,
    trustPolicyReportHash: TRUST_HASH,
    createdAt: CREATED_AT,
  });

  assert.equal(validateTestCreditAction(lock).ok, true);
  assert.equal(validateTestCreditAction(consume).ok, true);
  assert.equal(validateTestCreditAction(oneCreditFee).ok, true);
  assert.equal(validateTestCreditAction(refund).ok, true);
  assert.equal(validateTestCreditAction({ ...oneCreditFee, amount: 2 }).ok, false);
  assert.equal(validateTestCreditAction({ ...refund, amount: 8 }).ok, false);
});

test("trust policy gate allows eligible actions and requires deny for blocked subjects", () => {
  const cleanPolicy = trustPolicy([]);
  const blockedPolicy = trustPolicy([PASSPORT, OWNER]);
  const grant = createTestCreditAction({
    passportId: PASSPORT,
    owner: OWNER,
    action: "grant",
    reason: "passport_bootstrap",
    trustPolicyReport: cleanPolicy,
    createdAt: CREATED_AT,
  });
  const deny = createTestCreditAction({
    passportId: PASSPORT,
    owner: OWNER,
    action: "deny",
    reason: "blocked_by_trust_policy",
    trustPolicyReport: blockedPolicy,
    createdAt: CREATED_AT,
  });

  assert.equal(grant.gate, "eligible");
  assert.equal(deny.gate, "blocked");
  const wrongTrustHash = { ...grant, trust_policy_report_hash: "2".repeat(64) };
  wrongTrustHash.action_hash = computeTestCreditActionHash(wrongTrustHash);
  assert.equal(validateTestCreditAction(wrongTrustHash, cleanPolicy).ok, false);
  assert.throws(
    () =>
      createTestCreditAction({
        passportId: PASSPORT,
        owner: OWNER,
        action: "grant",
        reason: "passport_bootstrap",
        trustPolicyReport: blockedPolicy,
        createdAt: CREATED_AT,
      }),
    /grant\/consume requires eligible/,
  );
});

test("test credit audit linkage matches grant and consume events but skips deny events", () => {
  const deployment = loadDeployment("local");
  const trust = trustPolicy([]);
  const grant = createTestCreditAction({
    passportId: PASSPORT,
    owner: OWNER,
    action: "grant",
    reason: "passport_bootstrap",
    trustPolicyReport: trust,
    createdAt: CREATED_AT,
  });
  const consume = createTestCreditAction({
    passportId: PASSPORT,
    owner: OWNER,
    action: "consume",
    reason: "audit_request_fee",
    trustPolicyReport: trust,
    createdAt: CREATED_AT,
  });
  const blocked = trustPolicy([PASSPORT]);
  const deny = createTestCreditAction({
    passportId: PASSPORT,
    owner: OWNER,
    action: "deny",
    reason: "blocked_by_trust_policy",
    trustPolicyReport: blocked,
    createdAt: CREATED_AT,
  });
  const cleanReport = createTestCreditReport({ passportId: PASSPORT, owner: OWNER, actions: [grant, consume] });
  const denyReport = createTestCreditReport({ passportId: PASSPORT, owner: OWNER, actions: [deny] });
  const events = [testCreditEvent(deployment, "TestCreditGranted", grant, 1), testCreditEvent(deployment, "TestCreditConsumed", consume, 2)];

  const cleanBundle = createAuditBundle(deployment, events, [], [], [], [], [], [], [], [], undefined, trust, [cleanReport]);
  assert.equal(cleanBundle.ok, true, cleanBundle.errors.join("; "));
  assert.equal(cleanBundle.test_credit_linkage?.length, 2);
  assert.equal(cleanBundle.test_credit_linkage?.every((link) => link.event_matched), true);

  const denyBundle = createAuditBundle(deployment, [], [], [], [], [], [], [], [], [], undefined, blocked, [denyReport]);
  assert.equal(denyBundle.ok, true, denyBundle.errors.join("; "));
  assert.equal(denyBundle.test_credit_linkage?.[0].denied, true);
  assert.equal(denyBundle.test_credit_linkage?.[0].event_found, null);

  const missing = createAuditBundle(deployment, [], [], [], [], [], [], [], [], [], undefined, trust, [cleanReport]);
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join("\n"), /missing TestCreditGranted/);
});

test("test credit CLI creates, validates, and audits reports", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec14-credit-"));
  const actionPath = join(tmp, "grant.json");
  const reportPath = join(tmp, "report.json");
  const eventsPath = join(tmp, "events.jsonl");
  const auditPath = join(tmp, "audit.json");

  execFileSync(
    process.execPath,
    [
      CLI,
      "create-test-credit-action",
      "--passport-id",
      PASSPORT,
      "--owner",
      OWNER,
      "--action",
      "grant",
      "--reason",
      "passport_bootstrap",
      "--trust-policy-report-hash",
      TRUST_HASH,
      "--created-at",
      CREATED_AT,
      "--out",
      actionPath,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  execFileSync(process.execPath, [CLI, "validate-test-credit-action", actionPath], { cwd: ROOT, encoding: "utf8" });
  execFileSync(
    process.execPath,
    [
      CLI,
      "create-test-credit-report",
      "--passport-id",
      PASSPORT,
      "--owner",
      OWNER,
      "--actions",
      actionPath,
      "--out",
      reportPath,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  execFileSync(process.execPath, [CLI, "validate-test-credit-report", reportPath], { cwd: ROOT, encoding: "utf8" });

  const deployment = loadDeployment("local");
  const action = JSON.parse(readFileSync(actionPath, "utf8")) as TestCreditAction;
  writeFileSync(eventsPath, `${JSON.stringify(testCreditEvent(deployment, "TestCreditGranted", action, 1))}\n`);
  const output = execFileSync(
    process.execPath,
    [
      CLI,
      "audit-bundle",
      "--events",
      eventsPath,
      "--test-credit-reports",
      reportPath,
      "--out",
      auditPath,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  const parsed = JSON.parse(output);
  assert.equal(parsed.ok, true, parsed.errors?.join("; "));
  assert.equal(parsed.test_credit_linkage[0].event_matched, true);
});

test("privacy scan rejects sensitive test credit fields and strings", () => {
  const action = eligibleAction("grant", "passport_bootstrap") as TestCreditAction & { prompt: string };
  action.prompt = "private prompt";
  assert.equal(validateTestCreditAction(action).ok, false);
});

function eligibleAction(
  action: "grant" | "consume",
  reason: "passport_bootstrap" | "audit_request_fee" | "challenge_bond_lock" | "challenge_bond_consume",
): TestCreditAction {
  return createTestCreditAction({
    passportId: PASSPORT,
    owner: OWNER,
    action,
    reason,
    trustPolicyReportHash: TRUST_HASH,
    createdAt: CREATED_AT,
  });
}

function trustPolicy(subjects: string[]): TrustPolicyReport {
  const abuse: AbuseReport = {
    schema_version: "originagent.evolution.abuse_report.v1",
    generated_at: CREATED_AT,
    thresholds: DEFAULT_ABUSE_THRESHOLDS,
    event_count: 0,
    artifact_counts: {
      evidence_reports: 0,
      agent_passports: 0,
      reputation_reports: 0,
      unit_kind_proposals: 0,
      unit_kind_reviews: 0,
    },
    signals:
      subjects.length === 0
        ? []
        : [
            {
              severity: "high",
              category: "passport_sybil",
              description: "owner controls too many passports",
              subjects,
              evidence: "derived:test-credit-gate",
            },
          ],
    high_or_critical_count: subjects.length === 0 ? 0 : 1,
    report_hash: "",
  };
  abuse.report_hash = computeAbuseReportHash(abuse);
  return evaluateTrustPolicy({ abuseReport: abuse, generatedAt: CREATED_AT });
}

function testCreditEvent(
  deployment: DeploymentInfo,
  eventName: "TestCreditGranted" | "TestCreditConsumed",
  action: TestCreditAction,
  logIndex: number,
): IndexedChainEvent {
  return {
    schema_version: "originagent.evolution.event.v1",
    chain_id: deployment.chainId,
    network: deployment.network,
    contract: "TestCreditLedger" as ContractName,
    contract_address: deployment.contracts.TestCreditLedger as Address,
    event_name: eventName,
    block_number: logIndex,
    transaction_hash: `0x${String(logIndex).padStart(64, "0")}`,
    log_index: logIndex,
    args: {
      passportId: action.passport_id,
      amount: action.amount,
      actionHash: `0x${action.action_hash}`,
      trustPolicyReportHash: `0x${action.trust_policy_report_hash}`,
      operationIndex: logIndex,
    },
  };
}
