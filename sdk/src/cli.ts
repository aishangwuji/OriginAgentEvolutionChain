#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { prepareModuleSubmission, readProofBundle, validateProofBundle } from "./proof.ts";
import { computeScoreCommitHash, verifyScoreReveal } from "./score.ts";
import { loadDeployment } from "./contracts.ts";
import { readChainStateCheck } from "./chain-state.ts";
import { indexEvents, readIndexedEvents, writeAuditBundle } from "./indexer.ts";
import {
  createAdjudicationReport,
  createChallengeResponse,
  createValidatorVerdict,
  readAdjudicationReport,
  readChallengeResponse,
  readValidatorVerdict,
  validateAdjudicationReport,
  validateChallengeResponse,
  validateValidatorVerdict,
  writeAdjudicationReport,
  writeChallengeResponse,
  writeValidatorVerdictCommitment,
  writeValidatorVerdictReveal,
  writeValidatorVerdict,
} from "./adjudication.ts";
import {
  computeAgentGenesisHash,
  computeAgentKeyHash,
  computeAgentMigrationHash,
  computeAgentPassportId,
  createAgentMigrationRecord,
  createAgentPassportRecord,
  readAgentMigrationRecord,
  readAgentPassportRecord,
  validateAgentMigrationRecord,
  validateAgentPassportRecord,
  writeAgentMigrationRecord,
  writeAgentPassportRecord,
} from "./passport.ts";
import {
  computeChallengeSummary,
  computeExternalValidatorArtifactHash,
  computeEvidenceSummary,
  createChallengeRecord,
  createEvidenceReport,
  createExternalValidatorArtifact,
  readChallengeRecord,
  readChallengeSummary,
  readEvidenceReport,
  readExternalValidatorArtifact,
  validateChallengeRecord,
  validateExternalValidatorArtifact,
  writeChallengeRecord,
  writeEvidenceReport,
  writeExternalValidatorArtifact,
  type ChallengeStatus,
  type EvidenceType,
} from "./evidence.ts";
import {
  commitValidatorVerdictTransaction,
  expireChallengeNoQuorumTransaction,
  invalidateEvidenceTransaction,
  checkpointAgentReputationTransaction,
  consumeTestCreditTransaction,
  proposeUnitKindTransaction,
  recordAgentMigrationTransaction,
  registerIdentityTransaction,
  registerAgentPassportTransaction,
  grantTestCreditTransaction,
  finalizeChallengeAdjudicationTransaction,
  resolveChallengeTransaction,
  setUnitKindReviewTransaction,
  setUnitKindStatusTransaction,
  setValidatorProfileTransaction,
  submitChallengeTransaction,
  submitChallengeResponseTransaction,
  submitModuleTransaction,
  submitScoreCommitTransaction,
  submitScoreRevealTransaction,
  submitToolModuleTransaction,
  submitValidatorReportTransaction,
  submitValidatorVerdictTransaction,
  submitVerificationTransaction,
  revealValidatorVerdictTransaction,
} from "./transactions.ts";
import {
  createAgentReputationRecord,
  createAgentReputationReport,
  readAgentReputationRecord,
  readAgentReputationReport,
  validateAgentReputationRecord,
  validateAgentReputationReport,
  writeAgentReputationRecord,
  writeAgentReputationReport,
  type AgentReputationSource,
} from "./reputation.ts";
import {
  createUnitKindProposal,
  createUnitKindReview,
  readUnitKindProposal,
  readUnitKindReview,
  validateUnitKindProposal,
  validateUnitKindReview,
  writeUnitKindProposal,
  writeUnitKindReview,
  type UnitKindStatus,
} from "./unit-kind.ts";
import {
  createCommunityWorkClaim,
  createModuleAcquisitionReceipt,
  createModuleManifest,
  createVerificationRunReceipt,
  readCommunityWorkClaim,
  readModuleAcquisitionReceipt,
  readModuleManifest,
  readVerificationRunReceipt,
  validateCommunityWorkClaim,
  validateModuleAcquisitionReceipt,
  validateModuleManifest,
  validateVerificationRunReceipt,
  writeCommunityWorkClaim,
  writeModuleAcquisitionReceipt,
  writeModuleManifest,
  writeVerificationRunReceipt,
  type CommunityWorkKind,
  type DigestAlgorithm,
  type VerificationRunResult,
} from "./module-verification.ts";
import {
  analyzeAdversarialSimulation,
  readAbuseReport,
  validateAbuseReport,
  writeAbuseReport,
} from "./adversarial.ts";
import {
  evaluateTrustPolicy,
  readTrustPolicyReport,
  validateTrustPolicyReport,
  writeTrustPolicyReport,
} from "./trust-policy.ts";
import {
  createTestCreditAction,
  createTestCreditReport,
  readTestCreditAction,
  readTestCreditReport,
  validateTestCreditAction,
  validateTestCreditReport,
  writeTestCreditAction,
  writeTestCreditReport,
  type TestCreditActionType,
  type TestCreditReason,
} from "./test-credit.ts";
import type { TransactionOptions } from "./transactions.ts";

type Flags = Record<string, string | true>;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === "verify-proof") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: verify-proof <proof_bundle.json>");
      }
      const result = validateProofBundle(readProofBundle(path));
      printJson(result);
      return result.ok ? 0 : 1;
    }
    if (command === "prepare-module") {
      const path = rest[0];
      const flags = parseFlags(rest.slice(1));
      if (!path || typeof flags["storage-uri"] !== "string") {
        throw new Error("usage: prepare-module <proof_bundle.json> --storage-uri <uri>");
      }
      printJson(prepareModuleSubmission(readProofBundle(path), flags["storage-uri"]));
      return 0;
    }
    if (command === "deploy-info") {
      const flags = parseFlags(rest);
      printJson(loadDeployment(stringFlag(flags, "network"), deploymentsDirFlag(flags)));
      return 0;
    }
    if (command === "register-identity") {
      const flags = parseFlags(rest);
      const result = await registerIdentityTransaction(
        stringFlag(flags, "role"),
        stringFlag(flags, "metadata-hash"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "compute-agent-key-hash") {
      const flags = parseFlags(rest);
      printJson({ agent_key_hash: computeAgentKeyHash(stringFlag(flags, "public-key")) });
      return 0;
    }
    if (command === "compute-agent-genesis-hash") {
      const flags = parseFlags(rest);
      printJson({
        genesis_hash: computeAgentGenesisHash(
          stringFlag(flags, "owner"),
          stringFlag(flags, "agent-key-hash"),
          stringFlag(flags, "genesis-nonce"),
          stringFlag(flags, "metadata-hash"),
        ),
      });
      return 0;
    }
    if (command === "compute-agent-passport-id") {
      const flags = parseFlags(rest);
      printJson({
        passport_id: computeAgentPassportId(
          stringFlag(flags, "owner"),
          stringFlag(flags, "agent-key-hash"),
          stringFlag(flags, "genesis-hash"),
        ),
      });
      return 0;
    }
    if (command === "compute-agent-migration-hash") {
      const flags = parseFlags(rest);
      printJson({
        migration_hash: computeAgentMigrationHash(
          stringFlag(flags, "passport-id"),
          stringFlag(flags, "old-agent-key-hash"),
          stringFlag(flags, "new-agent-key-hash"),
          stringFlag(flags, "migration-nonce"),
        ),
      });
      return 0;
    }
    if (command === "create-agent-passport-record") {
      const flags = parseFlags(rest);
      const record = createAgentPassportRecord({
        owner: stringFlag(flags, "owner"),
        agentKeyHash: stringFlag(flags, "agent-key-hash"),
        genesisNonce: stringFlag(flags, "genesis-nonce"),
        metadataHash: stringFlag(flags, "metadata-hash"),
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeAgentPassportRecord(record, out) : record);
      return 0;
    }
    if (command === "validate-agent-passport-record") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-agent-passport-record <file>");
      }
      const validation = validateAgentPassportRecord(readAgentPassportRecord(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "create-agent-migration-record") {
      const flags = parseFlags(rest);
      const record = createAgentMigrationRecord({
        passportId: stringFlag(flags, "passport-id"),
        owner: stringFlag(flags, "owner"),
        oldAgentKeyHash: stringFlag(flags, "old-agent-key-hash"),
        newAgentKeyHash: stringFlag(flags, "new-agent-key-hash"),
        migrationNonce: stringFlag(flags, "migration-nonce"),
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeAgentMigrationRecord(record, out) : record);
      return 0;
    }
    if (command === "validate-agent-migration-record") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-agent-migration-record <file>");
      }
      const validation = validateAgentMigrationRecord(readAgentMigrationRecord(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "register-agent-passport") {
      const flags = parseFlags(rest);
      const result = await registerAgentPassportTransaction(
        stringFlag(flags, "owner"),
        stringFlag(flags, "agent-key-hash"),
        stringFlag(flags, "genesis-hash"),
        stringFlag(flags, "metadata-hash"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "record-agent-migration") {
      const flags = parseFlags(rest);
      const result = await recordAgentMigrationTransaction(
        stringFlag(flags, "owner"),
        stringFlag(flags, "passport-id"),
        stringFlag(flags, "new-agent-key-hash"),
        stringFlag(flags, "migration-hash"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "create-agent-reputation-record") {
      const flags = parseFlags(rest);
      const record = createAgentReputationRecord({
        passportId: stringFlag(flags, "passport-id"),
        owner: stringFlag(flags, "owner"),
        source: reputationSourceFlag(flags, "source"),
        sourceId: stringFlag(flags, "source-id"),
        subjectAddress: stringFlag(flags, "subject-address"),
        createdAt: stringFlag(flags, "created-at"),
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeAgentReputationRecord(record, out) : record);
      return 0;
    }
    if (command === "validate-agent-reputation-record") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-agent-reputation-record <file>");
      }
      const validation = validateAgentReputationRecord(readAgentReputationRecord(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "create-agent-reputation-report") {
      const input = reputationReportInput(rest);
      const report = createAgentReputationReport({
        passportId: input.passportId,
        owner: input.owner,
        records: input.recordPaths.map((path) => readAgentReputationRecord(path)),
        continuitySignals: input.continuitySignals,
        warnings: input.warnings,
      });
      printJson(input.out ? writeAgentReputationReport(report, input.out) : report);
      return 0;
    }
    if (command === "validate-agent-reputation-report") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-agent-reputation-report <file>");
      }
      const validation = validateAgentReputationReport(readAgentReputationReport(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "checkpoint-agent-reputation") {
      const flags = parseFlags(rest);
      const result = await checkpointAgentReputationTransaction(
        stringFlag(flags, "passport-id"),
        numberFlag(flags, "score"),
        numberFlag(flags, "positive-count"),
        numberFlag(flags, "negative-count"),
        stringFlag(flags, "report-hash"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "create-unit-kind-proposal") {
      const flags = parseFlags(rest);
      const proposal = createUnitKindProposal({
        kind_id: stringFlag(flags, "kind-id"),
        version: stringFlag(flags, "version"),
        display_name: stringFlag(flags, "display-name"),
        description: stringFlag(flags, "description"),
        runtime_surface: stringFlag(flags, "runtime-surface"),
        schema_hash: stringFlag(flags, "schema-hash"),
        schema_uri: stringFlag(flags, "schema-uri"),
        permission_model: stringFlag(flags, "permission-model"),
        verification_profile: stringFlag(flags, "verification-profile"),
        risk_class: stringFlag(flags, "risk-class"),
        sandbox_requirement: stringFlag(flags, "sandbox-requirement"),
        install_semantics: stringFlag(flags, "install-semantics"),
        rollback_semantics: stringFlag(flags, "rollback-semantics"),
        compatibility_rules: stringFlag(flags, "compatibility-rules"),
        deprecation_rules: stringFlag(flags, "deprecation-rules"),
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeUnitKindProposal(proposal, out) : proposal);
      return 0;
    }
    if (command === "validate-unit-kind-proposal") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-unit-kind-proposal <file>");
      }
      const validation = validateUnitKindProposal(readUnitKindProposal(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "create-unit-kind-review") {
      const flags = parseFlags(rest);
      const review = createUnitKindReview({
        kind_id: stringFlag(flags, "kind-id"),
        version: stringFlag(flags, "version"),
        reviewer: stringFlag(flags, "reviewer"),
        recommended_status: unitKindStatusFlag(flags, "recommended-status"),
        risk_assessment: stringFlag(flags, "risk-assessment"),
        validation_summary_hash: stringFlag(flags, "validation-summary-hash"),
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeUnitKindReview(review, out) : review);
      return 0;
    }
    if (command === "validate-unit-kind-review") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-unit-kind-review <file>");
      }
      const validation = validateUnitKindReview(readUnitKindReview(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "create-module-manifest") {
      const flags = parseFlags(rest);
      const manifest = createModuleManifest({
        module_id: stringFlag(flags, "module-id"),
        module_name: stringFlag(flags, "module-name"),
        version: stringFlag(flags, "version"),
        storage_uri: stringFlag(flags, "storage-uri"),
        storage_kind: optionalStringFlag(flags, "storage-kind") || undefined,
        module_digest: stringFlag(flags, "module-digest"),
        digest_algorithm: digestAlgorithmFlag(flags, "digest-algorithm"),
        responsible_address: stringFlag(flags, "responsible-address"),
        agent_passport_id: optionalStringFlag(flags, "agent-passport-id") || undefined,
        source_repository_uri: optionalStringFlag(flags, "source-repository-uri") || undefined,
        created_at: stringFlag(flags, "created-at"),
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeModuleManifest(manifest, out) : manifest);
      return 0;
    }
    if (command === "validate-module-manifest") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-module-manifest <file>");
      }
      const validation = validateModuleManifest(readModuleManifest(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "create-module-acquisition-receipt") {
      const flags = parseFlags(rest);
      const receipt = createModuleAcquisitionReceipt({
        module_id: stringFlag(flags, "module-id"),
        manifest_hash: stringFlag(flags, "manifest-hash"),
        storage_uri: stringFlag(flags, "storage-uri"),
        downloaded_digest: stringFlag(flags, "downloaded-digest"),
        expected_digest: stringFlag(flags, "expected-digest"),
        hash_matched: booleanFlag(flags, "hash-matched"),
        acquired_by: stringFlag(flags, "acquired-by"),
        acquired_at: stringFlag(flags, "acquired-at"),
        created_at: stringFlag(flags, "created-at"),
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeModuleAcquisitionReceipt(receipt, out) : receipt);
      return 0;
    }
    if (command === "validate-module-acquisition-receipt") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-module-acquisition-receipt <file>");
      }
      const validation = validateModuleAcquisitionReceipt(readModuleAcquisitionReceipt(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "create-verification-run-receipt") {
      const flags = parseFlags(rest);
      const receipt = createVerificationRunReceipt({
        module_id: stringFlag(flags, "module-id"),
        manifest_hash: stringFlag(flags, "manifest-hash"),
        acquisition_receipt_hash: stringFlag(flags, "acquisition-receipt-hash"),
        validator_address: stringFlag(flags, "validator-address"),
        environment_hash: stringFlag(flags, "environment-hash"),
        run_result: verificationRunResultFlag(flags, "run-result"),
        log_uri: stringFlag(flags, "log-uri"),
        log_digest: stringFlag(flags, "log-digest"),
        started_at: stringFlag(flags, "started-at"),
        completed_at: stringFlag(flags, "completed-at"),
        created_at: stringFlag(flags, "created-at"),
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeVerificationRunReceipt(receipt, out) : receipt);
      return 0;
    }
    if (command === "validate-verification-run-receipt") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-verification-run-receipt <file>");
      }
      const validation = validateVerificationRunReceipt(readVerificationRunReceipt(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "create-community-work-claim") {
      const input = communityWorkClaimInput(rest);
      const claim = createCommunityWorkClaim({
        claim_id: input.claimId,
        responsible_address: input.responsibleAddress,
        agent_passport_id: input.agentPassportId || undefined,
        work_kind: input.workKind,
        summary: input.summary,
        proof_uri: input.proofUri,
        proof_digest: input.proofDigest,
        artifact_hashes: input.artifactHashes,
        referenced_events: input.referencedEvents.length > 0 ? input.referencedEvents : undefined,
        created_at: input.createdAt,
      });
      printJson(input.out ? writeCommunityWorkClaim(claim, input.out) : claim);
      return 0;
    }
    if (command === "validate-community-work-claim") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-community-work-claim <file>");
      }
      const validation = validateCommunityWorkClaim(readCommunityWorkClaim(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "propose-unit-kind") {
      const flags = parseFlags(rest);
      const result = await proposeUnitKindTransaction(readUnitKindProposal(stringFlag(flags, "proposal")), commandOptions(flags));
      printJson(result);
      return 0;
    }
    if (command === "set-unit-kind-review") {
      const flags = parseFlags(rest);
      const result = await setUnitKindReviewTransaction(readUnitKindReview(stringFlag(flags, "review")), commandOptions(flags));
      printJson(result);
      return 0;
    }
    if (command === "set-unit-kind-status") {
      const flags = parseFlags(rest);
      const result = await setUnitKindStatusTransaction(
        stringFlag(flags, "kind-id"),
        stringFlag(flags, "version"),
        unitKindStatusFlag(flags, "status"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "analyze-adversarial-simulation") {
      const input = adversarialAnalysisInput(rest);
      const report = analyzeAdversarialSimulation({
        events: readIndexedEvents(input.eventsPath),
        evidenceReports: input.evidenceReportPaths.map((path) => readEvidenceReport(path)),
        agentPassports: input.agentPassportPaths.map((path) => readAgentPassportRecord(path)),
        reputationReports: input.reputationReportPaths.map((path) => readAgentReputationReport(path)),
        unitKindProposals: input.unitKindProposalPaths.map((path) => readUnitKindProposal(path)),
        unitKindReviews: input.unitKindReviewPaths.map((path) => readUnitKindReview(path)),
        generatedAt: input.generatedAt || undefined,
      });
      printJson(input.out ? writeAbuseReport(report, input.out) : report);
      return 0;
    }
    if (command === "validate-abuse-report") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-abuse-report <file>");
      }
      const validation = validateAbuseReport(readAbuseReport(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "evaluate-trust-policy") {
      const flags = parseFlags(rest);
      const abuseReportPath = stringFlag(flags, "abuse-report");
      const out = stringFlag(flags, "out");
      const report = evaluateTrustPolicy({
        abuseReport: readAbuseReport(abuseReportPath),
        generatedAt: optionalStringFlag(flags, "generated-at") || undefined,
      });
      writeTrustPolicyReport(report, out);
      printJson(report);
      return 0;
    }
    if (command === "validate-trust-policy-report") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-trust-policy-report <file> [--source-abuse-report <file>]");
      }
      const flags = parseFlags(rest.slice(1));
      const sourcePath = optionalStringFlag(flags, "source-abuse-report");
      const validation = validateTrustPolicyReport(
        readTrustPolicyReport(path),
        sourcePath ? readAbuseReport(sourcePath) : undefined,
      );
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "create-test-credit-action") {
      const flags = parseFlags(rest);
      const trustPolicyPath = optionalStringFlag(flags, "trust-policy-report");
      const trustPolicyReport = trustPolicyPath ? readTrustPolicyReport(trustPolicyPath) : undefined;
      const action = createTestCreditAction({
        passportId: stringFlag(flags, "passport-id"),
        owner: stringFlag(flags, "owner"),
        action: testCreditActionFlag(flags, "action"),
        reason: testCreditReasonFlag(flags, "reason"),
        amount: optionalStringFlag(flags, "amount") ? numberFlag(flags, "amount") : undefined,
        trustPolicyReport,
        trustPolicyReportHash: optionalStringFlag(flags, "trust-policy-report-hash") || undefined,
        createdAt: stringFlag(flags, "created-at"),
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeTestCreditAction(action, out) : action);
      return 0;
    }
    if (command === "validate-test-credit-action") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-test-credit-action <file> [--trust-policy-report <file>]");
      }
      const flags = parseFlags(rest.slice(1));
      const trustPolicyPath = optionalStringFlag(flags, "trust-policy-report");
      const validation = validateTestCreditAction(
        readTestCreditAction(path),
        trustPolicyPath ? readTrustPolicyReport(trustPolicyPath) : undefined,
      );
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "create-test-credit-report") {
      const input = testCreditReportInput(rest);
      const report = createTestCreditReport({
        passportId: input.passportId,
        owner: input.owner,
        actions: input.actionPaths.map((path) => readTestCreditAction(path)),
        trustPolicyReportHash: input.trustPolicyReportHash || undefined,
      });
      printJson(input.out ? writeTestCreditReport(report, input.out) : report);
      return 0;
    }
    if (command === "validate-test-credit-report") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-test-credit-report <file> [--trust-policy-report <file>]");
      }
      const flags = parseFlags(rest.slice(1));
      const trustPolicyPath = optionalStringFlag(flags, "trust-policy-report");
      const validation = validateTestCreditReport(
        readTestCreditReport(path),
        trustPolicyPath ? readTrustPolicyReport(trustPolicyPath) : undefined,
      );
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "grant-test-credit") {
      const input = testCreditTransactionInput(rest, "grant");
      const result = await grantTestCreditTransaction(
        input.passportId,
        input.amount,
        input.actionHash,
        input.trustPolicyReportHash,
        commandOptions(input.flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "consume-test-credit") {
      const input = testCreditTransactionInput(rest, "consume");
      const result = await consumeTestCreditTransaction(
        input.passportId,
        input.amount,
        input.actionHash,
        input.trustPolicyReportHash,
        commandOptions(input.flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "submit-module") {
      const flags = parseFlags(rest);
      const result = await submitModuleTransaction(
        readProofBundle(stringFlag(flags, "proof-bundle")),
        stringFlag(flags, "storage-uri"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "submit-tool-module") {
      const flags = parseFlags(rest);
      const result = await submitToolModuleTransaction(
        readProofBundle(stringFlag(flags, "proof-bundle")),
        stringFlag(flags, "storage-uri"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "submit-verification") {
      const flags = parseFlags(rest);
      const result = await submitVerificationTransaction(readProofBundle(stringFlag(flags, "proof-bundle")), commandOptions(flags));
      printJson(result);
      return 0;
    }
    if (command === "set-validator-profile") {
      const flags = parseFlags(rest);
      const result = await setValidatorProfileTransaction(
        stringFlag(flags, "validator"),
        stringFlag(flags, "operator-group-hash"),
        stringFlag(flags, "runner-fingerprint-hash"),
        booleanFlag(flags, "allowed"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "submit-validator-report") {
      const flags = parseFlags(rest);
      const result = await submitValidatorReportTransaction(readEvidenceReport(stringFlag(flags, "report")), commandOptions(flags));
      printJson(result);
      return 0;
    }
    if (command === "invalidate-evidence") {
      const flags = parseFlags(rest);
      const result = await invalidateEvidenceTransaction(
        stringFlag(flags, "evidence-id"),
        stringFlag(flags, "reason-hash"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "evidence-summary") {
      const input = evidenceSummaryInput(rest);
      const reports = input.reportPaths.map((path) => readEvidenceReport(path));
      const challengeSummary = input.challengeSummaryPath ? readChallengeSummary(input.challengeSummaryPath) : undefined;
      printJson(computeEvidenceSummary(reports, challengeSummary));
      return 0;
    }
    if (command === "create-external-validator-artifact") {
      const flags = parseFlags(rest);
      const artifact = createExternalValidatorArtifact({
        module_digest: stringFlag(flags, "module-digest"),
        validator: stringFlag(flags, "validator"),
        operator_group_hash: stringFlag(flags, "operator-group-hash"),
        runner_fingerprint_hash: stringFlag(flags, "runner-fingerprint-hash"),
        tool_tests_hash: stringFlag(flags, "tool-tests-hash"),
        result_digest: stringFlag(flags, "result-digest"),
        created_at: stringFlag(flags, "created-at"),
      });
      const out = optionalStringFlag(flags, "out");
      if (out) {
        printJson(writeExternalValidatorArtifact(artifact, out));
      } else {
        printJson({
          artifact,
          canonicalHash: computeExternalValidatorArtifactHash(artifact),
        });
      }
      return 0;
    }
    if (command === "validate-external-validator-artifact") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-external-validator-artifact <file>");
      }
      const validation = validateExternalValidatorArtifact(readExternalValidatorArtifact(path));
      printJson({
        ...validation,
        external_validator_artifact_hash: validation.computedHash,
      });
      return validation.ok ? 0 : 1;
    }
    if (command === "create-evidence-report") {
      const flags = parseFlags(rest);
      const artifactPath = optionalStringFlag(flags, "external-validator-artifact");
      const report = createEvidenceReport({
        moduleDigest: stringFlag(flags, "module-digest"),
        proofBundleHash: stringFlag(flags, "proof-bundle-hash"),
        evidenceType: evidenceTypeFlag(flags, "evidence-type"),
        reporter: stringFlag(flags, "reporter"),
        operatorGroupHash: stringFlag(flags, "operator-group-hash"),
        runnerFingerprintHash: stringFlag(flags, "runner-fingerprint-hash"),
        challengeWindowEnd: numberFlag(flags, "challenge-window-end"),
        externalValidatorArtifact: artifactPath ? readExternalValidatorArtifact(artifactPath) : undefined,
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeEvidenceReport(report, out) : report);
      return 0;
    }
    if (command === "create-challenge-record") {
      const flags = parseFlags(rest);
      const record = createChallengeRecord({
        evidenceId: stringFlag(flags, "evidence-id"),
        moduleDigest: stringFlag(flags, "module-digest"),
        reasonHash: stringFlag(flags, "reason-hash"),
        challenger: stringFlag(flags, "challenger"),
        createdAt: stringFlag(flags, "created-at"),
        status: challengeStatusFlag(flags, "status"),
        reporter: optionalStringFlag(flags, "reporter") || undefined,
        resolutionHash: optionalStringFlag(flags, "resolution-hash") || undefined,
        resolvedAt: optionalStringFlag(flags, "resolved-at") || undefined,
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeChallengeRecord(record, out) : record);
      return 0;
    }
    if (command === "validate-challenge-record") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-challenge-record <file>");
      }
      const validation = validateChallengeRecord(readChallengeRecord(path));
      printJson({
        ...validation,
        challenge_id: validation.computedHash,
      });
      return validation.ok ? 0 : 1;
    }
    if (command === "challenge-summary") {
      const records = challengePaths(rest).map((path) => readChallengeRecord(path));
      printJson(computeChallengeSummary(records));
      return 0;
    }
    if (command === "create-challenge-response") {
      const flags = parseFlags(rest);
      const response = createChallengeResponse({
        challengeId: stringFlag(flags, "challenge-id"),
        evidenceId: stringFlag(flags, "evidence-id"),
        respondent: stringFlag(flags, "respondent"),
        responseHash: stringFlag(flags, "response-hash"),
        createdAt: stringFlag(flags, "created-at"),
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeChallengeResponse(response, out) : response);
      return 0;
    }
    if (command === "validate-challenge-response") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-challenge-response <file>");
      }
      const validation = validateChallengeResponse(readChallengeResponse(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "create-validator-verdict") {
      const flags = parseFlags(rest);
      const verdict = createValidatorVerdict({
        challengeId: stringFlag(flags, "challenge-id"),
        validator: stringFlag(flags, "validator"),
        claimedUpheld: booleanFlag(flags, "claimed-upheld"),
        verdictHash: stringFlag(flags, "verdict-hash"),
        methodHash: stringFlag(flags, "method-hash"),
        createdAt: stringFlag(flags, "created-at"),
      });
      const out = optionalStringFlag(flags, "out");
      printJson(out ? writeValidatorVerdict(verdict, out) : verdict);
      return 0;
    }
    if (command === "validate-validator-verdict") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-validator-verdict <file>");
      }
      const validation = validateValidatorVerdict(readValidatorVerdict(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "create-verdict-commitment") {
      const flags = parseFlags(rest);
      const {
        openAdjudicationVault,
      } = await import("./adjudication-vault.ts");
      const vault = openAdjudicationVault(vaultPathFlag(flags));
      try {
        const record = vault.saveBeforeBroadcast(verdictCommitmentInput(flags));
        const commitment = vault.commitmentArtifact(record.challenge_id, record.validator, stringFlag(flags, "created-at"));
        const out = optionalStringFlag(flags, "out");
        printJson(out ? writeValidatorVerdictCommitment(commitment, out) : commitment);
      } finally {
        vault.close();
      }
      return 0;
    }
    if (command === "create-adjudication-report") {
      const input = adjudicationReportInput(rest);
      const report = input.phase
        ? createAdjudicationReport({
            challengeId: input.challengeId,
            phase: input.phase,
            claimedUpheld: input.claimedUpheld,
            finalReportHash: input.finalReportHash,
            expirationReportHash: input.expirationReportHash,
            quorum: input.quorum,
            effectiveVerdictCount: input.effectiveVerdictCount,
            responseHashes: input.responseHashes,
            commitmentHashes: input.commitmentHashes,
            revealedVerdictHashes: input.revealedVerdictHashes,
            unrevealedCommitmentCount: input.unrevealedCommitmentCount,
            responseBy: input.responseBy,
            commitBy: input.commitBy,
            revealBy: input.revealBy,
            finalizedAt: input.finalizedAt,
            expiredAt: input.expiredAt,
          })
        : createAdjudicationReport({
            challengeId: input.challengeId,
            claimedUpheld: input.claimedUpheld,
            finalReportHash: input.finalReportHash,
            quorum: input.quorum,
            effectiveVerdictCount: input.effectiveVerdictCount,
            responseHashes: input.responseHashes,
            verdictHashes: input.verdictHashes,
            finalizedAt: input.finalizedAt,
          });
      printJson(input.out ? writeAdjudicationReport(report, input.out) : report);
      return 0;
    }
    if (command === "validate-adjudication-report") {
      const path = rest[0];
      if (!path) {
        throw new Error("usage: validate-adjudication-report <file>");
      }
      const validation = validateAdjudicationReport(readAdjudicationReport(path));
      printJson(validation);
      return validation.ok ? 0 : 1;
    }
    if (command === "submit-challenge") {
      const flags = parseFlags(rest);
      const result = await submitChallengeTransaction(
        stringFlag(flags, "evidence-id"),
        stringFlag(flags, "reason-hash"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "resolve-challenge") {
      const flags = parseFlags(rest);
      const result = await resolveChallengeTransaction(
        stringFlag(flags, "challenge-id"),
        booleanFlag(flags, "upheld"),
        stringFlag(flags, "resolution-hash"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "submit-challenge-response") {
      const flags = parseFlags(rest);
      const result = await submitChallengeResponseTransaction(readChallengeResponse(stringFlag(flags, "response")), commandOptions(flags));
      printJson(result);
      return 0;
    }
    if (command === "commit-validator-verdict") {
      const flags = parseFlags(rest);
      const {
        openAdjudicationVault,
      } = await import("./adjudication-vault.ts");
      const vault = openAdjudicationVault(vaultPathFlag(flags));
      try {
        const record = vault.saveBeforeBroadcast(verdictCommitmentInput(flags));
        const commitment = vault.commitmentArtifact(record.challenge_id, record.validator, stringFlag(flags, "created-at"));
        const commitmentOut = optionalStringFlag(flags, "commitment-out");
        if (commitmentOut) {
          writeValidatorVerdictCommitment(commitment, commitmentOut);
        }
        const result = await commitValidatorVerdictTransaction(commitment, commandOptions(flags));
        if (!result.dryRun) {
          vault.markCommitSubmitted(record.challenge_id, record.validator, result.transactionHash, new Date().toISOString());
        }
        printJson(result);
      } finally {
        vault.close();
      }
      return 0;
    }
    if (command === "reveal-validator-verdict") {
      const flags = parseFlags(rest);
      const {
        openAdjudicationVault,
      } = await import("./adjudication-vault.ts");
      const vault = openAdjudicationVault(vaultPathFlag(flags));
      try {
        const reveal = vault.revealArtifact(stringFlag(flags, "challenge-id"), stringFlag(flags, "validator"));
        const revealOut = optionalStringFlag(flags, "reveal-out");
        if (revealOut) {
          writeValidatorVerdictReveal(reveal, revealOut);
        }
        const result = await revealValidatorVerdictTransaction(reveal, commandOptions(flags));
        if (!result.dryRun) {
          vault.markRevealSubmitted(reveal.challenge_id, reveal.validator, result.transactionHash, new Date().toISOString());
        }
        printJson(result);
      } finally {
        vault.close();
      }
      return 0;
    }
    if (command === "retry-verdict-reveal") {
      const flags = parseFlags(rest);
      const {
        openAdjudicationVault,
      } = await import("./adjudication-vault.ts");
      const vault = openAdjudicationVault(vaultPathFlag(flags));
      try {
        const chainRevealed = optionalStringFlag(flags, "chain-revealed") === "true";
        const reveal = vault.retryReveal(stringFlag(flags, "challenge-id"), stringFlag(flags, "validator"), chainRevealed);
        const result = await revealValidatorVerdictTransaction(reveal, commandOptions(flags));
        if (!result.dryRun) {
          vault.markRevealSubmitted(reveal.challenge_id, reveal.validator, result.transactionHash, new Date().toISOString());
        }
        printJson(result);
      } finally {
        vault.close();
      }
      return 0;
    }
    if (command === "list-pending-verdict-reveals") {
      const flags = parseFlags(rest);
      const {
        openAdjudicationVault,
      } = await import("./adjudication-vault.ts");
      const vault = openAdjudicationVault(vaultPathFlag(flags));
      try {
        printJson({ records: vault.listPendingReveals() });
      } finally {
        vault.close();
      }
      return 0;
    }
    if (command === "export-verdict-commitment") {
      const flags = parseFlags(rest);
      const {
        openAdjudicationVault,
        writeExportedVerdictCommitment,
      } = await import("./adjudication-vault.ts");
      const vault = openAdjudicationVault(vaultPathFlag(flags));
      try {
        const exported = vault.exportRecord(
          stringFlag(flags, "challenge-id"),
          stringFlag(flags, "validator"),
          optionalStringFlag(flags, "exported-at") || new Date().toISOString(),
        );
        printJson(writeExportedVerdictCommitment(exported, stringFlag(flags, "out")));
      } finally {
        vault.close();
      }
      return 0;
    }
    if (command === "import-verdict-commitment") {
      const flags = parseFlags(rest);
      const {
        openAdjudicationVault,
        readExportedVerdictCommitment,
      } = await import("./adjudication-vault.ts");
      const vault = openAdjudicationVault(vaultPathFlag(flags));
      try {
        printJson(vault.importRecord(readExportedVerdictCommitment(stringFlag(flags, "file"))));
      } finally {
        vault.close();
      }
      return 0;
    }
    if (command === "submit-validator-verdict") {
      const flags = parseFlags(rest);
      const result = await submitValidatorVerdictTransaction(readValidatorVerdict(stringFlag(flags, "verdict")), commandOptions(flags));
      printJson(result);
      return 0;
    }
    if (command === "finalize-challenge-adjudication") {
      const flags = parseFlags(rest);
      const result = await finalizeChallengeAdjudicationTransaction(readAdjudicationReport(stringFlag(flags, "report")), commandOptions(flags));
      printJson(result);
      return 0;
    }
    if (command === "expire-challenge-no-quorum") {
      const flags = parseFlags(rest);
      const result = await expireChallengeNoQuorumTransaction(readAdjudicationReport(stringFlag(flags, "report")), commandOptions(flags));
      printJson(result);
      return 0;
    }
    if (command === "chain-state-check") {
      const flags = parseFlags(rest);
      printJson(
        await readChainStateCheck({
          network: typeof flags.network === "string" ? flags.network : "local",
          deploymentsDir: deploymentsDirFlag(flags),
          moduleDigest: optionalStringFlag(flags, "module-digest") || undefined,
          evidenceId: optionalStringFlag(flags, "evidence-id") || undefined,
          challengeId: optionalStringFlag(flags, "challenge-id") || undefined,
          passportId: optionalStringFlag(flags, "passport-id") || undefined,
          unitKind: optionalStringFlag(flags, "unit-kind") || undefined,
          version: optionalStringFlag(flags, "version") || undefined,
          reporter: optionalStringFlag(flags, "reporter") || undefined,
          challenger: optionalStringFlag(flags, "challenger") || undefined,
        }),
      );
      return 0;
    }
    if (command === "index-events") {
      const flags = parseFlags(rest);
      printJson(
        await indexEvents({
          network: typeof flags.network === "string" ? flags.network : "local",
          deploymentsDir: deploymentsDirFlag(flags),
          fromBlock: optionalStringFlag(flags, "from-block") || "0",
          toBlock: optionalStringFlag(flags, "to-block") || "latest",
          out: stringFlag(flags, "out"),
        }),
      );
      return 0;
    }
    if (command === "audit-bundle") {
      printJson(writeAuditBundle(auditBundleInput(rest)));
      return 0;
    }
    if (command === "submit-score-commit") {
      const flags = parseFlags(rest);
      const result = await submitScoreCommitTransaction(
        stringFlag(flags, "module"),
        numberFlag(flags, "score"),
        stringFlag(flags, "reason-hash"),
        stringFlag(flags, "salt"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "submit-score-reveal") {
      const flags = parseFlags(rest);
      const result = await submitScoreRevealTransaction(
        stringFlag(flags, "module"),
        numberFlag(flags, "score"),
        stringFlag(flags, "reason-hash"),
        stringFlag(flags, "salt"),
        commandOptions(flags),
      );
      printJson(result);
      return 0;
    }
    if (command === "score-commit") {
      const flags = parseFlags(rest);
      const score = numberFlag(flags, "score");
      const reasonHash = stringFlag(flags, "reason-hash");
      const salt = stringFlag(flags, "salt");
      printJson({
        moduleDigest: flags.module ?? "",
        score,
        reasonHash,
        salt,
        commitHash: computeScoreCommitHash(score, reasonHash, salt),
      });
      return 0;
    }
    if (command === "score-reveal") {
      const flags = parseFlags(rest);
      const score = numberFlag(flags, "score");
      const reasonHash = stringFlag(flags, "reason-hash");
      const salt = stringFlag(flags, "salt");
      const commitHash = stringFlag(flags, "commit");
      const matched = verifyScoreReveal(commitHash, score, reasonHash, salt);
      printJson({ matched, commitHash, recomputedCommitHash: computeScoreCommitHash(score, reasonHash, salt) });
      return matched ? 0 : 1;
    }
    throw new Error(
      "usage: OriginAgentEvolutionChain <verify-proof|prepare-module|deploy-info|register-identity|compute-agent-key-hash|compute-agent-genesis-hash|compute-agent-passport-id|compute-agent-migration-hash|create-agent-passport-record|validate-agent-passport-record|create-agent-migration-record|validate-agent-migration-record|register-agent-passport|record-agent-migration|create-agent-reputation-record|validate-agent-reputation-record|create-agent-reputation-report|validate-agent-reputation-report|checkpoint-agent-reputation|create-unit-kind-proposal|validate-unit-kind-proposal|create-unit-kind-review|validate-unit-kind-review|create-module-manifest|validate-module-manifest|create-module-acquisition-receipt|validate-module-acquisition-receipt|create-verification-run-receipt|validate-verification-run-receipt|create-community-work-claim|validate-community-work-claim|propose-unit-kind|set-unit-kind-review|set-unit-kind-status|analyze-adversarial-simulation|validate-abuse-report|evaluate-trust-policy|validate-trust-policy-report|create-test-credit-action|validate-test-credit-action|create-test-credit-report|validate-test-credit-report|grant-test-credit|consume-test-credit|submit-module|submit-tool-module|submit-verification|set-validator-profile|submit-validator-report|invalidate-evidence|submit-challenge|resolve-challenge|create-challenge-response|validate-challenge-response|create-validator-verdict|validate-validator-verdict|create-verdict-commitment|commit-validator-verdict|reveal-validator-verdict|retry-verdict-reveal|list-pending-verdict-reveals|export-verdict-commitment|import-verdict-commitment|create-adjudication-report|validate-adjudication-report|submit-challenge-response|submit-validator-verdict|finalize-challenge-adjudication|expire-challenge-no-quorum|chain-state-check|index-events|audit-bundle|evidence-summary|create-external-validator-artifact|validate-external-validator-artifact|create-evidence-report|create-challenge-record|validate-challenge-record|challenge-summary|score-commit|score-reveal|submit-score-commit|submit-score-reveal> [args]",
    );
  } catch (error) {
    printJson({ ok: false, error: error instanceof Error ? error.message : String(error) });
    return 1;
  }
}

function commandOptions(flags: Flags): TransactionOptions {
  return {
    network: typeof flags.network === "string" ? flags.network : "local",
    dryRun: flags.broadcast !== true,
    deploymentsDir: deploymentsDirFlag(flags),
  };
}

function deploymentsDirFlag(flags: Flags): string {
  return typeof flags["deployments-dir"] === "string" ? flags["deployments-dir"] : "deployments";
}

function vaultPathFlag(flags: Flags): string {
  return typeof flags.vault === "string" ? flags.vault : ".originagent/adjudication-vault.sqlite";
}

function verdictCommitmentInput(flags: Flags): {
  challengeId: string;
  validator: string;
  claimedUpheld: boolean;
  verdictHash: string;
  methodHash: string;
  salt: string;
  createdAt: string;
  responseBy?: string;
  commitBy?: string;
  revealBy?: string;
} {
  const createdAt = stringFlag(flags, "created-at");
  return {
    challengeId: stringFlag(flags, "challenge-id"),
    validator: stringFlag(flags, "validator"),
    claimedUpheld: booleanFlag(flags, "claimed-upheld"),
    verdictHash: stringFlag(flags, "verdict-hash"),
    methodHash: stringFlag(flags, "method-hash"),
    salt: optionalStringFlag(flags, "salt") || `0x${randomBytes(32).toString("hex")}`,
    createdAt,
    responseBy: optionalStringFlag(flags, "response-by") || undefined,
    commitBy: optionalStringFlag(flags, "commit-by") || undefined,
    revealBy: optionalStringFlag(flags, "reveal-by") || undefined,
  };
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith("--")) {
      throw new Error(`unexpected argument: ${key}`);
    }
    const name = key.slice(2);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      flags[name] = true;
    } else {
      flags[name] = value;
      index += 1;
    }
  }
  return flags;
}

function stringFlag(flags: Flags, name: string): string {
  const value = flags[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`missing --${name}`);
  }
  return value;
}

function optionalStringFlag(flags: Flags, name: string): string {
  const value = flags[name];
  return typeof value === "string" ? value : "";
}

function numberFlag(flags: Flags, name: string): number {
  const value = Number(stringFlag(flags, name));
  if (!Number.isFinite(value)) {
    throw new Error(`--${name} must be numeric`);
  }
  return value;
}

function booleanFlag(flags: Flags, name: string): boolean {
  const value = flags[name];
  if (value === true) {
    return true;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`--${name} must be true or false`);
}

function parseBooleanValue(value: string, name: string): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`--${name} must be true or false`);
}

function evidenceTypeFlag(flags: Flags, name: string): EvidenceType {
  const value = stringFlag(flags, name);
  if (
    value === "local_client_report" ||
    value === "user_signed_receipt" ||
    value === "validator_report" ||
    value === "unqualified_validator_report" ||
    value === "foundation_seed_report"
  ) {
    return value;
  }
  throw new Error(`--${name} is not a supported evidence type`);
}

function challengeStatusFlag(flags: Flags, name: string): ChallengeStatus | undefined {
  const value = optionalStringFlag(flags, name);
  if (value === "") {
    return undefined;
  }
  if (value === "submitted" || value === "upheld" || value === "rejected") {
    return value;
  }
  throw new Error(`--${name} must be submitted, upheld, or rejected`);
}

function reputationSourceFlag(flags: Flags, name: string): AgentReputationSource {
  const value = stringFlag(flags, name);
  if (value === "challenge_upheld" || value === "challenge_rejected") {
    return value;
  }
  throw new Error(`--${name} must be challenge_upheld or challenge_rejected`);
}

function unitKindStatusFlag(flags: Flags, name: string): UnitKindStatus {
  const value = stringFlag(flags, name);
  if (
    value === "Draft" ||
    value === "Experimental" ||
    value === "Candidate" ||
    value === "Canonical" ||
    value === "Deprecated" ||
    value === "Rejected"
  ) {
    return value;
  }
  throw new Error(`--${name} must be Draft, Experimental, Candidate, Canonical, Deprecated, or Rejected`);
}

function digestAlgorithmFlag(flags: Flags, name: string): DigestAlgorithm {
  const value = stringFlag(flags, name);
  if (value === "sha256" || value === "keccak256") {
    return value;
  }
  throw new Error(`--${name} must be sha256 or keccak256`);
}

function verificationRunResultFlag(flags: Flags, name: string): VerificationRunResult {
  const value = stringFlag(flags, name);
  if (value === "passed" || value === "failed" || value === "inconclusive") {
    return value;
  }
  throw new Error(`--${name} must be passed, failed, or inconclusive`);
}

function communityWorkKindFlag(value: string): CommunityWorkKind {
  if (
    value === "development" ||
    value === "testing" ||
    value === "audit" ||
    value === "documentation" ||
    value === "operation"
  ) {
    return value;
  }
  throw new Error("--work-kind must be development, testing, audit, documentation, or operation");
}

function testCreditActionFlag(flags: Flags, name: string): TestCreditActionType {
  const value = stringFlag(flags, name);
  if (value === "grant" || value === "consume" || value === "deny") {
    return value;
  }
  throw new Error(`--${name} must be grant, consume, or deny`);
}

function testCreditReasonFlag(flags: Flags, name: string): TestCreditReason {
  const value = stringFlag(flags, name);
  if (
    value === "passport_bootstrap" ||
    value === "validator_report_grant" ||
    value === "module_submission_grant" ||
    value === "audit_request_fee" ||
    value === "challenge_bond" ||
    value === "challenge_bond_lock" ||
    value === "challenge_bond_refund" ||
    value === "challenge_bond_consume" ||
    value === "challenge_bond_partial_fee" ||
    value === "blocked_by_trust_policy"
  ) {
    return value;
  }
  throw new Error(`--${name} is not a supported test credit reason`);
}

function reputationReportInput(args: string[]): {
  passportId: string;
  owner: string;
  recordPaths: string[];
  continuitySignals: string[];
  warnings: string[];
  out: string;
} {
  let passportId = "";
  let owner = "";
  const recordPaths: string[] = [];
  const continuitySignals: string[] = [];
  const warnings: string[] = [];
  let out = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--passport-id") {
      passportId = requiredValue(args, index, "passport-id");
      index += 1;
    } else if (arg === "--owner") {
      owner = requiredValue(args, index, "owner");
      index += 1;
    } else if (arg === "--records") {
      index = collectValues(args, index, "records", recordPaths);
    } else if (arg === "--continuity-signals") {
      index = collectValues(args, index, "continuity-signals", continuitySignals);
    } else if (arg === "--warnings") {
      index = collectValues(args, index, "warnings", warnings);
    } else if (arg === "--out") {
      out = requiredValue(args, index, "out");
      index += 1;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  if (!passportId || !owner || recordPaths.length === 0) {
    throw new Error(
      "usage: create-agent-reputation-report --passport-id <id> --owner <address> --records <file...> [--continuity-signals <text...>] [--warnings <text...>] [--out <file>]",
    );
  }
  return { passportId, owner, recordPaths, continuitySignals, warnings, out };
}

function adversarialAnalysisInput(args: string[]): {
  eventsPath: string;
  evidenceReportPaths: string[];
  agentPassportPaths: string[];
  reputationReportPaths: string[];
  unitKindProposalPaths: string[];
  unitKindReviewPaths: string[];
  generatedAt: string;
  out: string;
} {
  let eventsPath = "";
  const evidenceReportPaths: string[] = [];
  const agentPassportPaths: string[] = [];
  const reputationReportPaths: string[] = [];
  const unitKindProposalPaths: string[] = [];
  const unitKindReviewPaths: string[] = [];
  let generatedAt = "";
  let out = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--events") {
      eventsPath = requiredValue(args, index, "events");
      index += 1;
    } else if (arg === "--evidence-reports") {
      index = collectValues(args, index, "evidence-reports", evidenceReportPaths);
    } else if (arg === "--agent-passports") {
      index = collectValues(args, index, "agent-passports", agentPassportPaths);
    } else if (arg === "--reputation-reports") {
      index = collectValues(args, index, "reputation-reports", reputationReportPaths);
    } else if (arg === "--unit-kind-proposals") {
      index = collectValues(args, index, "unit-kind-proposals", unitKindProposalPaths);
    } else if (arg === "--unit-kind-reviews") {
      index = collectValues(args, index, "unit-kind-reviews", unitKindReviewPaths);
    } else if (arg === "--generated-at") {
      generatedAt = requiredValue(args, index, "generated-at");
      index += 1;
    } else if (arg === "--out") {
      out = requiredValue(args, index, "out");
      index += 1;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  if (!eventsPath) {
    throw new Error(
      "usage: analyze-adversarial-simulation --events <events.jsonl> [--evidence-reports <file...>] [--agent-passports <file...>] [--reputation-reports <file...>] [--unit-kind-proposals <file...>] [--unit-kind-reviews <file...>] [--generated-at <iso>] [--out <file>]",
    );
  }
  return {
    eventsPath,
    evidenceReportPaths,
    agentPassportPaths,
    reputationReportPaths,
    unitKindProposalPaths,
    unitKindReviewPaths,
    generatedAt,
    out,
  };
}

function testCreditReportInput(args: string[]): {
  passportId: string;
  owner: string;
  actionPaths: string[];
  trustPolicyReportHash: string;
  out: string;
} {
  let passportId = "";
  let owner = "";
  const actionPaths: string[] = [];
  let trustPolicyReportHash = "";
  let out = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--passport-id") {
      passportId = requiredValue(args, index, "passport-id");
      index += 1;
    } else if (arg === "--owner") {
      owner = requiredValue(args, index, "owner");
      index += 1;
    } else if (arg === "--actions") {
      index = collectValues(args, index, "actions", actionPaths);
    } else if (arg === "--trust-policy-report-hash") {
      trustPolicyReportHash = requiredValue(args, index, "trust-policy-report-hash");
      index += 1;
    } else if (arg === "--out") {
      out = requiredValue(args, index, "out");
      index += 1;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  if (!passportId || !owner || actionPaths.length === 0) {
    throw new Error(
      "usage: create-test-credit-report --passport-id <id> --owner <address> --actions <file...> [--trust-policy-report-hash <hash>] [--out <file>]",
    );
  }
  return { passportId, owner, actionPaths, trustPolicyReportHash, out };
}

function communityWorkClaimInput(args: string[]): {
  claimId: string;
  responsibleAddress: string;
  agentPassportId: string;
  workKind: CommunityWorkKind;
  summary: string;
  proofUri: string;
  proofDigest: string;
  artifactHashes: string[];
  referencedEvents: string[];
  createdAt: string;
  out: string;
} {
  let claimId = "";
  let responsibleAddress = "";
  let agentPassportId = "";
  let workKind: CommunityWorkKind | undefined;
  let summary = "";
  let proofUri = "";
  let proofDigest = "";
  const artifactHashes: string[] = [];
  const referencedEvents: string[] = [];
  let createdAt = "";
  let out = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--claim-id") {
      claimId = requiredValue(args, index, "claim-id");
      index += 1;
    } else if (arg === "--responsible-address") {
      responsibleAddress = requiredValue(args, index, "responsible-address");
      index += 1;
    } else if (arg === "--agent-passport-id") {
      agentPassportId = requiredValue(args, index, "agent-passport-id");
      index += 1;
    } else if (arg === "--work-kind") {
      workKind = communityWorkKindFlag(requiredValue(args, index, "work-kind"));
      index += 1;
    } else if (arg === "--summary") {
      summary = requiredValue(args, index, "summary");
      index += 1;
    } else if (arg === "--proof-uri") {
      proofUri = requiredValue(args, index, "proof-uri");
      index += 1;
    } else if (arg === "--proof-digest") {
      proofDigest = requiredValue(args, index, "proof-digest");
      index += 1;
    } else if (arg === "--artifact-hashes") {
      index = collectValues(args, index, "artifact-hashes", artifactHashes);
    } else if (arg === "--referenced-events") {
      index = collectValues(args, index, "referenced-events", referencedEvents);
    } else if (arg === "--created-at") {
      createdAt = requiredValue(args, index, "created-at");
      index += 1;
    } else if (arg === "--out") {
      out = requiredValue(args, index, "out");
      index += 1;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  if (!claimId || !responsibleAddress || !workKind || !summary || !proofUri || !proofDigest || artifactHashes.length === 0 || !createdAt) {
    throw new Error(
      "usage: create-community-work-claim --claim-id <id> --responsible-address <address> [--agent-passport-id <id>] --work-kind <kind> --summary <text> --proof-uri <uri> --proof-digest <hash> --artifact-hashes <hash...> [--referenced-events <event...>] --created-at <iso> [--out <file>]",
    );
  }
  return {
    claimId,
    responsibleAddress,
    agentPassportId,
    workKind,
    summary,
    proofUri,
    proofDigest,
    artifactHashes,
    referencedEvents,
    createdAt,
    out,
  };
}

function adjudicationReportInput(args: string[]): {
  challengeId: string;
  phase?: "finalized" | "expired_no_quorum";
  claimedUpheld: boolean;
  finalReportHash: string;
  expirationReportHash?: string;
  quorum: number;
  effectiveVerdictCount: number;
  responseHashes: string[];
  verdictHashes: string[];
  commitmentHashes: string[];
  revealedVerdictHashes: string[];
  unrevealedCommitmentCount: number;
  responseBy: string;
  commitBy: string;
  revealBy: string;
  finalizedAt: string;
  expiredAt?: string;
  out: string;
} {
  let challengeId = "";
  let phase: "finalized" | "expired_no_quorum" | undefined;
  let claimedUpheld: boolean | undefined;
  let finalReportHash = "";
  let expirationReportHash = "";
  let quorum = 0;
  let effectiveVerdictCount = 0;
  const responseHashes: string[] = [];
  const verdictHashes: string[] = [];
  const commitmentHashes: string[] = [];
  const revealedVerdictHashes: string[] = [];
  let unrevealedCommitmentCount = 0;
  let responseBy = "";
  let commitBy = "";
  let revealBy = "";
  let finalizedAt = "";
  let expiredAt = "";
  let out = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--challenge-id") {
      challengeId = requiredValue(args, index, "challenge-id");
      index += 1;
    } else if (arg === "--phase") {
      phase = adjudicationReportPhaseValue(requiredValue(args, index, "phase"));
      index += 1;
    } else if (arg === "--claimed-upheld") {
      claimedUpheld = parseBooleanValue(requiredValue(args, index, "claimed-upheld"), "claimed-upheld");
      index += 1;
    } else if (arg === "--final-report-hash") {
      finalReportHash = requiredValue(args, index, "final-report-hash");
      index += 1;
    } else if (arg === "--expiration-report-hash") {
      expirationReportHash = requiredValue(args, index, "expiration-report-hash");
      index += 1;
    } else if (arg === "--quorum") {
      quorum = Number(requiredValue(args, index, "quorum"));
      index += 1;
    } else if (arg === "--effective-verdict-count") {
      effectiveVerdictCount = Number(requiredValue(args, index, "effective-verdict-count"));
      index += 1;
    } else if (arg === "--response-hashes") {
      index = collectValues(args, index, "response-hashes", responseHashes);
    } else if (arg === "--verdict-hashes") {
      index = collectValues(args, index, "verdict-hashes", verdictHashes);
    } else if (arg === "--commitment-hashes") {
      index = collectValues(args, index, "commitment-hashes", commitmentHashes);
    } else if (arg === "--revealed-verdict-hashes") {
      index = collectValues(args, index, "revealed-verdict-hashes", revealedVerdictHashes);
    } else if (arg === "--unrevealed-commitment-count") {
      unrevealedCommitmentCount = Number(requiredValue(args, index, "unrevealed-commitment-count"));
      index += 1;
    } else if (arg === "--response-by") {
      responseBy = requiredValue(args, index, "response-by");
      index += 1;
    } else if (arg === "--commit-by") {
      commitBy = requiredValue(args, index, "commit-by");
      index += 1;
    } else if (arg === "--reveal-by") {
      revealBy = requiredValue(args, index, "reveal-by");
      index += 1;
    } else if (arg === "--finalized-at") {
      finalizedAt = requiredValue(args, index, "finalized-at");
      index += 1;
    } else if (arg === "--expired-at") {
      expiredAt = requiredValue(args, index, "expired-at");
      index += 1;
    } else if (arg === "--out") {
      out = requiredValue(args, index, "out");
      index += 1;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  if (phase) {
    if (!challengeId || !quorum || !responseBy || !commitBy || !revealBy) {
      throw new Error(
        "usage: create-adjudication-report --phase <finalized|expired_no_quorum> --challenge-id <id> --quorum <n> --effective-verdict-count <n> --commitment-hashes <hash...> --revealed-verdict-hashes <hash...> --response-by <iso> --commit-by <iso> --reveal-by <iso> [--response-hashes <hash...>] [finalized or expired fields] [--out <file>]",
      );
    }
    if (phase === "finalized" && (claimedUpheld === undefined || !finalReportHash || !finalizedAt)) {
      throw new Error("finalized adjudication report requires --claimed-upheld, --final-report-hash, and --finalized-at");
    }
    if (phase === "expired_no_quorum" && (!expirationReportHash || !expiredAt)) {
      throw new Error("expired adjudication report requires --expiration-report-hash and --expired-at");
    }
    return {
      challengeId,
      phase,
      claimedUpheld: claimedUpheld ?? false,
      finalReportHash,
      expirationReportHash,
      quorum,
      effectiveVerdictCount,
      responseHashes,
      verdictHashes,
      commitmentHashes,
      revealedVerdictHashes,
      unrevealedCommitmentCount,
      responseBy,
      commitBy,
      revealBy,
      finalizedAt,
      expiredAt,
      out,
    };
  }
  if (!challengeId || claimedUpheld === undefined || !finalReportHash || !quorum || !effectiveVerdictCount || verdictHashes.length === 0 || !finalizedAt) {
    throw new Error(
      "usage: create-adjudication-report --challenge-id <id> --claimed-upheld <true|false> --final-report-hash <hash> --quorum <n> --effective-verdict-count <n> [--response-hashes <hash...>] --verdict-hashes <hash...> --finalized-at <iso> [--out <file>]",
    );
  }
  return {
    challengeId,
    claimedUpheld,
    finalReportHash,
    quorum,
    effectiveVerdictCount,
    responseHashes,
    verdictHashes,
    commitmentHashes,
    revealedVerdictHashes,
    unrevealedCommitmentCount,
    responseBy,
    commitBy,
    revealBy,
    finalizedAt,
    out,
  };
}

function adjudicationReportPhaseValue(value: string): "finalized" | "expired_no_quorum" {
  if (value === "finalized" || value === "expired_no_quorum") {
    return value;
  }
  throw new Error("--phase must be finalized or expired_no_quorum");
}

function testCreditTransactionInput(args: string[], expectedAction: "grant" | "consume"): {
  passportId: string;
  amount: number;
  actionHash: string;
  trustPolicyReportHash: string;
  flags: Flags;
} {
  const flags = parseFlags(args);
  const actionPath = optionalStringFlag(flags, "action");
  if (actionPath) {
    const action = readTestCreditAction(actionPath);
    const validation = validateTestCreditAction(action);
    if (!validation.ok) {
      throw new Error(`invalid test credit action: ${validation.errors.join("; ")}`);
    }
    if (action.action !== expectedAction) {
      throw new Error(`--action must reference a ${expectedAction} test credit action`);
    }
    return {
      passportId: action.passport_id,
      amount: action.amount,
      actionHash: action.action_hash,
      trustPolicyReportHash: action.trust_policy_report_hash,
      flags,
    };
  }
  return {
    passportId: stringFlag(flags, "passport-id"),
    amount: numberFlag(flags, "amount"),
    actionHash: stringFlag(flags, "action-hash"),
    trustPolicyReportHash: stringFlag(flags, "trust-policy-report-hash"),
    flags,
  };
}

function evidenceSummaryInput(args: string[]): { reportPaths: string[]; challengeSummaryPath: string } {
  const reportPaths: string[] = [];
  let challengeSummaryPath = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--reports") {
      index += 1;
      while (index < args.length && !args[index].startsWith("--")) {
        reportPaths.push(args[index]);
        index += 1;
      }
      index -= 1;
    } else if (arg === "--challenge-summary") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("missing --challenge-summary");
      }
      challengeSummaryPath = value;
      index += 1;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  if (reportPaths.length === 0) {
    throw new Error("usage: evidence-summary --reports <file...> [--challenge-summary <file>]");
  }
  return { reportPaths, challengeSummaryPath };
}

function challengePaths(args: string[]): string[] {
  const challengesIndex = args.indexOf("--challenges");
  if (challengesIndex === -1 || challengesIndex === args.length - 1) {
    throw new Error("usage: challenge-summary --challenges <file...>");
  }
  const paths = args.slice(challengesIndex + 1);
  if (paths.some((path) => path.startsWith("--"))) {
    throw new Error("challenge-summary --challenges accepts only file paths after --challenges");
  }
  return paths;
}

function auditBundleInput(args: string[]) {
  let eventsPath = "";
  const evidenceReportPaths: string[] = [];
  const challengeRecordPaths: string[] = [];
  const agentPassportPaths: string[] = [];
  const agentMigrationPaths: string[] = [];
  const memoryVaultPaths: string[] = [];
  const reputationReportPaths: string[] = [];
  const unitKindProposalPaths: string[] = [];
  const unitKindReviewPaths: string[] = [];
  const testCreditReportPaths: string[] = [];
  const adjudicationReportPaths: string[] = [];
  const moduleManifestPaths: string[] = [];
  const moduleAcquisitionReceiptPaths: string[] = [];
  const verificationRunReceiptPaths: string[] = [];
  const communityWorkClaimPaths: string[] = [];
  let abuseReportPath = "";
  let trustPolicyReportPath = "";
  let out = "";
  let network = "local";
  let deploymentsDir = "deployments";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--events") {
      eventsPath = requiredValue(args, index, "events");
      index += 1;
    } else if (arg === "--evidence-reports") {
      index = collectValues(args, index, "evidence-reports", evidenceReportPaths);
    } else if (arg === "--challenge-records") {
      index = collectValues(args, index, "challenge-records", challengeRecordPaths);
    } else if (arg === "--agent-passports") {
      index = collectValues(args, index, "agent-passports", agentPassportPaths);
    } else if (arg === "--agent-migrations") {
      index = collectValues(args, index, "agent-migrations", agentMigrationPaths);
    } else if (arg === "--memory-vaults") {
      index = collectValues(args, index, "memory-vaults", memoryVaultPaths);
    } else if (arg === "--reputation-reports") {
      index = collectValues(args, index, "reputation-reports", reputationReportPaths);
    } else if (arg === "--unit-kind-proposals") {
      index = collectValues(args, index, "unit-kind-proposals", unitKindProposalPaths);
    } else if (arg === "--unit-kind-reviews") {
      index = collectValues(args, index, "unit-kind-reviews", unitKindReviewPaths);
    } else if (arg === "--test-credit-reports") {
      index = collectValues(args, index, "test-credit-reports", testCreditReportPaths);
    } else if (arg === "--adjudication-reports") {
      index = collectValues(args, index, "adjudication-reports", adjudicationReportPaths);
    } else if (arg === "--module-manifests") {
      index = collectValues(args, index, "module-manifests", moduleManifestPaths);
    } else if (arg === "--module-acquisition-receipts") {
      index = collectValues(args, index, "module-acquisition-receipts", moduleAcquisitionReceiptPaths);
    } else if (arg === "--verification-run-receipts") {
      index = collectValues(args, index, "verification-run-receipts", verificationRunReceiptPaths);
    } else if (arg === "--community-work-claims") {
      index = collectValues(args, index, "community-work-claims", communityWorkClaimPaths);
    } else if (arg === "--abuse-report") {
      abuseReportPath = requiredValue(args, index, "abuse-report");
      index += 1;
    } else if (arg === "--trust-policy-report") {
      trustPolicyReportPath = requiredValue(args, index, "trust-policy-report");
      index += 1;
    } else if (arg === "--out") {
      out = requiredValue(args, index, "out");
      index += 1;
    } else if (arg === "--network") {
      network = requiredValue(args, index, "network");
      index += 1;
    } else if (arg === "--deployments-dir") {
      deploymentsDir = requiredValue(args, index, "deployments-dir");
      index += 1;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  if (!eventsPath || !out) {
    throw new Error(
      "usage: audit-bundle --events <events.jsonl> [--evidence-reports <file...> --challenge-records <file...>] [--agent-passports <file...> --agent-migrations <file...>] [--memory-vaults <file...>] [--reputation-reports <file...>] [--unit-kind-proposals <file...> --unit-kind-reviews <file...>] [--module-manifests <file...> --module-acquisition-receipts <file...> --verification-run-receipts <file...> --community-work-claims <file...>] [--abuse-report <file>] [--trust-policy-report <file>] [--test-credit-reports <file...>] --out <file>",
    );
  }
  return {
    eventsPath,
    evidenceReportPaths,
    challengeRecordPaths,
    agentPassportPaths,
    agentMigrationPaths,
    memoryVaultPaths,
    reputationReportPaths,
    unitKindProposalPaths,
    unitKindReviewPaths,
    abuseReportPath,
    trustPolicyReportPath,
    testCreditReportPaths,
    adjudicationReportPaths,
    moduleManifestPaths,
    moduleAcquisitionReceiptPaths,
    verificationRunReceiptPaths,
    communityWorkClaimPaths,
    out,
    network,
    deploymentsDir,
  };
}

function collectValues(args: string[], index: number, name: string, target: string[]): number {
  let next = index + 1;
  while (next < args.length && !args[next].startsWith("--")) {
    target.push(args[next]);
    next += 1;
  }
  if (next === index + 1) {
    throw new Error(`missing --${name}`);
  }
  return next - 1;
}

function requiredValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`missing --${name}`);
  }
  return value;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

process.exitCode = await main(process.argv.slice(2));
