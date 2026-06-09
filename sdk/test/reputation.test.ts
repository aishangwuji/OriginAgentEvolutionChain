import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import { loadDeployment } from "../src/contracts.ts";
import {
  computeReputationReportHash,
  createAgentReputationRecord,
  createAgentReputationReport,
  readAgentReputationRecord,
  readAgentReputationReport,
  validateAgentReputationRecord,
  validateAgentReputationReport,
} from "../src/reputation.ts";
import { checkpointAgentReputationTransaction } from "../src/transactions.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const PASSPORT_ID = `0x${"a".repeat(64)}`;
const UPHELD_CHALLENGE = `0x${"b".repeat(64)}`;
const REJECTED_CHALLENGE = `0x${"c".repeat(64)}`;
const CREATED_AT = "2026-05-23T00:00:00.000Z";

test("agent reputation records and reports validate stable hashes", () => {
  const upheld = createAgentReputationRecord({
    passportId: PASSPORT_ID,
    owner: OWNER,
    source: "challenge_upheld",
    sourceId: UPHELD_CHALLENGE,
    subjectAddress: OWNER,
    createdAt: CREATED_AT,
  });
  const rejected = createAgentReputationRecord({
    passportId: PASSPORT_ID,
    owner: OWNER,
    source: "challenge_rejected",
    sourceId: REJECTED_CHALLENGE,
    subjectAddress: OWNER,
    createdAt: CREATED_AT,
  });
  const report = createAgentReputationReport({
    passportId: PASSPORT_ID,
    owner: OWNER,
    records: [upheld, rejected],
    continuitySignals: ["passport_registered"],
  });

  assert.equal(validateAgentReputationRecord(upheld).ok, true);
  assert.equal(validateAgentReputationRecord(rejected).ok, true);
  assert.equal(report.score, 3);
  assert.equal(report.positive_count, 1);
  assert.equal(report.negative_count, 1);
  assert.equal(validateAgentReputationReport(report).ok, true);
  assert.equal(computeReputationReportHash(report), report.report_hash);

  const reordered = {
    report_hash: report.report_hash,
    warnings: report.warnings,
    records: report.records,
    score: report.score,
    owner: report.owner,
    passport_id: report.passport_id,
    negative_count: report.negative_count,
    positive_count: report.positive_count,
    continuity_signals: report.continuity_signals,
    schema_version: report.schema_version,
  };
  assert.equal(validateAgentReputationReport(reordered).ok, true);
});

test("agent reputation validation rejects tampering and invalid source deltas", () => {
  const record = createAgentReputationRecord({
    passportId: PASSPORT_ID,
    owner: OWNER,
    source: "challenge_upheld",
    sourceId: UPHELD_CHALLENGE,
    subjectAddress: OWNER,
    createdAt: CREATED_AT,
  });
  const report = createAgentReputationReport({ passportId: PASSPORT_ID, owner: OWNER, records: [record] });

  const invalidRecordCases = [
    { ...record, passport_id: `0x${"0".repeat(64)}` },
    { ...record, owner: "0x1111111111111111111111111111111111111111" },
    { ...record, source_id: `0x${"0".repeat(64)}` },
    { ...record, subject_address: "0x2222222222222222222222222222222222222222" },
    { ...record, delta: -2 },
    { ...record, prompt: "private" },
  ];
  for (const candidate of invalidRecordCases) {
    assert.equal(validateAgentReputationRecord(candidate).ok, false);
  }

  const invalidReportCases = [
    { ...report, passport_id: `0x${"3".repeat(64)}` },
    { ...report, owner: "0x3333333333333333333333333333333333333333" },
    { ...report, score: 6 },
    { ...report, positive_count: 2 },
    { ...report, negative_count: 1 },
    { ...report, report_hash: "0".repeat(64) },
    { ...report, facts: ["private"] },
  ];
  for (const candidate of invalidReportCases) {
    assert.equal(validateAgentReputationReport(candidate).ok, false);
  }
});

test("agent reputation CLI creates, writes, and validates artifacts", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec10-reputation-"));
  const recordPath = join(tmp, "agent-reputation-record.json");
  const reportPath = join(tmp, "agent-reputation-report.json");

  const record = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "create-agent-reputation-record",
        "--passport-id",
        PASSPORT_ID,
        "--owner",
        OWNER,
        "--source",
        "challenge_upheld",
        "--source-id",
        UPHELD_CHALLENGE,
        "--subject-address",
        OWNER,
        "--created-at",
        CREATED_AT,
        "--out",
        recordPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  );
  assert.equal(record.source_id, readAgentReputationRecord(recordPath).source_id);

  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "create-agent-reputation-report",
        "--passport-id",
        PASSPORT_ID,
        "--owner",
        OWNER,
        "--records",
        recordPath,
        "--continuity-signals",
        "passport_registered",
        "--out",
        reportPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  );
  assert.equal(report.report_hash, readAgentReputationReport(reportPath).report_hash);
  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "validate-agent-reputation-record", recordPath], { cwd: ROOT, encoding: "utf8" })).ok, true);
  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "validate-agent-reputation-report", reportPath], { cwd: ROOT, encoding: "utf8" })).ok, true);

  const invalidPath = join(tmp, "invalid-report.json");
  writeFileSync(invalidPath, JSON.stringify({ ...report, score: 99 }));
  const invalid = spawnSync(process.execPath, [CLI, "validate-agent-reputation-report", invalidPath], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.notEqual(invalid.status, 0);
  assert.match(JSON.parse(invalid.stdout).errors.join("\n"), /score mismatch|report_hash mismatch/);
});

test("checkpoint-agent-reputation dry-run uses optional reputation registry only when present", async () => {
  const reportHash = createAgentReputationReport({
    passportId: PASSPORT_ID,
    owner: OWNER,
    records: [
      createAgentReputationRecord({
        passportId: PASSPORT_ID,
        owner: OWNER,
        source: "challenge_upheld",
        sourceId: UPHELD_CHALLENGE,
        subjectAddress: OWNER,
        createdAt: CREATED_AT,
      }),
    ],
  }).report_hash;
  const dryRun = await checkpointAgentReputationTransaction(PASSPORT_ID, 5, 1, 0, reportHash, {
    network: "local",
    dryRun: true,
  });

  assert.equal(loadDeployment("local").contracts.AgentReputationRegistry, "0x7777777777777777777777777777777777777777");
  assert.equal(dryRun.contract, "AgentReputationRegistry");
  assert.equal(dryRun.method, "checkpointReputation");
  assert.equal(dryRun.target, "0x7777777777777777777777777777777777777777");
  assert.deepEqual(dryRun.args, [PASSPORT_ID, 5, 1, 0, `0x${reportHash}`]);

  const deploymentsDir = mkdtempSync(join(tmpdir(), "ec10-old-deployments-"));
  writeFileSync(
    join(deploymentsDir, "local.json"),
    JSON.stringify({
      chainId: 31337,
      network: "local",
      contracts: {
        IdentityRegistry: "0x1111111111111111111111111111111111111111",
        AgentPassportRegistry: "0x6666666666666666666666666666666666666666",
        ModuleRegistry: "0x2222222222222222222222222222222222222222",
        VerificationRegistry: "0x3333333333333333333333333333333333333333",
        ScoreCommitReveal: "0x4444444444444444444444444444444444444444",
      },
      deployer: "0x5555555555555555555555555555555555555555",
      deployedAt: "old-fixture",
      contractVersion: "ec9.0.0",
    }),
  );
  assert.equal(loadDeployment("local", deploymentsDir).contracts.AgentReputationRegistry, undefined);
  await assert.rejects(
    () =>
      checkpointAgentReputationTransaction(PASSPORT_ID, 5, 1, 0, reportHash, {
        network: "local",
        deploymentsDir,
        dryRun: true,
      }),
    /AgentReputationRegistry not found/,
  );
});
