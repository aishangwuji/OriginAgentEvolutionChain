import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import {
  computeChallengeId,
  computeChallengeSummary,
  computeEvidenceId,
  computeEvidenceReportHash,
  computeEvidenceSummary,
  computeExternalValidatorArtifactHash,
  createChallengeRecord,
  createEvidenceReport,
  createExternalValidatorArtifact,
  readEvidenceReport,
  readExternalValidatorArtifact,
  validateChallengeRecord,
  validateExternalValidatorArtifact,
  validateEvidenceReport,
  type ChallengeRecord,
  type ExternalValidatorArtifact,
  type EvidenceReport,
} from "../src/evidence.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const TOOL_PROOF = join(ROOT, "fixtures", "proof_bundle.tool.valid.json");
const SKILL_PROOF = join(ROOT, "fixtures", "proof_bundle.valid.json");
const VALIDATOR_REPORT = join(ROOT, "fixtures", "evidence_report.validator.valid.json");
const SECOND_VALIDATOR_REPORT = join(ROOT, "fixtures", "evidence_report.validator.second.valid.json");
const LOCAL_REPORT = join(ROOT, "fixtures", "evidence_report.local.valid.json");
const UNQUALIFIED_REPORT = join(ROOT, "fixtures", "evidence_report.unqualified.valid.json");
const CHALLENGE_UPHELD = join(ROOT, "fixtures", "challenge_record.upheld.valid.json");
const CHALLENGE_REJECTED = join(ROOT, "fixtures", "challenge_record.rejected.valid.json");
const CHALLENGE_SELF = join(ROOT, "fixtures", "challenge_record.self.valid.json");
const CHALLENGE_PRIVACY_INVALID = join(ROOT, "fixtures", "challenge_record.privacy.invalid.json");
const TOOL_STORAGE_URI =
  "oci://registry.example/originagent/demo-tool@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ARTIFACT_PATH = join(ROOT, "docs", "external_validator_artifact.ec3.json");
const CHALLENGER = "0x8888888888888888888888888888888888888888";
const REASON_HASH = `0x${"9".repeat(64)}`;
const RESOLUTION_HASH = `0x${"a".repeat(64)}`;

test("valid evidence report hash verifies and is stable across field order", () => {
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const validation = validateEvidenceReport(report);
  assert.equal(validation.ok, true, validation.errors.join("; "));

  const reordered = Object.fromEntries(Object.entries(report).reverse());
  assert.equal(computeEvidenceReportHash(reordered), computeEvidenceReportHash(report));
});

test("external validator artifact hash verifies and is stable across field order", () => {
  const artifact = readExternalValidatorArtifact(ARTIFACT_PATH);
  const validation = validateExternalValidatorArtifact(artifact);
  assert.equal(validation.ok, true, validation.errors.join("; "));

  const reordered = Object.fromEntries(Object.entries(artifact).reverse());
  assert.equal(computeExternalValidatorArtifactHash(reordered), computeExternalValidatorArtifactHash(artifact));
});

test("external validator artifact rejects private fields, paths, URL queries, and secrets", () => {
  const artifact = readExternalValidatorArtifact(ARTIFACT_PATH) as Record<string, unknown>;
  artifact.prompt = "private prompt";
  artifact.note = "C:\\Users\\tester\\secret.txt";
  artifact.callback = "https://example.invalid/path?token=abc";
  artifact.secret = "api_key=abc123";

  const validation = validateExternalValidatorArtifact(artifact);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /forbidden private field/);
  assert.match(validation.errors.join("\n"), /local absolute path/);
  assert.match(validation.errors.join("\n"), /URL query string/);
  assert.match(validation.errors.join("\n"), /secret-like string/);
});

test("create-evidence-report requires artifact for validator reports", () => {
  assert.throws(
    () =>
      createEvidenceReport({
        moduleDigest: "a".repeat(64),
        proofBundleHash: "b".repeat(64),
        evidenceType: "validator_report",
        reporter: "0x6666666666666666666666666666666666666666",
        operatorGroupHash: "1".repeat(64),
        runnerFingerprintHash: "2".repeat(64),
        challengeWindowEnd: 1893456000,
      }),
    /requires --external-validator-artifact/,
  );
});

test("create-evidence-report fills external artifact hash and stable report hash", () => {
  const artifact = readExternalValidatorArtifact(ARTIFACT_PATH);
  const report = createEvidenceReport({
    moduleDigest: artifact.module_digest,
    proofBundleHash: "cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e",
    evidenceType: "validator_report",
    reporter: artifact.validator,
    operatorGroupHash: artifact.operator_group_hash,
    runnerFingerprintHash: artifact.runner_fingerprint_hash,
    challengeWindowEnd: 1893456000,
    externalValidatorArtifact: artifact,
  });

  assert.equal(report.external_validator_artifact_hash, computeExternalValidatorArtifactHash(artifact));
  assert.equal(report.report_hash, computeEvidenceReportHash(report));
  assert.equal(validateEvidenceReport(report).ok, true);
});

test("evidence report tampering is rejected", () => {
  const report = readEvidenceReport(VALIDATOR_REPORT);
  report.report_hash = "9".repeat(64);
  const validation = validateEvidenceReport(report);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /report_hash mismatch/);
});

test("evidence report rejects private fields, paths, URL queries, and secrets", () => {
  const report = readEvidenceReport(VALIDATOR_REPORT) as Record<string, unknown>;
  report.prompt = "private prompt";
  report.note = "C:\\Users\\tester\\secret.txt";
  report.callback = "https://example.invalid/path?token=abc";
  report.secret = "api_key=abc123";

  const validation = validateEvidenceReport(report);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /forbidden private field/);
  assert.match(validation.errors.join("\n"), /local absolute path/);
  assert.match(validation.errors.join("\n"), /URL query string/);
  assert.match(validation.errors.join("\n"), /secret-like string/);
});

test("unqualified validator and local client reports cannot reach high confidence", () => {
  const summary = computeEvidenceSummary([readEvidenceReport(LOCAL_REPORT), readEvidenceReport(UNQUALIFIED_REPORT)]);
  assert.equal(summary.ok, true);
  assert.equal(summary.score, 10);
  assert.equal(summary.highConfidence, false);
});

test("single qualified validator plus local client report cannot reach high confidence", () => {
  const summary = computeEvidenceSummary([readEvidenceReport(LOCAL_REPORT), readEvidenceReport(VALIDATOR_REPORT)]);
  assert.equal(summary.score, 70);
  assert.equal(summary.highConfidence, false);
});

test("same operator group or runner fingerprint is capped", () => {
  const first = readEvidenceReport(VALIDATOR_REPORT);
  const duplicateGroup = {
    ...readEvidenceReport(SECOND_VALIDATOR_REPORT),
    operator_group_hash: first.operator_group_hash,
  } as EvidenceReport;
  duplicateGroup.report_hash = computeEvidenceReportHash(duplicateGroup);

  const summary = computeEvidenceSummary([first, duplicateGroup]);
  assert.equal(summary.score, 60);
  assert.equal(summary.highConfidence, false);
  assert.deepEqual(summary.cappedReports, [duplicateGroup.report_hash]);
});

test("two independent validator reports can reach high confidence", () => {
  const summary = computeEvidenceSummary([readEvidenceReport(VALIDATOR_REPORT), readEvidenceReport(SECOND_VALIDATOR_REPORT)]);
  assert.equal(summary.score, 120);
  assert.equal(summary.highConfidence, true);
  assert.equal(summary.effectiveValidatorGroups.length, 2);
  assert.equal(summary.effectiveRunnerFingerprints.length, 2);
});

test("invalidated report is excluded from evidence summary", () => {
  const report = {
    ...readEvidenceReport(VALIDATOR_REPORT),
    report_status: "invalidated",
  } as EvidenceReport;
  report.report_hash = computeEvidenceReportHash(report);

  const summary = computeEvidenceSummary([report]);
  assert.equal(summary.score, 0);
  assert.equal(summary.highConfidence, false);
  assert.deepEqual(summary.invalidatedReports, [report.report_hash]);
});

test("CLI evidence-summary reports high confidence for independent validator evidence", () => {
  const output = execFileSync(
    process.execPath,
    [CLI, "evidence-summary", "--reports", VALIDATOR_REPORT, SECOND_VALIDATOR_REPORT],
    { cwd: ROOT, encoding: "utf8" },
  );
  const parsed = JSON.parse(output);
  assert.equal(parsed.highConfidence, true);
  assert.equal(parsed.testnetOnly, true);
});

test("CLI creates and validates external validator artifact and evidence report", () => {
  const outDir = join(tmpdir(), `originagent-ec35-${Date.now()}`);
  const artifactOut = join(outDir, "artifact.json");
  const reportOut = join(outDir, "report.json");

  const createdArtifact = execFileSync(
    process.execPath,
    [
      CLI,
      "create-external-validator-artifact",
      "--module-digest",
      "a".repeat(64),
      "--validator",
      "0x6666666666666666666666666666666666666666",
      "--operator-group-hash",
      "1".repeat(64),
      "--runner-fingerprint-hash",
      "2".repeat(64),
      "--tool-tests-hash",
      "3".repeat(64),
      "--result-digest",
      "4".repeat(64),
      "--created-at",
      "2026-05-22T09:18:00Z",
      "--out",
      artifactOut,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  const parsedArtifact = JSON.parse(createdArtifact);
  assert.equal(parsedArtifact.path, artifactOut);
  assert.equal(validateExternalValidatorArtifact(JSON.parse(readFileSync(artifactOut, "utf8"))).ok, true);

  const validatedArtifact = execFileSync(
    process.execPath,
    [CLI, "validate-external-validator-artifact", artifactOut],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(JSON.parse(validatedArtifact).ok, true);

  const createdReport = execFileSync(
    process.execPath,
    [
      CLI,
      "create-evidence-report",
      "--module-digest",
      "a".repeat(64),
      "--proof-bundle-hash",
      "b".repeat(64),
      "--evidence-type",
      "validator_report",
      "--reporter",
      "0x6666666666666666666666666666666666666666",
      "--operator-group-hash",
      "1".repeat(64),
      "--runner-fingerprint-hash",
      "2".repeat(64),
      "--challenge-window-end",
      "1893456000",
      "--external-validator-artifact",
      artifactOut,
      "--out",
      reportOut,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  const parsedReport = JSON.parse(createdReport);
  assert.equal(parsedReport.report_hash, computeEvidenceReportHash(parsedReport));
  assert.equal(validateEvidenceReport(JSON.parse(readFileSync(reportOut, "utf8"))).ok, true);
});

test("CLI submit-tool-module accepts tool proof and rejects non-tool proof", () => {
  const output = execFileSync(
    process.execPath,
    [
      CLI,
      "submit-tool-module",
      "--proof-bundle",
      TOOL_PROOF,
      "--storage-uri",
      TOOL_STORAGE_URI,
      "--network",
      "local",
      "--dry-run",
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(JSON.parse(output).contract, "ModuleRegistry");

  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          CLI,
          "submit-tool-module",
          "--proof-bundle",
          SKILL_PROOF,
          "--storage-uri",
          TOOL_STORAGE_URI,
          "--network",
          "local",
          "--dry-run",
        ],
        { cwd: ROOT, encoding: "utf8", stdio: "pipe" },
      ),
    /Command failed/,
  );
});

test("CLI validator profile and validator report dry-runs encode verification registry calls", () => {
  const profileOutput = execFileSync(
    process.execPath,
    [
      CLI,
      "set-validator-profile",
      "--validator",
      "0x6666666666666666666666666666666666666666",
      "--operator-group-hash",
      "1111111111111111111111111111111111111111111111111111111111111111",
      "--runner-fingerprint-hash",
      "2222222222222222222222222222222222222222222222222222222222222222",
      "--allowed",
      "true",
      "--network",
      "local",
      "--dry-run",
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(JSON.parse(profileOutput).method, "setValidatorProfile");

  const reportOutput = execFileSync(
    process.execPath,
    [CLI, "submit-validator-report", "--report", VALIDATOR_REPORT, "--network", "local", "--dry-run"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(JSON.parse(reportOutput).method, "submitEvidence");
});

test("evidence and challenge ids use EVM ABI encoding", () => {
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const evidenceId = computeEvidenceId(report);
  const challengeId = computeChallengeId(evidenceId, CHALLENGER, REASON_HASH);

  assert.match(evidenceId, /^0x[0-9a-f]{64}$/);
  assert.match(challengeId, /^0x[0-9a-f]{64}$/);
  assert.notEqual(evidenceId, challengeId);
});

test("challenge record validation is stable across field order", () => {
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const record = createChallengeRecord({
    evidenceId: computeEvidenceId(report),
    moduleDigest: report.module_digest,
    reasonHash: REASON_HASH,
    challenger: CHALLENGER,
    reporter: report.reporter,
    createdAt: "2026-05-23T00:00:00Z",
    status: "upheld",
    resolutionHash: RESOLUTION_HASH,
    resolvedAt: "2026-05-23T00:10:00Z",
  });

  assert.equal(validateChallengeRecord(record).ok, true);
  const reordered = Object.fromEntries(Object.entries(record).reverse()) as ChallengeRecord;
  assert.equal(validateChallengeRecord(reordered).ok, true);
});

test("challenge record rejects private fields, paths, URL queries, and secrets", () => {
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const record = createChallengeRecord({
    evidenceId: computeEvidenceId(report),
    moduleDigest: report.module_digest,
    reasonHash: REASON_HASH,
    challenger: CHALLENGER,
    createdAt: "2026-05-23T00:00:00Z",
  }) as Record<string, unknown>;
  record.prompt = "private prompt";
  record.note = "C:\\Users\\tester\\secret.txt";
  record.callback = "https://example.invalid/path?token=abc";
  record.secret = "api_key=abc123";

  const validation = validateChallengeRecord(record);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /forbidden private field/);
  assert.match(validation.errors.join("\n"), /local absolute path/);
  assert.match(validation.errors.join("\n"), /URL query string/);
  assert.match(validation.errors.join("\n"), /secret-like string/);
});

test("challenge summary records invalidations, rejected challenges, and reputation deltas", () => {
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const upheld = createChallengeRecord({
    evidenceId: computeEvidenceId(report),
    moduleDigest: report.module_digest,
    reasonHash: REASON_HASH,
    challenger: CHALLENGER,
    reporter: report.reporter,
    createdAt: "2026-05-23T00:00:00Z",
    status: "upheld",
    resolutionHash: RESOLUTION_HASH,
  });
  const rejected = createChallengeRecord({
    evidenceId: computeEvidenceId(report),
    moduleDigest: report.module_digest,
    reasonHash: `0x${"b".repeat(64)}`,
    challenger: "0x9999999999999999999999999999999999999999",
    createdAt: "2026-05-23T00:01:00Z",
    status: "rejected",
    resolutionHash: RESOLUTION_HASH,
  });

  const summary = computeChallengeSummary([upheld, rejected]);
  assert.deepEqual(summary.invalidated_evidence_ids, [computeEvidenceId(report)]);
  assert.deepEqual(summary.rejected_challenge_ids, [rejected.challenge_id]);
  assert.equal(summary.reputation[CHALLENGER], 5);
  assert.equal(summary.reputation[report.reporter], -10);
  assert.equal(summary.reputation["0x9999999999999999999999999999999999999999"], -2);
});

test("challenge fixtures validate expected EC-4 cases", () => {
  assert.equal(validateChallengeRecord(JSON.parse(readFileSync(CHALLENGE_UPHELD, "utf8"))).ok, true);
  assert.equal(validateChallengeRecord(JSON.parse(readFileSync(CHALLENGE_REJECTED, "utf8"))).ok, true);
  assert.equal(validateChallengeRecord(JSON.parse(readFileSync(CHALLENGE_SELF, "utf8"))).ok, true);
  assert.equal(validateChallengeRecord(JSON.parse(readFileSync(CHALLENGE_PRIVACY_INVALID, "utf8"))).ok, false);
});

test("evidence summary applies challenge invalidations and reputation blocks", () => {
  const invalidated = readEvidenceReport(VALIDATOR_REPORT);
  const sameReporter = {
    ...readEvidenceReport(SECOND_VALIDATOR_REPORT),
    reporter: invalidated.reporter,
  } as EvidenceReport;
  sameReporter.report_hash = computeEvidenceReportHash(sameReporter);
  const challengeSummary = computeChallengeSummary([
    createChallengeRecord({
      evidenceId: computeEvidenceId(invalidated),
      moduleDigest: invalidated.module_digest,
      reasonHash: REASON_HASH,
      challenger: CHALLENGER,
      reporter: invalidated.reporter,
      createdAt: "2026-05-23T00:00:00Z",
      status: "upheld",
      resolutionHash: RESOLUTION_HASH,
    }),
  ]);

  const summary = computeEvidenceSummary([invalidated, sameReporter], challengeSummary);
  assert.equal(summary.score, 0);
  assert.deepEqual(summary.invalidatedReports, [invalidated.report_hash]);
  assert.deepEqual(summary.reputationBlockedReports, [sameReporter.report_hash]);
  assert.equal(summary.highConfidence, false);
});

test("CLI creates challenge records and applies challenge summary to evidence summary", () => {
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const outDir = join(tmpdir(), `originagent-ec4-${Date.now()}`);
  const challengeOut = join(outDir, "challenge.json");
  const summaryOut = join(outDir, "challenge-summary.json");
  const evidenceId = computeEvidenceId(report);

  const created = execFileSync(
    process.execPath,
    [
      CLI,
      "create-challenge-record",
      "--evidence-id",
      evidenceId,
      "--module-digest",
      report.module_digest,
      "--reason-hash",
      REASON_HASH,
      "--challenger",
      CHALLENGER,
      "--reporter",
      report.reporter,
      "--created-at",
      "2026-05-23T00:00:00Z",
      "--status",
      "upheld",
      "--resolution-hash",
      RESOLUTION_HASH,
      "--out",
      challengeOut,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(JSON.parse(created).challenge_id, computeChallengeId(evidenceId, CHALLENGER, REASON_HASH));

  const validated = execFileSync(process.execPath, [CLI, "validate-challenge-record", challengeOut], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(JSON.parse(validated).ok, true);

  const challengeSummary = execFileSync(process.execPath, [CLI, "challenge-summary", "--challenges", challengeOut], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(JSON.parse(challengeSummary).invalidated_evidence_ids[0], evidenceId);
  writeFileSync(summaryOut, challengeSummary, "utf8");

  const evidenceSummary = execFileSync(
    process.execPath,
    [CLI, "evidence-summary", "--reports", VALIDATOR_REPORT, "--challenge-summary", summaryOut],
    { cwd: ROOT, encoding: "utf8" },
  );
  const parsedEvidenceSummary = JSON.parse(evidenceSummary);
  assert.equal(parsedEvidenceSummary.score, 0);
  assert.deepEqual(parsedEvidenceSummary.invalidatedReports, [report.report_hash]);
});
