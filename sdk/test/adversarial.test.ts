import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import type { Address } from "viem";

import { loadDeployment, type ContractName, type DeploymentInfo } from "../src/contracts.ts";
import {
  analyzeAdversarialSimulation,
  computeAbuseReportHash,
  validateAbuseReport,
  type AbuseReport,
} from "../src/adversarial.ts";
import {
  computeEvidenceId,
  createEvidenceReport,
  createExternalValidatorArtifact,
  type EvidenceReport,
} from "../src/evidence.ts";
import { createAuditBundle, type IndexedChainEvent } from "../src/indexer.ts";
import { createAgentPassportRecord, type AgentPassportRecord } from "../src/passport.ts";
import { createAgentReputationRecord, createAgentReputationReport } from "../src/reputation.ts";
import { createUnitKindProposal, createUnitKindReview } from "../src/unit-kind.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const OWNER = "0x1111111111111111111111111111111111111111";
const REPORTER = "0x2222222222222222222222222222222222222222";
const CHALLENGER = "0x2222222222222222222222222222222222222222";
const SUBMITTER = "0x3333333333333333333333333333333333333333";
const CREATED_AT = "2026-05-23T00:00:00.000Z";

test("adversarial analysis detects the EC-12 abuse categories", () => {
  const deployment = loadDeployment("local");
  const passports = Array.from({ length: 5 }, (_, index) => passportFixture(index));
  const reports = validatorReports();
  const canonical = unitKindProposal("tool");
  const typo = unitKindProposal("to0l");
  const review = createUnitKindReview({
    kind_id: "tool",
    version: "1",
    reviewer: OWNER,
    recommended_status: "Canonical",
    risk_assessment: "low risk canonical kind",
    validation_summary_hash: "4".repeat(64),
  });
  const evidenceId = computeEvidenceId(reports[0]);
  const challengeId = `0x${"9".repeat(64)}` as const;
  const reputationReport = createAgentReputationReport({
    passportId: passports[0].passport_id,
    owner: passports[0].owner,
    records: [
      createAgentReputationRecord({
        passportId: passports[0].passport_id,
        owner: passports[0].owner,
        source: "challenge_upheld",
        sourceId: challengeId,
        subjectAddress: passports[0].owner,
        createdAt: CREATED_AT,
      }),
    ],
  });
  const tampered = { ...typo, proposal_hash: "0".repeat(64) };
  const dirtyReport = { ...reports[0], prompt: "private" } as EvidenceReport;
  const events = [
    ...passports.map((passport, index) => passportEvent(deployment, passport, index + 1)),
    ...moduleSpamEvents(deployment, 10),
    event(deployment, "VerificationRegistry", "EvidenceSubmitted", 20, {
      evidenceId,
      moduleDigest: `0x${reports[0].module_digest}`,
      evidenceType: 3,
      reporter: REPORTER,
    }),
    event(deployment, "VerificationRegistry", "ChallengeSubmitted", 21, {
      challengeId,
      evidenceId,
      moduleDigest: `0x${reports[0].module_digest}`,
      reasonHash: `0x${"8".repeat(64)}`,
      challenger: CHALLENGER,
    }),
  ];

  const report = analyzeAdversarialSimulation({
    events,
    evidenceReports: [...reports, dirtyReport],
    agentPassports: passports,
    reputationReports: [reputationReport],
    unitKindProposals: [canonical, tampered],
    unitKindReviews: [review],
    generatedAt: CREATED_AT,
  });

  assert.equal(validateAbuseReport(report).ok, true, validateAbuseReport(report).errors.join("; "));
  const categories = new Set(report.signals.map((signal) => signal.category));
  for (const category of [
    "passport_sybil",
    "reputation_farming",
    "validator_collusion",
    "unit_kind_typosquatting",
    "module_spam",
    "artifact_tampering",
    "privacy_leakage",
  ]) {
    assert.equal(categories.has(category), true, `${category} was not detected`);
  }
  assert.equal(report.high_or_critical_count > 0, true);
});

test("passport sybil thresholds distinguish medium and high", () => {
  const deployment = loadDeployment("local");
  const two = passportEvents(deployment, 2);
  const three = passportEvents(deployment, 3);
  const five = passportEvents(deployment, 5);

  assert.equal(analyzeAdversarialSimulation({ events: two, generatedAt: CREATED_AT }).signals.length, 0);
  assert.equal(analyzeAdversarialSimulation({ events: three, generatedAt: CREATED_AT }).signals[0].severity, "medium");
  assert.equal(analyzeAdversarialSimulation({ events: five, generatedAt: CREATED_AT }).signals[0].severity, "high");
});

test("abuse report validation rejects tampering, invalid enums, and privacy leaks", () => {
  const report = analyzeAdversarialSimulation({
    events: passportEvents(loadDeployment("local"), 5),
    generatedAt: CREATED_AT,
  });
  assert.equal(computeAbuseReportHash(report), report.report_hash);

  assert.equal(validateAbuseReport({ ...report, report_hash: "0".repeat(64) }).ok, false);
  assert.equal(
    validateAbuseReport({ ...report, signals: [{ ...report.signals[0], category: "bad_category" }] }).ok,
    false,
  );
  assert.equal(
    validateAbuseReport({ ...report, signals: [{ ...report.signals[0], severity: "bad_severity" }] }).ok,
    false,
  );
  assert.equal(validateAbuseReport({ ...report, prompt: "private" }).ok, false);
});

test("audit bundle links abuse reports and rejects missing event evidence", () => {
  const deployment = loadDeployment("local");
  const events = passportEvents(deployment, 5);
  const report = analyzeAdversarialSimulation({ events, generatedAt: CREATED_AT });
  const bundle = createAuditBundle(deployment, events, [], [], [], [], [], [], [], [], report);

  assert.equal(bundle.ok, true, bundle.errors.join("; "));
  assert.equal(bundle.abuse_signals?.[0].category, "passport_sybil");

  const missingEventReport: AbuseReport = {
    ...report,
    signals: [{ ...report.signals[0], evidence: "event:MissingEvent:0x0" }],
    report_hash: "",
  };
  missingEventReport.report_hash = computeAbuseReportHash(missingEventReport);
  const missing = createAuditBundle(deployment, events, [], [], [], [], [], [], [], [], missingEventReport);
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join("\n"), /references missing event link/);
});

test("adversarial CLI writes and validates abuse reports", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec12-adversarial-"));
  const eventsPath = join(tmp, "events.jsonl");
  const outPath = join(tmp, "abuse-report.json");
  writeFileSync(eventsPath, passportEvents(loadDeployment("local"), 5).map((item) => JSON.stringify(item)).join("\n") + "\n");

  const output = execFileSync(
    process.execPath,
    [
      CLI,
      "analyze-adversarial-simulation",
      "--events",
      eventsPath,
      "--generated-at",
      CREATED_AT,
      "--out",
      outPath,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(JSON.parse(output).signals[0].category, "passport_sybil");
  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "validate-abuse-report", outPath], { cwd: ROOT, encoding: "utf8" })).ok, true);

  const invalid = spawnSync(process.execPath, [CLI, "validate-abuse-report"], { cwd: ROOT, encoding: "utf8" });
  assert.notEqual(invalid.status, 0);
  assert.match(JSON.parse(invalid.stdout).error, /usage: validate-abuse-report/);

  assert.equal(JSON.parse(readFileSync(outPath, "utf8")).report_hash, JSON.parse(output).report_hash);
});

function passportFixture(index: number): AgentPassportRecord {
  return createAgentPassportRecord({
    owner: OWNER,
    agentKeyHash: `0x${String(index + 1).repeat(64)}`,
    genesisNonce: `0x${String(index + 2).repeat(64)}`,
    metadataHash: `0x${"a".repeat(64)}`,
  });
}

function validatorReports(): EvidenceReport[] {
  return [0, 1, 2].map((index) => {
    const reporter = `0x${String(index + 4).repeat(40)}`;
    const artifact = createExternalValidatorArtifact({
      module_digest: `${String(index + 1).repeat(64)}`,
      validator: reporter,
      operator_group_hash: "b".repeat(64),
      runner_fingerprint_hash: "c".repeat(64),
      tool_tests_hash: "d".repeat(64),
      result_digest: "e".repeat(64),
      created_at: CREATED_AT,
    });
    return createEvidenceReport({
      moduleDigest: artifact.module_digest,
      proofBundleHash: "f".repeat(64),
      evidenceType: "validator_report",
      reporter,
      operatorGroupHash: artifact.operator_group_hash,
      runnerFingerprintHash: artifact.runner_fingerprint_hash,
      challengeWindowEnd: 100,
      externalValidatorArtifact: artifact,
    });
  });
}

function unitKindProposal(kindId: string) {
  return createUnitKindProposal({
    kind_id: kindId,
    version: "1",
    display_name: kindId,
    description: `${kindId} unit kind`,
    runtime_surface: "tool_call",
    schema_hash: "1".repeat(64),
    schema_uri: `ipfs://unit-kind/${kindId}/v1/schema`,
    permission_model: "declared permissions only",
    verification_profile: "validator replay",
    risk_class: "executable_tool",
    sandbox_requirement: "isolated process",
    install_semantics: "install manifest",
    rollback_semantics: "remove manifest",
    compatibility_rules: "audit convention",
    deprecation_rules: "keep archived definition",
  });
}

function passportEvents(deployment: DeploymentInfo, count: number): IndexedChainEvent[] {
  return Array.from({ length: count }, (_, index) => passportEvent(deployment, passportFixture(index), index + 1));
}

function passportEvent(deployment: DeploymentInfo, passport: AgentPassportRecord, logIndex: number): IndexedChainEvent {
  return event(deployment, "AgentPassportRegistry", "AgentPassportRegistered", logIndex, {
    passportId: passport.passport_id,
    owner: passport.owner,
    agentKeyHash: passport.agent_key_hash,
    genesisHash: passport.genesis_hash,
    metadataHash: passport.metadata_hash,
  });
}

function moduleSpamEvents(deployment: DeploymentInfo, startLogIndex: number): IndexedChainEvent[] {
  return Array.from({ length: 5 }, (_, index) =>
    event(deployment, "ModuleRegistry", "ModuleSubmitted", startLogIndex + index, {
      moduleDigest: `0x${String(index + 1).repeat(64)}`,
      moduleIdHash: `0x${String(index + 2).repeat(64)}`,
      moduleType: 4,
      versionHash: `0x${String(index + 3).repeat(64)}`,
      storageUri: `oci://registry.example/originagent/spam-${index}@sha256:${String(index + 1).repeat(64)}`,
      submitter: SUBMITTER,
    }),
  );
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
