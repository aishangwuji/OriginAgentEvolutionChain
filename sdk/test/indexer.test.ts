import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import { decodeEventLog, encodeAbiParameters, encodeEventTopics, type Address } from "viem";

import {
  AGENT_PASSPORT_REGISTRY_ABI,
  AGENT_REPUTATION_REGISTRY_ABI,
  EVOLUTION_UNIT_KIND_REGISTRY_ABI,
  IDENTITY_REGISTRY_ABI,
  MODULE_REGISTRY_ABI,
  SCORE_COMMIT_REVEAL_ABI,
  TEST_CREDIT_LEDGER_ABI,
  VERIFICATION_REGISTRY_ABI,
  loadDeployment,
  type ContractName,
  type DeploymentInfo,
} from "../src/contracts.ts";
import {
  computeChallengeId,
  computeEvidenceId,
  evidenceTypeId,
  readChallengeRecord,
  readEvidenceReport,
} from "../src/evidence.ts";
import {
  createAgentMigrationRecord,
  createAgentPassportRecord,
  type AgentMigrationRecord,
  type AgentPassportRecord,
} from "../src/passport.ts";
import {
  createAuditBundle,
  readIndexedEvents,
  writeAuditBundle,
  type IndexedChainEvent,
} from "../src/indexer.ts";
import { computeMemoryVaultDigest, type MemoryVaultArtifact } from "../src/memory-vault.ts";
import {
  createAgentReputationRecord,
  createAgentReputationReport,
  type AgentReputationReport,
} from "../src/reputation.ts";
import {
  computeUnitKindIdHash,
  computeUnitKindVersionHash,
  computeUnitKindVersionKey,
  createUnitKindProposal,
  createUnitKindReview,
  type UnitKindProposal,
  type UnitKindReview,
} from "../src/unit-kind.ts";
import {
  createCommunityWorkClaim,
  createModuleAcquisitionReceipt,
  createModuleManifest,
  createVerificationRunReceipt,
  type CommunityWorkClaim,
  type ModuleAcquisitionReceipt,
  type ModuleManifest,
  type VerificationRunReceipt,
} from "../src/module-verification.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const VALIDATOR_REPORT = join(ROOT, "fixtures", "evidence_report.validator.valid.json");
const SECOND_VALIDATOR_REPORT = join(ROOT, "fixtures", "evidence_report.validator.second.valid.json");
const CHALLENGE_UPHELD = join(ROOT, "fixtures", "challenge_record.upheld.valid.json");
const CHALLENGE_REJECTED = join(ROOT, "fixtures", "challenge_record.rejected.valid.json");
const EC16_RESPONSIBLE = "0x5555555555555555555555555555555555555555";
const EC16_VALIDATOR = "0x6666666666666666666666666666666666666666";
const EC16_CREATED_AT = "2026-05-25T00:00:00.000Z";

test("event ABI decodes enum values as numbers", () => {
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const evidenceId = computeEvidenceId(report);
  const topics = encodeEventTopics({
    abi: VERIFICATION_REGISTRY_ABI,
    eventName: "EvidenceSubmitted",
    args: {
      evidenceId,
      moduleDigest: `0x${report.module_digest}`,
      reporter: report.reporter,
    },
  });
  const data = encodeAbiParameters([{ type: "uint8" }], [evidenceTypeId(report.evidence_type)]);
  const decoded = decodeEventLog({
    abi: VERIFICATION_REGISTRY_ABI,
    eventName: "EvidenceSubmitted",
    topics,
    data,
  });

  assert.equal(decoded.eventName, "EvidenceSubmitted");
  assert.equal(decoded.args.evidenceType, 3);
  assert.equal(typeof decoded.args.evidenceType, "number");
});

test("all event ABIs decode known logs", () => {
  const bytesA = `0x${"a".repeat(64)}`;
  const bytesB = `0x${"b".repeat(64)}`;
  const bytesC = `0x${"c".repeat(64)}`;
  const bytesD = `0x${"d".repeat(64)}`;
  const addrA = "0x1111111111111111111111111111111111111111";
  const addrB = "0x2222222222222222222222222222222222222222";
  const cases = [
    {
      abi: IDENTITY_REGISTRY_ABI,
      eventName: "IdentityRegistered",
      indexed: { subject: addrA },
      dataTypes: [{ type: "uint8" }, { type: "bytes32" }],
      values: [2, bytesA],
      enumField: "role",
    },
    {
      abi: AGENT_PASSPORT_REGISTRY_ABI,
      eventName: "AgentPassportRegistered",
      indexed: { passportId: bytesA, owner: addrA },
      dataTypes: [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
      values: [bytesB, bytesC, bytesD],
    },
    {
      abi: AGENT_PASSPORT_REGISTRY_ABI,
      eventName: "AgentPassportMigrationRecorded",
      indexed: { passportId: bytesA, owner: addrA },
      dataTypes: [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint32" }],
      values: [bytesB, bytesC, bytesD, 1],
    },
    {
      abi: AGENT_REPUTATION_REGISTRY_ABI,
      eventName: "AgentReputationCheckpointed",
      indexed: { passportId: bytesA },
      dataTypes: [{ type: "int32" }, { type: "uint32" }, { type: "uint32" }, { type: "bytes32" }, { type: "uint32" }],
      values: [3, 1, 1, bytesB, 1],
      enumField: "score",
    },
    {
      abi: EVOLUTION_UNIT_KIND_REGISTRY_ABI,
      eventName: "EvolutionUnitKindProposed",
      indexed: { kindVersionKey: bytesA, kindIdHash: bytesB, submitter: addrA },
      dataTypes: [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
      values: [bytesC, bytesD, bytesA],
    },
    {
      abi: EVOLUTION_UNIT_KIND_REGISTRY_ABI,
      eventName: "EvolutionUnitKindReviewSet",
      indexed: { kindVersionKey: bytesA, kindIdHash: bytesB },
      dataTypes: [{ type: "bytes32" }, { type: "bytes32" }],
      values: [bytesC, bytesD],
    },
    {
      abi: EVOLUTION_UNIT_KIND_REGISTRY_ABI,
      eventName: "EvolutionUnitKindStatusChanged",
      indexed: { kindVersionKey: bytesA, kindIdHash: bytesB },
      dataTypes: [{ type: "bytes32" }, { type: "uint8" }, { type: "uint8" }],
      values: [bytesC, 1, 4],
      enumField: "newStatus",
    },
    {
      abi: TEST_CREDIT_LEDGER_ABI,
      eventName: "TestCreditGranted",
      indexed: { passportId: bytesA },
      dataTypes: [{ type: "uint64" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint32" }],
      values: [100n, bytesB, bytesC, 1],
    },
    {
      abi: TEST_CREDIT_LEDGER_ABI,
      eventName: "TestCreditConsumed",
      indexed: { passportId: bytesA },
      dataTypes: [{ type: "uint64" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint32" }],
      values: [5n, bytesB, bytesC, 2],
    },
    {
      abi: MODULE_REGISTRY_ABI,
      eventName: "ModuleSubmitted",
      indexed: { moduleDigest: bytesA, moduleIdHash: bytesB, submitter: addrA },
      dataTypes: [{ type: "uint8" }, { type: "bytes32" }, { type: "string" }],
      values: [4, bytesC, "oci://registry.example/originagent/demo-tool@sha256:" + "a".repeat(64)],
      enumField: "moduleType",
    },
    {
      abi: VERIFICATION_REGISTRY_ABI,
      eventName: "VerificationReportSubmitted",
      indexed: { moduleDigest: bytesA, reporter: addrA },
      dataTypes: [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
      values: [bytesB, bytesC, bytesD, bytesA],
    },
    {
      abi: VERIFICATION_REGISTRY_ABI,
      eventName: "ValidatorProfileSet",
      indexed: { validator: addrA },
      dataTypes: [{ type: "bytes32" }, { type: "bytes32" }, { type: "bool" }],
      values: [bytesA, bytesB, true],
    },
    {
      abi: VERIFICATION_REGISTRY_ABI,
      eventName: "EvidenceSubmitted",
      indexed: { evidenceId: bytesA, moduleDigest: bytesB, reporter: addrA },
      dataTypes: [{ type: "uint8" }],
      values: [3],
      enumField: "evidenceType",
    },
    {
      abi: VERIFICATION_REGISTRY_ABI,
      eventName: "EvidenceInvalidated",
      indexed: { evidenceId: bytesA, actor: addrA },
      dataTypes: [{ type: "bytes32" }],
      values: [bytesB],
    },
    {
      abi: VERIFICATION_REGISTRY_ABI,
      eventName: "ChallengeSubmitted",
      indexed: { challengeId: bytesA, evidenceId: bytesB, moduleDigest: bytesC },
      dataTypes: [{ type: "bytes32" }, { type: "address" }],
      values: [bytesD, addrA],
    },
    {
      abi: VERIFICATION_REGISTRY_ABI,
      eventName: "ChallengeResolved",
      indexed: { challengeId: bytesA, evidenceId: bytesB },
      dataTypes: [{ type: "bool" }, { type: "bytes32" }, { type: "address" }],
      values: [true, bytesC, addrA],
    },
    {
      abi: VERIFICATION_REGISTRY_ABI,
      eventName: "ChallengeResolvedOnAlreadyInvalidated",
      indexed: { challengeId: bytesA, evidenceId: bytesB },
      dataTypes: [],
      values: [],
    },
    {
      abi: SCORE_COMMIT_REVEAL_ABI,
      eventName: "ScoreCommitted",
      indexed: { moduleDigest: bytesA, scorer: addrA },
      dataTypes: [{ type: "bytes32" }],
      values: [bytesB],
    },
    {
      abi: SCORE_COMMIT_REVEAL_ABI,
      eventName: "ScoreRevealed",
      indexed: { moduleDigest: bytesA, scorer: addrB },
      dataTypes: [{ type: "uint8" }, { type: "bytes32" }],
      values: [88, bytesB],
      enumField: "score",
    },
  ] as const;

  for (const item of cases) {
    const decoded = decodeEventLog({
      abi: item.abi,
      eventName: item.eventName,
      topics: encodeEventTopics({ abi: item.abi, eventName: item.eventName, args: item.indexed }),
      data: item.dataTypes.length > 0 ? encodeAbiParameters(item.dataTypes, item.values) : "0x",
    });
    assert.equal(decoded.eventName, item.eventName);
    if (item.enumField) {
      assert.equal(typeof decoded.args[item.enumField], "number");
    }
  }
});

test("audit bundle validates EC-5 evidence and challenge linkage", () => {
  const deployment = loadDeployment("local");
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const challenge = readChallengeRecord(CHALLENGE_UPHELD);
  const events = happyPathEvents(deployment);
  const bundle = createAuditBundle(deployment, events, [report], [challenge]);

  assert.equal(bundle.ok, true, bundle.errors.join("; "));
  assert.equal(bundle.events.total, events.length);
  assert.equal(bundle.evidence_linkage[0].artifact_matched, true);
  assert.equal(bundle.challenge_linkage[0].record_matched, true);
  assert.equal(bundle.challenge_linkage[0].resolution_found, true);
  assert.equal(bundle.challenge_linkage[0].invalidation_found, true);
  assert.equal(bundle.reputation_delta[challenge.challenger], 5);
  assert.equal(bundle.reputation_delta[challenge.reporter as string], -10);
  assert.equal(bundle.evidence_summary.invalidatedReports.length, 1);
  assert.match(bundle.notes.join("\n"), /evidenceId verification depends on evidence report artifacts/);
});

test("audit bundle validates multi-node evidence with rejected challenge", () => {
  const deployment = loadDeployment("local");
  const reports = [readEvidenceReport(VALIDATOR_REPORT), readEvidenceReport(SECOND_VALIDATOR_REPORT)];
  const challenge = readChallengeRecord(CHALLENGE_REJECTED);
  const events = multiNodeRejectedChallengeEvents(deployment);
  const bundle = createAuditBundle(deployment, events, reports, [challenge]);

  assert.equal(bundle.ok, true, bundle.errors.join("; "));
  assert.equal(bundle.evidence_linkage.length, 2);
  assert.equal(bundle.evidence_linkage.every((linkage) => linkage.artifact_matched), true);
  assert.equal(bundle.challenge_linkage[0].record_matched, true);
  assert.equal(bundle.challenge_linkage[0].resolution_found, true);
  assert.equal(bundle.challenge_linkage[0].invalidation_found, false);
  assert.equal(bundle.evidence_summary.acceptedReports, 2);
  assert.equal(bundle.evidence_summary.highConfidence, true);
  assert.equal(bundle.evidence_summary.effectiveValidatorGroups.length, 2);
  assert.equal(bundle.evidence_summary.effectiveRunnerFingerprints.length, 2);
  assert.equal(bundle.reputation_delta[challenge.challenger], -2);
});

test("audit bundle validates agent passport and migration events", () => {
  const deployment = loadDeployment("local");
  const passport = passportRecord();
  const migration = migrationRecord(passport);
  const events = passportEvents(deployment, passport, migration);
  const bundle = createAuditBundle(deployment, events, [], [], [passport], [migration]);

  assert.equal(bundle.ok, true, bundle.errors.join("; "));
  assert.equal(bundle.agent_passport_linkage[0].artifact_matched, true);
  assert.equal(bundle.agent_migration_linkage[0].artifact_matched, true);
  assert.equal(bundle.agent_migration_linkage[0].migration_index, 1);
  assert.equal(bundle.events.by_event.AgentPassportRegistered, 1);
  assert.equal(bundle.events.by_event.AgentPassportMigrationRecorded, 1);
});

test("audit bundle validates memory vault linkage to agent passport", () => {
  const deployment = loadDeployment("local");
  const passport = passportRecord();
  const migration = migrationRecord(passport);
  const vault = memoryVault(passport.passport_id, passport.agent_key_hash);
  const bundle = createAuditBundle(deployment, passportEvents(deployment, passport, migration), [], [], [passport], [migration], [vault]);

  assert.equal(bundle.ok, true, bundle.errors.join("; "));
  assert.equal(bundle.memory_vault_linkage[0].artifact_valid, true);
  assert.equal(bundle.memory_vault_linkage[0].passport_linked, true);
  assert.equal(bundle.memory_vault_linkage[0].vault_digest, vault.vault_digest);
});

test("audit bundle validates agent reputation report and checkpoint linkage", () => {
  const deployment = loadDeployment("local");
  const challenge = readChallengeRecord(CHALLENGE_UPHELD);
  const passport = passportRecord(challenge.challenger);
  const report = reputationReport(passport, [challenge]);
  const events = [
    ...passportEvents(deployment, passport, migrationRecord(passport)).slice(0, 1),
    ...happyPathEvents(deployment),
    reputationCheckpointEvent(deployment, report, 7),
  ];
  const bundle = createAuditBundle(deployment, events, [], [], [passport], [], [], [report]);

  assert.equal(bundle.ok, true, bundle.errors.join("; "));
  assert.equal(bundle.reputation_checkpoint_linkage?.[0].checkpoint_event_found, true);
  assert.equal(bundle.reputation_checkpoint_linkage?.[0].report_hash_matched, true);
  assert.equal(bundle.reputation_checkpoint_linkage?.[0].source_events_matched, true);
  assert.equal(bundle.reputation_checkpoint_linkage?.[0].score, 5);
});

test("audit bundle rejects agent reputation mismatches", () => {
  const deployment = loadDeployment("local");
  const challenge = readChallengeRecord(CHALLENGE_UPHELD);
  const passport = passportRecord(challenge.challenger);
  const report = reputationReport(passport, [challenge]);
  const events = [
    ...passportEvents(deployment, passport, migrationRecord(passport)).slice(0, 1),
    ...happyPathEvents(deployment),
    reputationCheckpointEvent(deployment, { ...report, report_hash: "0".repeat(64) }, 7),
  ];

  const missingCheckpoint = createAuditBundle(deployment, events.slice(0, -1), [], [], [passport], [], [], [report]);
  assert.equal(missingCheckpoint.ok, false);
  assert.match(missingCheckpoint.errors.join("\n"), /missing AgentReputationCheckpointed/);

  const mismatchedHash = createAuditBundle(deployment, events, [], [], [passport], [], [], [report]);
  assert.equal(mismatchedHash.ok, false);
  assert.match(mismatchedHash.errors.join("\n"), /missing AgentReputationCheckpointed/);

  const wrongOwnerReport = createAgentReputationReport({
    passportId: passport.passport_id,
    owner: "0x7777777777777777777777777777777777777777",
    records: [
      createAgentReputationRecord({
        passportId: passport.passport_id,
        owner: "0x7777777777777777777777777777777777777777",
        source: "challenge_upheld",
        sourceId: challenge.challenge_id,
        subjectAddress: "0x7777777777777777777777777777777777777777",
        createdAt: challenge.created_at,
      }),
    ],
  });
  const wrongOwner = createAuditBundle(deployment, events, [], [], [passport], [], [], [wrongOwnerReport]);
  assert.equal(wrongOwner.ok, false);
  assert.match(wrongOwner.errors.join("\n"), /not linked to passport owner|challenge events do not match/);
});

test("audit bundle validates unit kind proposal and review linkage", () => {
  const deployment = loadDeployment("local");
  const proposal = unitKindProposal();
  const review = unitKindReview(proposal);
  const bundle = createAuditBundle(deployment, unitKindEvents(deployment, proposal, review), [], [], [], [], [], [], [proposal], [review]);

  assert.equal(bundle.ok, true, bundle.errors.join("; "));
  assert.equal(bundle.unit_kind_linkage?.[0].artifact_valid, true);
  assert.equal(bundle.unit_kind_linkage?.[0].proposal_event_matched, true);
  assert.equal(bundle.unit_kind_linkage?.[0].review_event_found, true);
  assert.equal(bundle.unit_kind_linkage?.[0].status_event_found, true);
  assert.equal(bundle.unit_kind_linkage?.[0].status, "Canonical");
});

test("audit bundle rejects unit kind linkage mismatches", () => {
  const deployment = loadDeployment("local");
  const proposal = unitKindProposal();
  const review = unitKindReview(proposal);
  const events = unitKindEvents(deployment, proposal, review);

  const missingProposalEvent = createAuditBundle(deployment, events.slice(1), [], [], [], [], [], [], [proposal], [review]);
  assert.equal(missingProposalEvent.ok, false);
  assert.match(missingProposalEvent.errors.join("\n"), /missing EvolutionUnitKindProposed/);

  const missingReviewEvent = createAuditBundle(
    deployment,
    events.filter((event) => event.event_name !== "EvolutionUnitKindReviewSet"),
    [],
    [],
    [],
    [],
    [],
    [],
    [proposal],
    [review],
  );
  assert.equal(missingReviewEvent.ok, false);
  assert.match(missingReviewEvent.errors.join("\n"), /missing EvolutionUnitKindReviewSet/);

  const wrongStatus = createAuditBundle(
    deployment,
    events.map((event) =>
      event.event_name === "EvolutionUnitKindStatusChanged"
        ? { ...event, args: { ...event.args, newStatus: 2 } }
        : event,
    ),
    [],
    [],
    [],
    [],
    [],
    [],
    [proposal],
    [review],
  );
  assert.equal(wrongStatus.ok, false);
  assert.match(wrongStatus.errors.join("\n"), /missing EvolutionUnitKindStatusChanged/);

  const missingReview = createAuditBundle(deployment, events, [], [], [], [], [], [], [proposal], []);
  assert.equal(missingReview.ok, false);
  assert.match(missingReview.errors.join("\n"), /missing unit kind review artifact/);

  const missingStatus = createAuditBundle(deployment, events.slice(0, -1), [], [], [], [], [], [], [proposal], [review]);
  assert.equal(missingStatus.ok, false);
  assert.match(missingStatus.errors.join("\n"), /missing EvolutionUnitKindStatusChanged/);

  const tampered = createAuditBundle(
    deployment,
    events,
    [],
    [],
    [],
    [],
    [],
    [],
    [{ ...proposal, schema_hash: "0".repeat(64) }],
    [review],
  );
  assert.equal(tampered.ok, false);
  assert.match(tampered.errors.join("\n"), /proposal_hash mismatch|does not match proposal/);
});

test("audit bundle rejects tampered memory vault public fields", () => {
  const deployment = loadDeployment("local");
  const passport = passportRecord();
  const migration = migrationRecord(passport);
  const validVault = memoryVault(passport.passport_id, passport.agent_key_hash);
  const cases: MemoryVaultArtifact[] = [
    { ...validVault, metadata: { ...validVault.metadata, passport_id: `0x${"3".repeat(64)}` } },
    { ...validVault, metadata: { ...validVault.metadata, agent_key_hash: `0x${"4".repeat(64)}` } },
    { ...validVault, vault_digest: "0".repeat(64) },
    { ...validVault, metadata: { ...validVault.metadata, encrypted_payload_digest: "1".repeat(64) } },
  ];

  for (const vault of cases) {
    const bundle = createAuditBundle(deployment, passportEvents(deployment, passport, migration), [], [], [passport], [migration], [vault]);
    assert.equal(bundle.ok, false);
  }
});

test("audit bundle memory vault privacy scan rejects private public metadata", () => {
  const deployment = loadDeployment("local");
  const passport = passportRecord();
  const migration = migrationRecord(passport);
  const vault = memoryVault(passport.passport_id, passport.agent_key_hash) as MemoryVaultArtifact & {
    metadata: MemoryVaultArtifact["metadata"] & { prompt: string };
  };
  vault.metadata.prompt = "do not expose this";
  const bundle = createAuditBundle(deployment, passportEvents(deployment, passport, migration), [], [], [passport], [migration], [vault]);

  assert.equal(bundle.ok, false);
  assert.equal(bundle.privacy_scan.ok, false);
  assert.match(bundle.errors.join("\n"), /memory vault: forbidden private field|privacy:/);
});

test("audit bundle rejects missing or inconsistent agent passport events", () => {
  const deployment = loadDeployment("local");
  const passport = passportRecord();
  const migration = migrationRecord(passport);
  const missing = createAuditBundle(deployment, [], [], [], [passport], [migration]);

  assert.equal(missing.ok, false);
  assert.match(missing.errors.join("\n"), /missing AgentPassportRegistered/);
  assert.match(missing.errors.join("\n"), /missing AgentPassportMigrationRecorded/);

  const tampered = passportEvents(deployment, passport, migration).map((event) =>
    event.event_name === "AgentPassportMigrationRecorded"
      ? { ...event, args: { ...event.args, migrationIndex: 2 } }
      : event,
  );
  const bundle = createAuditBundle(deployment, tampered, [], [], [passport], [migration]);
  assert.equal(bundle.ok, false);
  assert.match(bundle.errors.join("\n"), /migrationIndex mismatch/);
});

test("audit bundle rejects missing invalidation for upheld challenge", () => {
  const deployment = loadDeployment("local");
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const challenge = readChallengeRecord(CHALLENGE_UPHELD);
  const events = happyPathEvents(deployment).filter((event) => event.event_name !== "EvidenceInvalidated");
  const bundle = createAuditBundle(deployment, events, [report], [challenge]);

  assert.equal(bundle.ok, false);
  assert.match(bundle.errors.join("\n"), /missing EvidenceInvalidated/);
});

test("audit bundle rejects tampered challenge event args", () => {
  const deployment = loadDeployment("local");
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const challenge = readChallengeRecord(CHALLENGE_UPHELD);
  const events = happyPathEvents(deployment).map((event) =>
    event.event_name === "ChallengeSubmitted"
      ? { ...event, args: { ...event.args, challenger: "0x7777777777777777777777777777777777777777" } }
      : event,
  );
  const bundle = createAuditBundle(deployment, events, [report], [challenge]);

  assert.equal(bundle.ok, false);
  assert.match(bundle.errors.join("\n"), /ChallengeSubmitted event does not match record/);
});

test("audit bundle rejects tampered evidence event args", () => {
  const deployment = loadDeployment("local");
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const challenge = readChallengeRecord(CHALLENGE_UPHELD);
  const events = happyPathEvents(deployment).map((event) =>
    event.event_name === "EvidenceSubmitted"
      ? { ...event, args: { ...event.args, reporter: "0x7777777777777777777777777777777777777777" } }
      : event,
  );
  const bundle = createAuditBundle(deployment, events, [report], [challenge]);

  assert.equal(bundle.ok, false);
  assert.match(bundle.errors.join("\n"), /EvidenceSubmitted event does not match artifact/);
});

test("audit bundle rejects challenge resolution status conflicts", () => {
  const deployment = loadDeployment("local");
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const challenge = { ...readChallengeRecord(CHALLENGE_UPHELD), status: "rejected" as const };
  const bundle = createAuditBundle(deployment, happyPathEvents(deployment), [report], [challenge]);

  assert.equal(bundle.ok, false);
  assert.match(bundle.errors.join("\n"), /ChallengeResolved event does not match record status/);
});

test("audit bundle privacy scan rejects private fields and secret-like strings", () => {
  const deployment = loadDeployment("local");
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const challenge = readChallengeRecord(CHALLENGE_UPHELD);
  const events = [
    ...happyPathEvents(deployment),
    event(deployment, "VerificationRegistry", "EvidenceSubmitted", 7, {
      evidenceId: "0x" + "1".repeat(64),
      moduleDigest: "0x" + "2".repeat(64),
      evidenceType: 3,
      reporter: report.reporter,
      prompt: "do not include this",
      facts: ["private fact"],
      private_telemetry: { traceback: "hidden" },
      local_path: "C:\\Users\\15216\\secret.txt",
      remote_url: "https://example.test/callback?token=1",
      secret_value: "api_key=abc123",
    }),
  ];
  const bundle = createAuditBundle(deployment, events, [report], [challenge]);

  assert.equal(bundle.ok, false);
  assert.equal(bundle.privacy_scan.ok, false);
  assert.match(bundle.errors.join("\n"), /privacy:/);
});

test("audit bundle validates EC-16A module verification work claim linkage", () => {
  const deployment = loadDeployment("local");
  const { manifest, acquisition, run, claim } = ec16aArtifacts();
  const bundle = createAuditBundle(
    deployment,
    [],
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
    [],
    [manifest],
    [acquisition],
    [run],
    [claim],
  );

  assert.equal(bundle.ok, true, bundle.errors.join("; "));
  assert.equal(bundle.community_work_linkage?.[0].artifact_valid, true);
  assert.equal(bundle.community_work_linkage?.[0].manifest_linked, true);
  assert.equal(bundle.community_work_linkage?.[0].acquisition_receipt_linked, true);
  assert.equal(bundle.community_work_linkage?.[0].verification_run_linked, true);
  assert.equal(bundle.community_work_linkage?.[0].hash_matched, true);
  assert.equal(bundle.community_work_linkage?.[0].proof_bound, true);
});

test("audit bundle rejects EC-16A missing linked artifact hashes", () => {
  const deployment = loadDeployment("local");
  const { manifest, acquisition, run } = ec16aArtifacts();
  const claim = createCommunityWorkClaim({
    claim_id: "claim-demo-module-missing-artifact",
    responsible_address: EC16_RESPONSIBLE,
    work_kind: "testing",
    summary: "validated demo module in isolated runner",
    proof_uri: "https://github.com/originagent/demo-module/proofs/report.md",
    proof_digest: "2".repeat(64),
    artifact_hashes: [manifest.manifest_hash, acquisition.receipt_hash, run.receipt_hash, "f".repeat(64)],
    created_at: EC16_CREATED_AT,
  });
  const bundle = createAuditBundle(
    deployment,
    [],
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
    [],
    [manifest],
    [acquisition],
    [run],
    [claim],
  );

  assert.equal(bundle.ok, false);
  assert.match(bundle.errors.join("\n"), /references missing artifact hash/);
});

test("audit bundle rejects EC-16A acquisition receipts with hash mismatch", () => {
  const deployment = loadDeployment("local");
  const { manifest, acquisition, run, claim } = ec16aArtifacts(false);
  const bundle = createAuditBundle(
    deployment,
    [],
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
    [],
    [manifest],
    [acquisition],
    [run],
    [claim],
  );

  assert.equal(bundle.ok, false);
  assert.equal(bundle.community_work_linkage?.[0].hash_matched, false);
  assert.match(bundle.errors.join("\n"), /hash_matched=false/);
});

test("audit bundle rejects EC-16A run receipts with missing manifest or acquisition", () => {
  const deployment = loadDeployment("local");
  const { manifest, acquisition, claim } = ec16aArtifacts();
  const missingManifestRun = createVerificationRunReceipt({
    module_id: manifest.module_id,
    manifest_hash: "a".repeat(64),
    acquisition_receipt_hash: acquisition.receipt_hash,
    validator_address: EC16_VALIDATOR,
    environment_hash: "4".repeat(64),
    run_result: "passed",
    log_uri: "https://github.com/originagent/demo-module/proofs/run-log.txt",
    log_digest: "3".repeat(64),
    started_at: EC16_CREATED_AT,
    completed_at: EC16_CREATED_AT,
    created_at: EC16_CREATED_AT,
  });
  const missingManifest = createAuditBundle(
    deployment,
    [],
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
    [],
    [manifest],
    [acquisition],
    [missingManifestRun],
    [{ ...claim, artifact_hashes: [manifest.manifest_hash, acquisition.receipt_hash, missingManifestRun.receipt_hash] }],
  );
  assert.equal(missingManifest.ok, false);
  assert.match(missingManifest.errors.join("\n"), /references missing manifest/);

  const missingAcquisitionRun = createVerificationRunReceipt({
    module_id: manifest.module_id,
    manifest_hash: manifest.manifest_hash,
    acquisition_receipt_hash: "b".repeat(64),
    validator_address: EC16_VALIDATOR,
    environment_hash: "4".repeat(64),
    run_result: "passed",
    log_uri: "https://github.com/originagent/demo-module/proofs/run-log.txt",
    log_digest: "3".repeat(64),
    started_at: EC16_CREATED_AT,
    completed_at: EC16_CREATED_AT,
    created_at: EC16_CREATED_AT,
  });
  const missingAcquisition = createAuditBundle(
    deployment,
    [],
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
    [],
    [manifest],
    [acquisition],
    [missingAcquisitionRun],
    [{ ...claim, artifact_hashes: [manifest.manifest_hash, acquisition.receipt_hash, missingAcquisitionRun.receipt_hash] }],
  );
  assert.equal(missingAcquisition.ok, false);
  assert.match(missingAcquisition.errors.join("\n"), /references missing acquisition receipt/);
});

test("audit bundle rejects EC-16A missing proof binding", () => {
  const deployment = loadDeployment("local");
  const { manifest, acquisition, run, claim } = ec16aArtifacts();
  const missingProof = { ...claim, proof_digest: "", claim_hash: "0".repeat(64) };
  const bundle = createAuditBundle(
    deployment,
    [],
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
    [],
    [manifest],
    [acquisition],
    [run],
    [missingProof],
  );

  assert.equal(bundle.ok, false);
  assert.equal(bundle.community_work_linkage?.[0].proof_bound, false);
  assert.match(bundle.errors.join("\n"), /proof_digest|missing proof_uri or proof_digest/);
});

test("audit-bundle CLI writes JSON and readIndexedEvents reads JSONL", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec6-audit-"));
  const eventsPath = join(tmp, "events.jsonl");
  const outPath = join(tmp, "audit-bundle.json");
  writeFileSync(eventsPath, happyPathEvents(loadDeployment("local")).map((event) => JSON.stringify(event)).join("\n") + "\n");

  const output = execFileSync(
    process.execPath,
    [
      CLI,
      "audit-bundle",
      "--events",
      eventsPath,
      "--evidence-reports",
      VALIDATOR_REPORT,
      "--challenge-records",
      CHALLENGE_UPHELD,
      "--out",
      outPath,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  const parsed = JSON.parse(output);
  const written = JSON.parse(readFileSync(outPath, "utf8"));
  assert.equal(parsed.ok, true);
  assert.equal(written.ok, true);
  assert.equal(readIndexedEvents(eventsPath).length, happyPathEvents(loadDeployment("local")).length);
});

test("audit-bundle CLI accepts memory vault artifacts", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec9-audit-"));
  const deployment = loadDeployment("local");
  const passport = passportRecord();
  const migration = migrationRecord(passport);
  const vault = memoryVault(passport.passport_id, passport.agent_key_hash);
  const eventsPath = join(tmp, "events.jsonl");
  const passportPath = join(tmp, "agent-passport.json");
  const migrationPath = join(tmp, "agent-migration.json");
  const vaultPath = join(tmp, "memory-vault.json");
  const outPath = join(tmp, "audit-bundle.json");
  writeFileSync(eventsPath, passportEvents(deployment, passport, migration).map((event) => JSON.stringify(event)).join("\n") + "\n");
  writeFileSync(passportPath, JSON.stringify(passport));
  writeFileSync(migrationPath, JSON.stringify(migration));
  writeFileSync(vaultPath, JSON.stringify(vault));

  const output = execFileSync(
    process.execPath,
    [
      CLI,
      "audit-bundle",
      "--events",
      eventsPath,
      "--agent-passports",
      passportPath,
      "--agent-migrations",
      migrationPath,
      "--memory-vaults",
      vaultPath,
      "--out",
      outPath,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  const parsed = JSON.parse(output);
  assert.equal(parsed.ok, true, parsed.errors?.join("; "));
  assert.equal(parsed.memory_vault_linkage[0].passport_linked, true);
});

test("index-events CLI requires RPC and output path", () => {
  const missingOut = spawnSync(process.execPath, [CLI, "index-events", "--network", "local"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.notEqual(missingOut.status, 0);
  assert.match(JSON.parse(missingOut.stdout).error, /missing --out/);

  const previousRpc = process.env.EVOLUTION_CHAIN_RPC_URL;
  delete process.env.EVOLUTION_CHAIN_RPC_URL;
  try {
    const missingRpc = spawnSync(
      process.execPath,
      [CLI, "index-events", "--network", "local", "--out", join(tmpdir(), "events.jsonl")],
      { cwd: ROOT, encoding: "utf8" },
    );
    assert.notEqual(missingRpc.status, 0);
    assert.match(JSON.parse(missingRpc.stdout).error, /EVOLUTION_CHAIN_RPC_URL is required/);
  } finally {
    if (previousRpc !== undefined) {
      process.env.EVOLUTION_CHAIN_RPC_URL = previousRpc;
    }
  }

  const invalidRange = spawnSync(
    process.execPath,
    [CLI, "index-events", "--network", "local", "--from-block", "2", "--to-block", "1", "--out", join(tmpdir(), "events.jsonl")],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, EVOLUTION_CHAIN_RPC_URL: "http://127.0.0.1:8545" },
    },
  );
  assert.notEqual(invalidRange.status, 0);
  assert.match(JSON.parse(invalidRange.stdout).error, /--from-block must be less than or equal to --to-block/);
});

test("audit-bundle CLI requires output path", () => {
  const result = spawnSync(
    process.execPath,
    [CLI, "audit-bundle", "--events", "events.jsonl", "--evidence-reports", VALIDATOR_REPORT, "--challenge-records", CHALLENGE_UPHELD],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(JSON.parse(result.stdout).error, /usage: audit-bundle/);
});

function happyPathEvents(deployment: DeploymentInfo): IndexedChainEvent[] {
  const report = readEvidenceReport(VALIDATOR_REPORT);
  const challenge = readChallengeRecord(CHALLENGE_UPHELD);
  const evidenceId = computeEvidenceId(report);
  const challengeId = computeChallengeId(challenge.evidence_id, challenge.challenger, challenge.reason_hash);
  return [
    event(deployment, "IdentityRegistry", "IdentityRegistered", 1, {
      subject: challenge.reporter,
      role: 2,
      metadataHash: `0x${"7".repeat(64)}`,
    }),
    event(deployment, "ModuleRegistry", "ModuleSubmitted", 2, {
      moduleDigest: `0x${report.module_digest}`,
      moduleIdHash: `0x${"8".repeat(64)}`,
      moduleType: 4,
      versionHash: `0x${"9".repeat(64)}`,
      storageUri: `oci://registry.example/originagent/demo-tool@sha256:${report.module_digest}`,
      submitter: "0x5555555555555555555555555555555555555555",
    }),
    event(deployment, "VerificationRegistry", "EvidenceSubmitted", 3, {
      evidenceId,
      moduleDigest: `0x${report.module_digest}`,
      evidenceType: evidenceTypeId(report.evidence_type),
      reporter: report.reporter,
    }),
    event(deployment, "VerificationRegistry", "ChallengeSubmitted", 4, {
      challengeId,
      evidenceId,
      moduleDigest: challenge.module_digest,
      reasonHash: challenge.reason_hash,
      challenger: challenge.challenger,
    }),
    event(deployment, "VerificationRegistry", "EvidenceInvalidated", 5, {
      evidenceId,
      reasonHash: challenge.resolution_hash,
      actor: "0x5555555555555555555555555555555555555555",
    }),
    event(deployment, "VerificationRegistry", "ChallengeResolved", 6, {
      challengeId,
      evidenceId,
      upheld: true,
      resolutionHash: challenge.resolution_hash,
      resolver: "0x5555555555555555555555555555555555555555",
    }),
  ];
}

function passportRecord(owner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"): AgentPassportRecord {
  return createAgentPassportRecord({
    owner,
    agentKeyHash: `0x${"a".repeat(64)}`,
    genesisNonce: `0x${"b".repeat(64)}`,
    metadataHash: `0x${"0".repeat(64)}`,
  });
}

function reputationReport(passport: AgentPassportRecord, challenges: ReturnType<typeof readChallengeRecord>[]): AgentReputationReport {
  return createAgentReputationReport({
    passportId: passport.passport_id,
    owner: passport.owner,
    records: challenges.map((challenge) =>
      createAgentReputationRecord({
        passportId: passport.passport_id,
        owner: passport.owner,
        source: challenge.status === "upheld" ? "challenge_upheld" : "challenge_rejected",
        sourceId: challenge.challenge_id,
        subjectAddress: challenge.challenger,
        createdAt: challenge.created_at,
      }),
    ),
    continuitySignals: ["passport_registered"],
  });
}

function reputationCheckpointEvent(
  deployment: DeploymentInfo,
  report: AgentReputationReport,
  logIndex: number,
): IndexedChainEvent {
  return event(deployment, "AgentReputationRegistry", "AgentReputationCheckpointed", logIndex, {
    passportId: report.passport_id,
    score: report.score,
    positiveCount: report.positive_count,
    negativeCount: report.negative_count,
    reportHash: `0x${report.report_hash}`,
    checkpointIndex: 1,
  });
}

function unitKindProposal(): UnitKindProposal {
  return createUnitKindProposal({
    kind_id: "tool",
    version: "1",
    display_name: "Tool",
    description: "Legacy executable tool unit kind.",
    runtime_surface: "tool_call",
    schema_hash: "1".repeat(64),
    schema_uri: "ipfs://unit-kind/tool/v1/schema",
    permission_model: "declared tool permissions only",
    verification_profile: "validator tool execution replay",
    risk_class: "executable_tool",
    sandbox_requirement: "isolated process without secret access",
    install_semantics: "install as a legacy ModuleType.Tool-compatible unit",
    rollback_semantics: "remove unit manifest and restore previous activation",
    compatibility_rules: "maps to ModuleType.Tool for EC-11 v1",
    deprecation_rules: "legacy mapping remains auditable after deprecation",
  });
}

function unitKindReview(proposal: UnitKindProposal): UnitKindReview {
  return createUnitKindReview({
    kind_id: proposal.kind_id,
    version: proposal.version,
    reviewer: "0x5555555555555555555555555555555555555555",
    recommended_status: "Canonical",
    risk_assessment: "low risk compatibility kind",
    validation_summary_hash: "2".repeat(64),
  });
}

function unitKindEvents(
  deployment: DeploymentInfo,
  proposal: UnitKindProposal,
  review: UnitKindReview,
): IndexedChainEvent[] {
  const kindIdHash = computeUnitKindIdHash(proposal.kind_id);
  const versionHash = computeUnitKindVersionHash(proposal.version);
  const kindVersionKey = computeUnitKindVersionKey(kindIdHash, versionHash);
  return [
    event(deployment, "EvolutionUnitKindRegistry", "EvolutionUnitKindProposed", 1, {
      kindVersionKey,
      kindIdHash,
      versionHash,
      schemaHash: `0x${proposal.schema_hash}`,
      proposalHash: `0x${proposal.proposal_hash}`,
      submitter: "0x5555555555555555555555555555555555555555",
    }),
    event(deployment, "EvolutionUnitKindRegistry", "EvolutionUnitKindReviewSet", 2, {
      kindVersionKey,
      kindIdHash,
      versionHash,
      reviewReportHash: `0x${review.review_hash}`,
    }),
    event(deployment, "EvolutionUnitKindRegistry", "EvolutionUnitKindStatusChanged", 3, {
      kindVersionKey,
      kindIdHash,
      versionHash,
      previousStatus: 1,
      newStatus: 4,
    }),
  ];
}

function ec16aArtifacts(hashMatched = true): {
  manifest: ModuleManifest;
  acquisition: ModuleAcquisitionReceipt;
  run: VerificationRunReceipt;
  claim: CommunityWorkClaim;
} {
  const manifest = createModuleManifest({
    module_id: "github.com/originagent/demo-module@1.0.0",
    module_name: "demo-module",
    version: "1.0.0",
    storage_uri: "https://github.com/originagent/demo-module/releases/download/v1/module.tar.gz",
    storage_kind: "github_release",
    module_digest: "1".repeat(64),
    digest_algorithm: "sha256",
    responsible_address: EC16_RESPONSIBLE,
    source_repository_uri: "https://github.com/originagent/demo-module",
    created_at: EC16_CREATED_AT,
  });
  const acquisition = createModuleAcquisitionReceipt({
    module_id: manifest.module_id,
    manifest_hash: manifest.manifest_hash,
    storage_uri: manifest.storage_uri,
    downloaded_digest: hashMatched ? manifest.module_digest : "9".repeat(64),
    expected_digest: manifest.module_digest,
    hash_matched: hashMatched,
    acquired_by: EC16_VALIDATOR,
    acquired_at: EC16_CREATED_AT,
    created_at: EC16_CREATED_AT,
  });
  const run = createVerificationRunReceipt({
    module_id: manifest.module_id,
    manifest_hash: manifest.manifest_hash,
    acquisition_receipt_hash: acquisition.receipt_hash,
    validator_address: EC16_VALIDATOR,
    environment_hash: "4".repeat(64),
    run_result: "passed",
    log_uri: "https://github.com/originagent/demo-module/proofs/run-log.txt",
    log_digest: "3".repeat(64),
    started_at: EC16_CREATED_AT,
    completed_at: EC16_CREATED_AT,
    created_at: EC16_CREATED_AT,
  });
  const claim = createCommunityWorkClaim({
    claim_id: "claim-demo-module-1",
    responsible_address: EC16_RESPONSIBLE,
    work_kind: "testing",
    summary: "validated demo module in isolated runner",
    proof_uri: "https://github.com/originagent/demo-module/proofs/report.md",
    proof_digest: "2".repeat(64),
    artifact_hashes: [manifest.manifest_hash, acquisition.receipt_hash, run.receipt_hash],
    created_at: EC16_CREATED_AT,
  });
  return { manifest, acquisition, run, claim };
}

function migrationRecord(passport: AgentPassportRecord): AgentMigrationRecord {
  return createAgentMigrationRecord({
    passportId: passport.passport_id,
    owner: passport.owner,
    oldAgentKeyHash: passport.agent_key_hash,
    newAgentKeyHash: `0x${"c".repeat(64)}`,
    migrationNonce: `0x${"d".repeat(64)}`,
  });
}

function memoryVault(passportId: string, agentKeyHash: string): MemoryVaultArtifact {
  const encryptedPayload = Buffer.from("ciphertext", "utf8");
  const encryptedPayloadDigest = sha256(encryptedPayload);
  const metadata = {
    passport_id: passportId as `0x${string}`,
    agent_key_hash: agentKeyHash as `0x${string}`,
    vault_nonce: `0x${"e".repeat(64)}` as `0x${string}`,
    created_at: "2026-05-23T00:00:00Z",
    source_ledger_terminal_hash: "",
    included_files: [
      {
        path: "SOUL.md",
        sha256: sha256(Buffer.from("soul", "utf8")),
        size: 4,
      },
    ],
    payload_digest: sha256(Buffer.from("payload", "utf8")),
    encrypted_payload_digest: encryptedPayloadDigest,
    encryption: {
      algorithm: "AES-256-GCM" as const,
      nonce_b64: Buffer.alloc(12, 1).toString("base64url"),
    },
  };
  return {
    schema_version: "originagent.evolution.memory_vault.v1",
    vault_digest: computeMemoryVaultDigest(metadata, encryptedPayloadDigest),
    metadata,
    encrypted_payload_b64: encryptedPayload.toString("base64url"),
  };
}

function passportEvents(
  deployment: DeploymentInfo,
  passport: AgentPassportRecord,
  migration: AgentMigrationRecord,
): IndexedChainEvent[] {
  return [
    event(deployment, "AgentPassportRegistry", "AgentPassportRegistered", 1, {
      passportId: passport.passport_id,
      owner: passport.owner,
      agentKeyHash: passport.agent_key_hash,
      genesisHash: passport.genesis_hash,
      metadataHash: passport.metadata_hash,
    }),
    event(deployment, "AgentPassportRegistry", "AgentPassportMigrationRecorded", 2, {
      passportId: migration.passport_id,
      owner: migration.owner,
      oldAgentKeyHash: migration.old_agent_key_hash,
      newAgentKeyHash: migration.new_agent_key_hash,
      migrationHash: migration.migration_hash,
      migrationIndex: 1,
    }),
  ];
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function multiNodeRejectedChallengeEvents(deployment: DeploymentInfo): IndexedChainEvent[] {
  const reports = [readEvidenceReport(VALIDATOR_REPORT), readEvidenceReport(SECOND_VALIDATOR_REPORT)];
  const challenge = readChallengeRecord(CHALLENGE_REJECTED);
  const evidenceIds = reports.map((report) => computeEvidenceId(report));
  const challengeId = computeChallengeId(challenge.evidence_id, challenge.challenger, challenge.reason_hash);
  return [
    event(deployment, "IdentityRegistry", "IdentityRegistered", 1, {
      subject: reports[0].reporter,
      role: 2,
      metadataHash: `0x${"7".repeat(64)}`,
    }),
    event(deployment, "IdentityRegistry", "IdentityRegistered", 2, {
      subject: reports[1].reporter,
      role: 2,
      metadataHash: `0x${"8".repeat(64)}`,
    }),
    event(deployment, "ModuleRegistry", "ModuleSubmitted", 3, {
      moduleDigest: `0x${reports[0].module_digest}`,
      moduleIdHash: `0x${"8".repeat(64)}`,
      moduleType: 4,
      versionHash: `0x${"9".repeat(64)}`,
      storageUri: `oci://registry.example/originagent/demo-tool@sha256:${reports[0].module_digest}`,
      submitter: "0x5555555555555555555555555555555555555555",
    }),
    ...reports.map((report, index) =>
      event(deployment, "VerificationRegistry", "EvidenceSubmitted", 4 + index, {
        evidenceId: evidenceIds[index],
        moduleDigest: `0x${report.module_digest}`,
        evidenceType: evidenceTypeId(report.evidence_type),
        reporter: report.reporter,
      }),
    ),
    event(deployment, "VerificationRegistry", "ChallengeSubmitted", 6, {
      challengeId,
      evidenceId: challenge.evidence_id,
      moduleDigest: challenge.module_digest,
      reasonHash: challenge.reason_hash,
      challenger: challenge.challenger,
    }),
    event(deployment, "VerificationRegistry", "ChallengeResolved", 7, {
      challengeId,
      evidenceId: challenge.evidence_id,
      upheld: false,
      resolutionHash: challenge.resolution_hash,
      resolver: "0x5555555555555555555555555555555555555555",
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
