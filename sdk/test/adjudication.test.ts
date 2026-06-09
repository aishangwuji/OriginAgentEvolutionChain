import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import type { Address } from "viem";

import {
  computeVerdictCommitmentHash,
  createAdjudicationReport,
  createChallengeResponse,
  createValidatorVerdict,
  createValidatorVerdictCommitment,
  createValidatorVerdictReveal,
  validateAdjudicationReport,
  validateChallengeResponse,
  validateValidatorVerdict,
  validateValidatorVerdictCommitment,
  validateValidatorVerdictReveal,
  type AdjudicationReport,
  type AdjudicationReportV1,
  type AdjudicationReportV2,
  type ChallengeResponse,
  type ValidatorVerdict,
  type ValidatorVerdictCommitment,
  type ValidatorVerdictReveal,
} from "../src/adjudication.ts";
import { loadDeployment, type ContractName, type DeploymentInfo } from "../src/contracts.ts";
import { createAuditBundle, type IndexedChainEvent } from "../src/indexer.ts";
import { createTestCreditAction, createTestCreditReport } from "../src/test-credit.ts";
import {
  commitValidatorVerdictTransaction,
  expireChallengeNoQuorumTransaction,
  finalizeChallengeAdjudicationTransaction,
  revealValidatorVerdictTransaction,
  submitChallengeResponseTransaction,
} from "../src/transactions.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const CHALLENGE = `0x${"1".repeat(64)}`;
const EVIDENCE = `0x${"2".repeat(64)}`;
const RESPONDENT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const VALIDATOR = "0x6666666666666666666666666666666666666666";
const RESPONSE_HASH = `0x${"3".repeat(64)}`;
const VERDICT_HASH_1 = `0x${"4".repeat(64)}`;
const VERDICT_HASH_2 = `0x${"5".repeat(64)}`;
const VERDICT_HASH_3 = `0x${"6".repeat(64)}`;
const METHOD_HASH = `0x${"7".repeat(64)}`;
const FINAL_REPORT_HASH = `0x${"8".repeat(64)}`;
const EXPIRATION_REPORT_HASH = `0x${"9".repeat(64)}`;
const SALT_1 = `0x${"a".repeat(64)}`;
const SALT_2 = `0x${"b".repeat(64)}`;
const SALT_3 = `0x${"c".repeat(64)}`;
const CREATED_AT = "2026-05-24T00:00:00.000Z";
const RESPONSE_BY = "2026-05-25T00:00:00.000Z";
const COMMIT_BY = "2026-05-28T00:00:00.000Z";
const REVEAL_BY = "2026-05-29T00:00:00.000Z";

test("adjudication artifacts compute stable hashes and reject tampering", () => {
  const response = responseRecord();
  const verdict = verdictRecord(VERDICT_HASH_1);
  const reveal = revealRecord(VERDICT_HASH_1, VALIDATOR, SALT_1);
  const commitment = commitmentRecord(reveal);
  const report = reportRecord();
  const finalizedReport = finalizedReportV2Record();
  const expiredReport = expiredReportV2Record();

  assert.equal(validateChallengeResponse(response).computedHash, response.record_hash);
  assert.equal(validateValidatorVerdict(verdict).computedHash, verdict.record_hash);
  assert.equal(validateValidatorVerdictReveal(reveal).computedHash, reveal.record_hash);
  assert.equal(validateValidatorVerdictCommitment(commitment).computedHash, commitment.record_hash);
  assert.equal(validateAdjudicationReport(report).computedHash, report.report_hash);
  assert.equal(validateAdjudicationReport(finalizedReport).computedHash, finalizedReport.report_hash);
  assert.equal(validateAdjudicationReport(expiredReport).computedHash, expiredReport.report_hash);
  assert.equal(
    reveal.commitment_hash,
    computeVerdictCommitmentHash({
      challengeId: CHALLENGE,
      validator: VALIDATOR,
      claimedUpheld: true,
      verdictHash: VERDICT_HASH_1,
      methodHash: METHOD_HASH,
      salt: SALT_1,
    }),
  );

  const responseCases: ChallengeResponse[] = [
    { ...response, challenge_id: `0x${"a".repeat(64)}` },
    { ...response, response_hash: `0x${"b".repeat(64)}` },
    { ...response, record_hash: "0".repeat(64) },
  ];
  for (const candidate of responseCases) {
    assert.equal(validateChallengeResponse(candidate).ok, false);
  }

  const verdictCases: ValidatorVerdict[] = [
    { ...verdict, challenge_id: `0x${"a".repeat(64)}` },
    { ...verdict, claimed_upheld: false },
    { ...verdict, verdict_hash: `0x${"b".repeat(64)}` },
    { ...verdict, method_hash: `0x${"c".repeat(64)}` },
    { ...verdict, record_hash: "0".repeat(64) },
  ];
  for (const candidate of verdictCases) {
    assert.equal(validateValidatorVerdict(candidate).ok, false);
  }

  const revealCases: ValidatorVerdictReveal[] = [
    { ...reveal, challenge_id: `0x${"a".repeat(64)}` },
    { ...reveal, claimed_upheld: false },
    { ...reveal, verdict_hash: `0x${"b".repeat(64)}` },
    { ...reveal, method_hash: `0x${"c".repeat(64)}` },
    { ...reveal, salt: `0x${"d".repeat(64)}` },
    { ...reveal, record_hash: "0".repeat(64) },
  ];
  for (const candidate of revealCases) {
    assert.equal(validateValidatorVerdictReveal(candidate).ok, false);
  }

  const reportCases: AdjudicationReportV1[] = [
    { ...report, challenge_id: `0x${"a".repeat(64)}` },
    { ...report, claimed_upheld: false },
    { ...report, final_report_hash: `0x${"b".repeat(64)}` },
    { ...report, report_hash: "0".repeat(64) },
  ];
  for (const candidate of reportCases) {
    assert.equal(validateAdjudicationReport(candidate).ok, false);
  }

  const finalizedCases: AdjudicationReportV2[] = [
    { ...finalizedReport, claimed_upheld: false },
    { ...finalizedReport, final_report_hash: `0x${"b".repeat(64)}` },
    { ...finalizedReport, effective_verdict_count: 1 },
    { ...finalizedReport, report_hash: "0".repeat(64) },
  ];
  for (const candidate of finalizedCases) {
    assert.equal(validateAdjudicationReport(candidate).ok, false);
  }
});

test("adjudication audit linkage checks event presence and hash consistency without recomputing quorum", () => {
  const deployment = loadDeployment("local");
  const report = reportRecord();
  const events = adjudicationEvents(deployment, report);
  const bundle = createAuditBundle(deployment, events, [], [], [], [], [], [], [], [], undefined, undefined, [], [report]);

  assert.equal(bundle.ok, true, bundle.errors.join("; "));
  assert.equal(bundle.adjudication_linkage?.[0].verdict_events_matched, true);
  assert.equal(bundle.adjudication_linkage?.[0].final_report_matched, true);
  assert.match(bundle.notes.join("\n"), /does not recompute quorum/);
  assert.match(bundle.notes.join("\n"), /validate-validator-verdict and validate-challenge-response/);

  const missingVerdict = createAuditBundle(
    deployment,
    events.filter((event) => event.event_name !== "ValidatorVerdictSubmitted"),
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    undefined,
    undefined,
    [],
    [report],
  );
  assert.equal(missingVerdict.ok, false);
  assert.match(missingVerdict.errors.join("\n"), /missing ValidatorVerdictSubmitted/);

  const wrongOutcome = createAuditBundle(
    deployment,
    events.map((event) =>
      event.event_name === "ChallengeAdjudicationFinalized"
        ? { ...event, args: { ...event.args, claimedUpheld: false } }
        : event,
    ),
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    undefined,
    undefined,
    [],
    [report],
  );
  assert.equal(wrongOutcome.ok, false);
  assert.match(wrongOutcome.errors.join("\n"), /outcome mismatch/);
});

test("adjudication v2 audit checks commit reveal finalized and expired paths", () => {
  const deployment = loadDeployment("local");
  const finalized = finalizedReportV2Record();
  const expired = expiredReportV2Record();
  const finalizedBundle = createAuditBundle(
    deployment,
    adjudicationEventsV2(deployment, finalized),
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    undefined,
    undefined,
    [challengeBondReport()],
    [finalized],
  );
  assert.equal(finalizedBundle.ok, true, finalizedBundle.errors.join("; "));
  assert.equal(finalizedBundle.adjudication_linkage?.[0].phase_event_found, true);
  assert.equal(finalizedBundle.adjudication_linkage?.[0].commit_events_matched, true);
  assert.equal(finalizedBundle.adjudication_linkage?.[0].reveal_events_matched, true);
  assert.equal(finalizedBundle.adjudication_linkage?.[0].finalize_event_found, true);
  assert.match(finalizedBundle.notes.join("\n"), /does not use operatorGroupHash or runnerFingerprintHash/);

  const expiredBundle = createAuditBundle(
    deployment,
    adjudicationEventsV2(deployment, expired),
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    undefined,
    undefined,
    [challengeBondReport()],
    [expired],
  );
  assert.equal(expiredBundle.ok, true, expiredBundle.errors.join("; "));
  assert.equal(expiredBundle.adjudication_linkage?.[0].expire_event_found, true);
  assert.equal(expiredBundle.adjudication_linkage?.[0].expiration_report_matched, true);
});

test("adjudication v2 audit fails on missing bond or event mismatches", () => {
  const deployment = loadDeployment("local");
  const report = finalizedReportV2Record();
  const events = adjudicationEventsV2(deployment, report);
  const bond = challengeBondReport();

  const missingBond = createAuditBundle(deployment, events, [], [], [], [], [], [], [], [], undefined, undefined, [], [report]);
  assert.equal(missingBond.ok, false);
  assert.match(missingBond.errors.join("\n"), /missing challenge_bond_lock/);

  const deadlineMismatch = createAuditBundle(
    deployment,
    events.map((event) =>
      event.event_name === "AdjudicationPhaseStarted"
        ? { ...event, args: { ...event.args, revealBy: 99 } }
        : event,
    ),
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    undefined,
    undefined,
    [bond],
    [report],
  );
  assert.equal(deadlineMismatch.ok, false);
  assert.match(deadlineMismatch.errors.join("\n"), /deadline mismatch/);

  const commitMismatch = createAuditBundle(
    deployment,
    events.filter((event) => event.event_name !== "ValidatorVerdictCommitted"),
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    undefined,
    undefined,
    [bond],
    [report],
  );
  assert.equal(commitMismatch.ok, false);
  assert.match(commitMismatch.errors.join("\n"), /missing ValidatorVerdictCommitted/);

  const revealMismatch = createAuditBundle(
    deployment,
    events.filter((event) => event.event_name !== "ValidatorVerdictRevealed"),
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    undefined,
    undefined,
    [bond],
    [report],
  );
  assert.equal(revealMismatch.ok, false);
  assert.match(revealMismatch.errors.join("\n"), /missing ValidatorVerdictRevealed/);

  const finalizeMismatch = createAuditBundle(
    deployment,
    events.filter((event) => event.event_name !== "ChallengeAdjudicationFinalized"),
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    undefined,
    undefined,
    [bond],
    [report],
  );
  assert.equal(finalizeMismatch.ok, false);
  assert.match(finalizeMismatch.errors.join("\n"), /missing ChallengeAdjudicationFinalized/);

  const expired = expiredReportV2Record();
  const expireMismatch = createAuditBundle(
    deployment,
    adjudicationEventsV2(deployment, expired).filter((event) => event.event_name !== "ChallengeAdjudicationExpiredNoQuorum"),
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    undefined,
    undefined,
    [bond],
    [expired],
  );
  assert.equal(expireMismatch.ok, false);
  assert.match(expireMismatch.errors.join("\n"), /missing ChallengeAdjudicationExpiredNoQuorum/);
});

test("adjudication CLI creates, validates, submits dry-runs, and audits reports", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec15a-adjudication-"));
  const responsePath = join(tmp, "response.json");
  const verdictPath = join(tmp, "verdict.json");
  const reportPath = join(tmp, "report.json");
  const reportV2Path = join(tmp, "report-v2.json");
  const eventsPath = join(tmp, "events.jsonl");
  const auditPath = join(tmp, "audit.json");

  execFileSync(
    process.execPath,
    [
      CLI,
      "create-challenge-response",
      "--challenge-id",
      CHALLENGE,
      "--evidence-id",
      EVIDENCE,
      "--respondent",
      RESPONDENT,
      "--response-hash",
      RESPONSE_HASH,
      "--created-at",
      CREATED_AT,
      "--out",
      responsePath,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  execFileSync(process.execPath, [CLI, "validate-challenge-response", responsePath], { cwd: ROOT, encoding: "utf8" });
  execFileSync(
    process.execPath,
    [
      CLI,
      "create-validator-verdict",
      "--challenge-id",
      CHALLENGE,
      "--validator",
      VALIDATOR,
      "--claimed-upheld",
      "true",
      "--verdict-hash",
      VERDICT_HASH_1,
      "--method-hash",
      METHOD_HASH,
      "--created-at",
      CREATED_AT,
      "--out",
      verdictPath,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  execFileSync(process.execPath, [CLI, "validate-validator-verdict", verdictPath], { cwd: ROOT, encoding: "utf8" });
  execFileSync(
    process.execPath,
    [
      CLI,
      "create-adjudication-report",
      "--challenge-id",
      CHALLENGE,
      "--claimed-upheld",
      "true",
      "--final-report-hash",
      FINAL_REPORT_HASH,
      "--quorum",
      "3",
      "--effective-verdict-count",
      "3",
      "--response-hashes",
      RESPONSE_HASH,
      "--verdict-hashes",
      VERDICT_HASH_1,
      VERDICT_HASH_2,
      VERDICT_HASH_3,
      "--finalized-at",
      CREATED_AT,
      "--out",
      reportPath,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  execFileSync(process.execPath, [CLI, "validate-adjudication-report", reportPath], { cwd: ROOT, encoding: "utf8" });
  const reportV2 = finalizedReportV2Record();
  execFileSync(
    process.execPath,
    [
      CLI,
      "create-adjudication-report",
      "--phase",
      "finalized",
      "--challenge-id",
      reportV2.challenge_id,
      "--claimed-upheld",
      "true",
      "--final-report-hash",
      FINAL_REPORT_HASH,
      "--quorum",
      "3",
      "--effective-verdict-count",
      "3",
      "--response-hashes",
      RESPONSE_HASH,
      "--commitment-hashes",
      ...reportV2.commitment_hashes,
      "--revealed-verdict-hashes",
      ...reportV2.revealed_verdict_hashes,
      "--unrevealed-commitment-count",
      "0",
      "--response-by",
      RESPONSE_BY,
      "--commit-by",
      COMMIT_BY,
      "--reveal-by",
      REVEAL_BY,
      "--finalized-at",
      CREATED_AT,
      "--out",
      reportV2Path,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  execFileSync(process.execPath, [CLI, "validate-adjudication-report", reportV2Path], { cwd: ROOT, encoding: "utf8" });

  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "submit-challenge-response", "--response", responsePath], { cwd: ROOT, encoding: "utf8" })).contract, "ChallengeAdjudicationRegistry");
  let legacySubmitOutput = "";
  try {
    execFileSync(process.execPath, [CLI, "submit-validator-verdict", "--verdict", verdictPath], { cwd: ROOT, encoding: "utf8" });
  } catch (error) {
    legacySubmitOutput = String((error as { stdout?: string }).stdout ?? "");
  }
  assert.match(legacySubmitOutput, /legacy EC-15A helper/);
  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "finalize-challenge-adjudication", "--report", reportV2Path], { cwd: ROOT, encoding: "utf8" })).method, "finalizeChallenge");

  const deployment = loadDeployment("local");
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as AdjudicationReport;
  writeFileSync(eventsPath, `${adjudicationEvents(deployment, report).map((event) => JSON.stringify(event)).join("\n")}\n`);
  const audit = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "audit-bundle",
        "--events",
        eventsPath,
        "--adjudication-reports",
        reportPath,
        "--out",
        auditPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  );
  assert.equal(audit.ok, true, audit.errors?.join("; "));
  assert.equal(audit.adjudication_linkage[0].finalize_event_found, true);
});

test("adjudication dry-run transactions use optional registry only when present", async () => {
  const response = responseRecord();
  const reveal = revealRecord(VERDICT_HASH_1, VALIDATOR, SALT_1);
  const commitment = commitmentRecord(reveal);
  const finalizedReport = finalizedReportV2Record();
  const expiredReport = expiredReportV2Record();
  const submittedResponse = await submitChallengeResponseTransaction(response, { network: "local", dryRun: true });
  const committed = await commitValidatorVerdictTransaction(commitment, { network: "local", dryRun: true });
  const revealed = await revealValidatorVerdictTransaction(reveal, { network: "local", dryRun: true });
  const finalized = await finalizeChallengeAdjudicationTransaction(finalizedReport, { network: "local", dryRun: true });
  const expired = await expireChallengeNoQuorumTransaction(expiredReport, { network: "local", dryRun: true });

  assert.equal(submittedResponse.target, "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa");
  assert.equal(committed.method, "commitVerdict");
  assert.equal(revealed.method, "revealVerdict");
  assert.equal(finalized.method, "finalizeChallenge");
  assert.equal(expired.method, "expireChallengeNoQuorum");

  const deploymentsDir = mkdtempSync(join(tmpdir(), "ec15a-deployments-"));
  writeFileSync(
    join(deploymentsDir, "local.json"),
    JSON.stringify({
      chainId: 31337,
      network: "local",
      contracts: {
        IdentityRegistry: "0x1111111111111111111111111111111111111111",
        AgentPassportRegistry: "0x6666666666666666666666666666666666666666",
        ModuleRegistry: "0x9999999999999999999999999999999999999999",
        VerificationRegistry: "0x3333333333333333333333333333333333333333",
        ScoreCommitReveal: "0x4444444444444444444444444444444444444444",
      },
      deployer: "0x5555555555555555555555555555555555555555",
      deployedAt: "test",
      contractVersion: "ec14.0.0",
    }),
  );
  await assert.rejects(
    () => commitValidatorVerdictTransaction(commitment, { network: "local", deploymentsDir, dryRun: true }),
    /ChallengeAdjudicationRegistry not found/,
  );
});

test("adjudication privacy scan rejects sensitive fields and strings", () => {
  const response = responseRecord() as ChallengeResponse & { prompt: string };
  response.prompt = "private prompt";
  assert.equal(validateChallengeResponse(response).ok, false);
});

function responseRecord(): ChallengeResponse {
  return createChallengeResponse({
    challengeId: CHALLENGE,
    evidenceId: EVIDENCE,
    respondent: RESPONDENT,
    responseHash: RESPONSE_HASH,
    createdAt: CREATED_AT,
  });
}

function verdictRecord(verdictHash: string): ValidatorVerdict {
  return createValidatorVerdict({
    challengeId: CHALLENGE,
    validator: VALIDATOR,
    claimedUpheld: true,
    verdictHash,
    methodHash: METHOD_HASH,
    createdAt: CREATED_AT,
  });
}

function revealRecord(verdictHash: string, validator: string, salt: string): ValidatorVerdictReveal {
  return createValidatorVerdictReveal({
    challengeId: CHALLENGE,
    validator,
    claimedUpheld: true,
    verdictHash,
    methodHash: METHOD_HASH,
    salt,
    createdAt: CREATED_AT,
  });
}

function commitmentRecord(reveal: ValidatorVerdictReveal): ValidatorVerdictCommitment {
  return createValidatorVerdictCommitment({
    challengeId: reveal.challenge_id,
    validator: reveal.validator,
    commitmentHash: reveal.commitment_hash,
    createdAt: CREATED_AT,
  });
}

function revealRecords(): ValidatorVerdictReveal[] {
  return [
    revealRecord(VERDICT_HASH_1, VALIDATOR, SALT_1),
    revealRecord(VERDICT_HASH_2, "0x7777777777777777777777777777777777777777", SALT_2),
    revealRecord(VERDICT_HASH_3, "0x8888888888888888888888888888888888888888", SALT_3),
  ];
}

function reportRecord(): AdjudicationReportV1 {
  return createAdjudicationReport({
    challengeId: CHALLENGE,
    claimedUpheld: true,
    finalReportHash: FINAL_REPORT_HASH,
    quorum: 3,
    effectiveVerdictCount: 3,
    responseHashes: [RESPONSE_HASH],
    verdictHashes: [VERDICT_HASH_1, VERDICT_HASH_2, VERDICT_HASH_3],
    finalizedAt: CREATED_AT,
  });
}

function finalizedReportV2Record(): AdjudicationReportV2 {
  const reveals = revealRecords();
  return createAdjudicationReport({
    challengeId: CHALLENGE,
    phase: "finalized",
    claimedUpheld: true,
    finalReportHash: FINAL_REPORT_HASH,
    quorum: 3,
    effectiveVerdictCount: 3,
    responseHashes: [RESPONSE_HASH],
    commitmentHashes: reveals.map((reveal) => reveal.commitment_hash),
    revealedVerdictHashes: reveals.map((reveal) => reveal.verdict_hash),
    unrevealedCommitmentCount: 0,
    responseBy: RESPONSE_BY,
    commitBy: COMMIT_BY,
    revealBy: REVEAL_BY,
    finalizedAt: CREATED_AT,
  });
}

function expiredReportV2Record(): AdjudicationReportV2 {
  const reveals = revealRecords().slice(0, 1);
  return createAdjudicationReport({
    challengeId: CHALLENGE,
    phase: "expired_no_quorum",
    expirationReportHash: EXPIRATION_REPORT_HASH,
    quorum: 3,
    effectiveVerdictCount: 1,
    responseHashes: [RESPONSE_HASH],
    commitmentHashes: reveals.map((reveal) => reveal.commitment_hash),
    revealedVerdictHashes: reveals.map((reveal) => reveal.verdict_hash),
    unrevealedCommitmentCount: 0,
    responseBy: RESPONSE_BY,
    commitBy: COMMIT_BY,
    revealBy: REVEAL_BY,
    expiredAt: CREATED_AT,
  });
}

function challengeBondReport() {
  const lock = createTestCreditAction({
    passportId: `0x${"d".repeat(64)}`,
    owner: RESPONDENT,
    action: "consume",
    reason: "challenge_bond_lock",
    trustPolicyReportHash: "1".repeat(64),
    createdAt: CREATED_AT,
  });
  const refund = createTestCreditAction({
    passportId: lock.passport_id,
    owner: lock.owner,
    action: "grant",
    reason: "challenge_bond_refund",
    trustPolicyReportHash: "1".repeat(64),
    createdAt: CREATED_AT,
  });
  return createTestCreditReport({
    passportId: lock.passport_id,
    owner: lock.owner,
    actions: [lock, refund],
  });
}

function adjudicationEventsV2(deployment: DeploymentInfo, report: AdjudicationReportV2): IndexedChainEvent[] {
  const reveals = revealRecords();
  const relevantReveals = report.revealed_verdict_hashes.map((verdictHash) =>
    reveals.find((reveal) => reveal.verdict_hash === verdictHash) ?? revealRecords()[0],
  );
  const events = [
    event(deployment, "ChallengeAdjudicationRegistry", "ChallengeResponseSubmitted", 1, {
      challengeId: report.challenge_id,
      evidenceId: EVIDENCE,
      respondent: RESPONDENT,
      responseHash: RESPONSE_HASH,
      responseSubmittedAt: Date.parse(CREATED_AT) / 1000,
    }),
    event(deployment, "ChallengeAdjudicationRegistry", "AdjudicationPhaseStarted", 2, {
      challengeId: report.challenge_id,
      commitStart: Date.parse(CREATED_AT) / 1000,
      responseBy: Date.parse(report.response_by) / 1000,
      commitBy: Date.parse(report.commit_by) / 1000,
      revealBy: Date.parse(report.reveal_by) / 1000,
    }),
    ...report.commitment_hashes.map((commitmentHash, index) =>
      event(deployment, "ChallengeAdjudicationRegistry", "ValidatorVerdictCommitted", 3 + index, {
        challengeId: report.challenge_id,
        validator: reveals[index]?.validator ?? VALIDATOR,
        commitmentHash,
      }),
    ),
    ...relevantReveals.map((reveal, index) =>
      event(deployment, "ChallengeAdjudicationRegistry", "ValidatorVerdictRevealed", 6 + index, {
        challengeId: report.challenge_id,
        validator: reveal.validator,
        claimedUpheld: reveal.claimed_upheld,
        verdictHash: reveal.verdict_hash,
        methodHash: reveal.method_hash,
        operatorGroupHash: `0x${String(index + 4).repeat(64)}`,
        runnerFingerprintHash: `0x${String(index + 7).repeat(64)}`,
      }),
    ),
  ];
  if (report.phase === "finalized") {
    events.push(event(deployment, "ChallengeAdjudicationRegistry", "ChallengeAdjudicationFinalized", 10, {
      challengeId: report.challenge_id,
      claimedUpheld: report.claimed_upheld,
      finalReportHash: report.final_report_hash,
      finalizer: RESPONDENT,
      effectiveVerdictCount: report.effective_verdict_count,
    }));
  } else {
    events.push(event(deployment, "ChallengeAdjudicationRegistry", "ChallengeAdjudicationExpiredNoQuorum", 10, {
      challengeId: report.challenge_id,
      expirationReportHash: report.expiration_report_hash,
      expirer: RESPONDENT,
    }));
  }
  return events;
}

function adjudicationEvents(deployment: DeploymentInfo, report: AdjudicationReportV1): IndexedChainEvent[] {
  return [
    event(deployment, "ChallengeAdjudicationRegistry", "ChallengeResponseSubmitted", 1, {
      challengeId: report.challenge_id,
      evidenceId: EVIDENCE,
      respondent: RESPONDENT,
      responseHash: RESPONSE_HASH,
    }),
    ...report.verdict_hashes.map((verdictHash, index) =>
      event(deployment, "ChallengeAdjudicationRegistry", "ValidatorVerdictSubmitted", 2 + index, {
        challengeId: report.challenge_id,
        validator: `0x${String(index + 1).repeat(40)}`,
        claimedUpheld: true,
        verdictHash,
        methodHash: METHOD_HASH,
        operatorGroupHash: `0x${String(index + 4).repeat(64)}`,
        runnerFingerprintHash: `0x${String(index + 7).repeat(64)}`,
      }),
    ),
    event(deployment, "ChallengeAdjudicationRegistry", "ChallengeAdjudicationFinalized", 5, {
      challengeId: report.challenge_id,
      claimedUpheld: report.claimed_upheld,
      finalReportHash: report.final_report_hash,
      finalizer: RESPONDENT,
      effectiveVerdictCount: report.effective_verdict_count,
    }),
  ];
}

function event(
  deployment: DeploymentInfo,
  contract: ContractName,
  eventName: string,
  logIndex: number,
  args: Record<string, unknown>,
): IndexedChainEvent {
  return {
    schema_version: "originagent.evolution.event.v1",
    chain_id: deployment.chainId,
    network: deployment.network,
    contract,
    contract_address: deployment.contracts[contract] as Address,
    event_name: eventName,
    block_number: logIndex,
    transaction_hash: `0x${String(logIndex).padStart(64, "0")}`,
    log_index: logIndex,
    args,
  };
}
