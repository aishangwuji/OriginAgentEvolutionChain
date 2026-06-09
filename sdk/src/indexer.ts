import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  http,
  type Abi,
  type Address,
  type Hex,
  type Log,
} from "viem";
import { toBytes32 } from "./canonical.ts";
import {
  readAdjudicationReport,
  validateAdjudicationReport,
  type AdjudicationReport,
  type AdjudicationReportV1,
  type AdjudicationReportV2,
} from "./adjudication.ts";
import {
  computeChallengeId,
  computeChallengeSummary,
  computeEvidenceId,
  computeEvidenceSummary,
  collectPrivacyErrors,
  evidenceTypeId,
  readChallengeRecord,
  readEvidenceReport,
  type ChallengeRecord,
  type ChallengeStatus,
  type ChallengeSummary,
  type EvidenceReport,
  type EvidenceSummary,
} from "./evidence.ts";
import {
  computeAgentGenesisHash,
  computeAgentMigrationHash,
  computeAgentPassportId,
  readAgentMigrationRecord,
  readAgentPassportRecord,
  validateAgentMigrationRecord,
  validateAgentPassportRecord,
  type AgentMigrationRecord,
  type AgentPassportRecord,
} from "./passport.ts";
import {
  readMemoryVault,
  validateMemoryVault,
  type MemoryVaultArtifact,
} from "./memory-vault.ts";
import {
  AGENT_PASSPORT_REGISTRY_ABI,
  AGENT_REPUTATION_REGISTRY_ABI,
  CHALLENGE_ADJUDICATION_REGISTRY_ABI,
  EVOLUTION_UNIT_KIND_REGISTRY_ABI,
  IDENTITY_REGISTRY_ABI,
  MODULE_REGISTRY_ABI,
  SCORE_COMMIT_REVEAL_ABI,
  TEST_CREDIT_LEDGER_ABI,
  VERIFICATION_REGISTRY_ABI,
  loadDeployment,
  type ContractName,
  type DeploymentInfo,
} from "./contracts.ts";
import {
  readAgentReputationReport,
  validateAgentReputationRecord,
  validateAgentReputationReport,
  type AgentReputationReport,
} from "./reputation.ts";
import {
  computeUnitKindIdHash,
  computeUnitKindVersionHash,
  computeUnitKindVersionKey,
  readUnitKindProposal,
  readUnitKindReview,
  unitKindStatusId,
  validateUnitKindProposal,
  validateUnitKindReview,
  type UnitKindProposal,
  type UnitKindReview,
} from "./unit-kind.ts";
import {
  readAbuseReport,
  validateAbuseReport,
  type AbuseReport,
  type AbuseSignal,
} from "./adversarial.ts";
import {
  readTrustPolicyReport,
  summarizeTrustPolicyReport,
  validateTrustPolicyReport,
  type TrustPolicyAuditSummary,
  type TrustPolicyReport,
} from "./trust-policy.ts";
import {
  readTestCreditReport,
  validateTestCreditReport,
  type TestCreditReport,
} from "./test-credit.ts";
import {
  readCommunityWorkClaim,
  readModuleAcquisitionReceipt,
  readModuleManifest,
  readVerificationRunReceipt,
  validateCommunityWorkClaim,
  validateModuleAcquisitionReceipt,
  validateModuleManifest,
  validateVerificationRunReceipt,
  type CommunityWorkClaim,
  type ModuleAcquisitionReceipt,
  type ModuleManifest,
  type VerificationRunReceipt,
} from "./module-verification.ts";

export interface IndexEventsInput {
  network: string;
  deploymentsDir?: string;
  fromBlock?: string;
  toBlock?: string;
  out: string;
}

export interface IndexedChainEvent {
  schema_version: "originagent.evolution.event.v1";
  chain_id: number;
  network: string;
  contract: ContractName;
  contract_address: Address;
  event_name: string;
  block_number: number;
  transaction_hash: Hex;
  log_index: number;
  args: Record<string, unknown>;
}

export interface AuditBundle {
  schema_version: "originagent.evolution.audit_bundle.v1";
  ok: boolean;
  errors: string[];
  chain_id: number;
  deployment: DeploymentInfo;
  events: {
    total: number;
    by_contract: Record<string, number>;
    by_event: Record<string, number>;
  };
  evidence_linkage: EvidenceLinkage[];
  challenge_linkage: ChallengeLinkage[];
  agent_passport_linkage: AgentPassportLinkage[];
  agent_migration_linkage: AgentMigrationLinkage[];
  memory_vault_linkage: MemoryVaultLinkage[];
  reputation_checkpoint_linkage?: ReputationCheckpointLinkage[];
  unit_kind_linkage?: UnitKindLinkage[];
  abuse_signals?: AbuseSignal[];
  trust_policy_summary?: TrustPolicyAuditSummary;
  test_credit_linkage?: TestCreditLinkage[];
  adjudication_linkage?: AdjudicationLinkage[];
  community_work_linkage?: CommunityWorkLinkage[];
  reputation_delta: Record<string, number>;
  privacy_scan: {
    ok: boolean;
    errors: string[];
  };
  evidence_summary: EvidenceSummary;
  notes: string[];
}

export interface EvidenceLinkage {
  evidence_id: Hex;
  report_hash: string;
  event_found: boolean;
  artifact_matched: boolean;
}

export interface ChallengeLinkage {
  challenge_id: Hex;
  evidence_id: Hex;
  event_found: boolean;
  record_matched: boolean;
  resolution_found: boolean;
  invalidation_found: boolean;
  status: ChallengeStatus;
}

export interface AgentPassportLinkage {
  passport_id: Hex;
  event_found: boolean;
  artifact_matched: boolean;
}

export interface AgentMigrationLinkage {
  passport_id: Hex;
  migration_hash: Hex;
  event_found: boolean;
  artifact_matched: boolean;
  migration_index: number;
}

export interface MemoryVaultLinkage {
  vault_digest: string;
  passport_id: string;
  agent_key_hash: string;
  artifact_valid: boolean;
  passport_linked: boolean;
}

export interface ReputationCheckpointLinkage {
  passport_id: Hex;
  report_hash: string;
  artifact_valid: boolean;
  owner_linked: boolean;
  source_events_matched: boolean;
  checkpoint_event_found: boolean;
  report_hash_matched: boolean;
  score: number;
  checkpoint_index: number;
}

export interface UnitKindLinkage {
  kind_id: string;
  version: string;
  kind_id_hash: Hex;
  version_hash: Hex;
  kind_version_key: Hex;
  proposal_hash: string;
  review_hash: string;
  artifact_valid: boolean;
  proposal_event_found: boolean;
  proposal_event_matched: boolean;
  review_event_found: boolean;
  status_event_found: boolean;
  status: string;
}

export interface TestCreditLinkage {
  passport_id: Hex;
  report_hash: string;
  action_hash: string;
  action: string;
  reason: string;
  amount: number;
  denied: boolean;
  event_found: boolean | null;
  event_matched: boolean;
  operation_index: number | null;
}

export interface AdjudicationLinkage {
  challenge_id: Hex;
  report_hash: string;
  phase?: "finalized" | "expired_no_quorum";
  response_hashes: Hex[];
  commitment_hashes?: Hex[];
  verdict_hashes: Hex[];
  revealed_verdict_hashes?: Hex[];
  phase_event_found?: boolean;
  phase_deadlines_matched?: boolean;
  response_events_matched: boolean;
  commit_events_matched?: boolean;
  verdict_events_matched: boolean;
  reveal_events_matched?: boolean;
  finalize_event_found: boolean;
  expire_event_found?: boolean;
  final_report_matched: boolean;
  expiration_report_matched?: boolean;
  outcome_matched: boolean;
  effective_verdict_count: number;
}

export interface CommunityWorkLinkage {
  claim_id: string;
  claim_hash: string;
  responsible_address: string;
  work_kind: string;
  artifact_valid: boolean;
  manifest_linked: boolean;
  acquisition_receipt_linked: boolean;
  verification_run_linked: boolean;
  hash_matched: boolean;
  proof_bound: boolean;
}

export interface AuditBundleInput {
  eventsPath: string;
  evidenceReportPaths: string[];
  challengeRecordPaths: string[];
  agentPassportPaths?: string[];
  agentMigrationPaths?: string[];
  memoryVaultPaths?: string[];
  reputationReportPaths?: string[];
  unitKindProposalPaths?: string[];
  unitKindReviewPaths?: string[];
  abuseReportPath?: string;
  trustPolicyReportPath?: string;
  testCreditReportPaths?: string[];
  adjudicationReportPaths?: string[];
  moduleManifestPaths?: string[];
  moduleAcquisitionReceiptPaths?: string[];
  verificationRunReceiptPaths?: string[];
  communityWorkClaimPaths?: string[];
  out: string;
  network?: string;
  deploymentsDir?: string;
}

const ALL_EVENT_ABI = [
  ...IDENTITY_REGISTRY_ABI,
  ...AGENT_PASSPORT_REGISTRY_ABI,
  ...AGENT_REPUTATION_REGISTRY_ABI,
  ...EVOLUTION_UNIT_KIND_REGISTRY_ABI,
  ...TEST_CREDIT_LEDGER_ABI,
  ...CHALLENGE_ADJUDICATION_REGISTRY_ABI,
  ...MODULE_REGISTRY_ABI,
  ...VERIFICATION_REGISTRY_ABI,
  ...SCORE_COMMIT_REVEAL_ABI,
] as const satisfies Abi;

export async function indexEvents(input: IndexEventsInput): Promise<{ events: IndexedChainEvent[]; path: string }> {
  if (!input.out) {
    throw new Error("index-events requires --out");
  }
  const rpcUrl = process.env.EVOLUTION_CHAIN_RPC_URL;
  if (!rpcUrl) {
    throw new Error("EVOLUTION_CHAIN_RPC_URL is required for index-events");
  }
  const deployment = loadDeployment(input.network, input.deploymentsDir);
  const fromBlock = parseBlockNumber(input.fromBlock ?? "0", "from-block");
  const toBlock = parseToBlock(input.toBlock ?? "latest");
  if (toBlock !== "latest" && fromBlock > toBlock) {
    throw new Error("--from-block must be less than or equal to --to-block");
  }

  const addressToContract = addressContractMap(deployment);
  const addresses = Object.values(deployment.contracts).filter((address): address is Address => Boolean(address));
  const client = createPublicClient({ transport: http(rpcUrl) });
  const logs = await client.getLogs({
    address: addresses,
    fromBlock,
    toBlock,
  });
  const events = logs
    .map((log) => decodeIndexedEvent(log, deployment, addressToContract))
    .filter((event): event is IndexedChainEvent => event !== undefined)
    .sort((left, right) => left.block_number - right.block_number || left.log_index - right.log_index);
  writeJsonLines(events, input.out);
  return { events, path: input.out };
}

export function readIndexedEvents(path: string): IndexedChainEvent[] {
  const content = readFileSync(path, "utf8").trim();
  if (!content) {
    return [];
  }
  return content.split(/\r?\n/).map((line) => JSON.parse(line) as IndexedChainEvent);
}

export function writeAuditBundle(input: AuditBundleInput): AuditBundle {
  if (!input.out) {
    throw new Error("audit-bundle requires --out");
  }
  const hasEvidenceAudit = input.evidenceReportPaths.length > 0 || input.challengeRecordPaths.length > 0;
  const hasPassportAudit = (input.agentPassportPaths?.length ?? 0) > 0 || (input.agentMigrationPaths?.length ?? 0) > 0;
  const hasMemoryVaultAudit = (input.memoryVaultPaths?.length ?? 0) > 0;
  const hasReputationAudit = (input.reputationReportPaths?.length ?? 0) > 0;
  const hasUnitKindAudit = (input.unitKindProposalPaths?.length ?? 0) > 0 || (input.unitKindReviewPaths?.length ?? 0) > 0;
  const hasAbuseAudit = Boolean(input.abuseReportPath);
  const hasTrustPolicyAudit = Boolean(input.trustPolicyReportPath);
  const hasTestCreditAudit = (input.testCreditReportPaths?.length ?? 0) > 0;
  const hasAdjudicationAudit = (input.adjudicationReportPaths?.length ?? 0) > 0;
  const hasModuleVerificationAudit =
    (input.moduleManifestPaths?.length ?? 0) > 0 ||
    (input.moduleAcquisitionReceiptPaths?.length ?? 0) > 0 ||
    (input.verificationRunReceiptPaths?.length ?? 0) > 0 ||
    (input.communityWorkClaimPaths?.length ?? 0) > 0;
  if (
    !hasEvidenceAudit &&
    !hasPassportAudit &&
    !hasMemoryVaultAudit &&
    !hasReputationAudit &&
    !hasUnitKindAudit &&
    !hasAbuseAudit &&
    !hasTrustPolicyAudit &&
    !hasTestCreditAudit &&
    !hasAdjudicationAudit &&
    !hasModuleVerificationAudit
  ) {
    throw new Error("audit-bundle requires evidence/challenge, agent passport/migration, memory vault, reputation, unit kind, abuse report, trust policy, test credit, adjudication, or module verification artifacts");
  }
  if (hasEvidenceAudit && input.evidenceReportPaths.length === 0) {
    throw new Error("audit-bundle requires --evidence-reports <file...> when challenge records are provided");
  }
  if (hasEvidenceAudit && input.challengeRecordPaths.length === 0) {
    throw new Error("audit-bundle requires --challenge-records <file...> when evidence reports are provided");
  }
  if ((input.unitKindReviewPaths?.length ?? 0) > 0 && (input.unitKindProposalPaths?.length ?? 0) === 0) {
    throw new Error("audit-bundle requires --unit-kind-proposals <file...> when unit kind reviews are provided");
  }
  const deployment = loadDeployment(input.network ?? "local", input.deploymentsDir);
  const events = readIndexedEvents(input.eventsPath);
  const reports = input.evidenceReportPaths.map((path) => readEvidenceReport(path));
  const records = input.challengeRecordPaths.map((path) => readChallengeRecord(path));
  const agentPassports = (input.agentPassportPaths ?? []).map((path) => readAgentPassportRecord(path));
  const agentMigrations = (input.agentMigrationPaths ?? []).map((path) => readAgentMigrationRecord(path));
  const memoryVaults = (input.memoryVaultPaths ?? []).map((path) => readMemoryVault(path));
  const reputationReports = (input.reputationReportPaths ?? []).map((path) => readAgentReputationReport(path));
  const unitKindProposals = (input.unitKindProposalPaths ?? []).map((path) => readUnitKindProposal(path));
  const unitKindReviews = (input.unitKindReviewPaths ?? []).map((path) => readUnitKindReview(path));
  const abuseReport = input.abuseReportPath ? readAbuseReport(input.abuseReportPath) : undefined;
  const trustPolicyReport = input.trustPolicyReportPath ? readTrustPolicyReport(input.trustPolicyReportPath) : undefined;
  const testCreditReports = (input.testCreditReportPaths ?? []).map((path) => readTestCreditReport(path));
  const adjudicationReports = (input.adjudicationReportPaths ?? []).map((path) => readAdjudicationReport(path));
  const moduleManifests = (input.moduleManifestPaths ?? []).map((path) => readModuleManifest(path));
  const moduleAcquisitionReceipts = (input.moduleAcquisitionReceiptPaths ?? []).map((path) =>
    readModuleAcquisitionReceipt(path),
  );
  const verificationRunReceipts = (input.verificationRunReceiptPaths ?? []).map((path) => readVerificationRunReceipt(path));
  const communityWorkClaims = (input.communityWorkClaimPaths ?? []).map((path) => readCommunityWorkClaim(path));
  const bundle = createAuditBundle(
    deployment,
    events,
    reports,
    records,
    agentPassports,
    agentMigrations,
    memoryVaults,
    reputationReports,
    unitKindProposals,
    unitKindReviews,
    abuseReport,
    trustPolicyReport,
    testCreditReports,
    adjudicationReports,
    moduleManifests,
    moduleAcquisitionReceipts,
    verificationRunReceipts,
    communityWorkClaims,
  );
  mkdirSync(dirname(input.out), { recursive: true });
  writeFileSync(input.out, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return bundle;
}

export function createAuditBundle(
  deployment: DeploymentInfo,
  events: IndexedChainEvent[],
  reports: EvidenceReport[],
  records: ChallengeRecord[],
  agentPassports: AgentPassportRecord[] = [],
  agentMigrations: AgentMigrationRecord[] = [],
  memoryVaults: MemoryVaultArtifact[] = [],
  reputationReports: AgentReputationReport[] = [],
  unitKindProposals: UnitKindProposal[] = [],
  unitKindReviews: UnitKindReview[] = [],
  abuseReport?: AbuseReport,
  trustPolicyReport?: TrustPolicyReport,
  testCreditReports: TestCreditReport[] = [],
  adjudicationReports: AdjudicationReport[] = [],
  moduleManifests: ModuleManifest[] = [],
  moduleAcquisitionReceipts: ModuleAcquisitionReceipt[] = [],
  verificationRunReceipts: VerificationRunReceipt[] = [],
  communityWorkClaims: CommunityWorkClaim[] = [],
): AuditBundle {
  const errors: string[] = [];
  const challengeSummary = computeChallengeSummary(records);
  const evidenceSummary = computeEvidenceSummary(reports, challengeSummary);
  errors.push(...evidenceSummary.errors.map((error) => `evidence summary: ${error}`));

  const evidence_linkage = reports.map((report) => evidenceLinkage(report, events, errors));
  const challenge_linkage = records.map((record) => challengeLinkage(record, events, errors));
  const agent_passport_linkage = agentPassports.map((record) => agentPassportLinkage(record, events, errors));
  const agent_migration_linkage = agentMigrations.map((record) => agentMigrationLinkage(record, events, errors));
  const memory_vault_linkage = memoryVaults.map((vault) => memoryVaultLinkage(vault, agentPassports, agentMigrations, errors));
  const reputation_checkpoint_linkage = reputationReports.map((report) =>
    reputationCheckpointLinkage(report, events, agentPassports, errors),
  );
  const unit_kind_linkage = unitKindProposals.map((proposal) =>
    unitKindLinkage(proposal, unitKindReviews, events, errors),
  );
  const test_credit_linkage = testCreditReports.flatMap((report) =>
    testCreditLinkage(report, events, trustPolicyReport, errors),
  );
  const adjudication_linkage = adjudicationReports.map((report) => adjudicationLinkage(report, events, errors));
  validateModuleVerificationArtifactSets(
    moduleManifests,
    moduleAcquisitionReceipts,
    verificationRunReceipts,
    communityWorkClaims,
    errors,
  );
  const community_work_linkage = communityWorkClaims.map((claim) =>
    communityWorkLinkage(claim, moduleManifests, moduleAcquisitionReceipts, verificationRunReceipts, errors),
  );
  const requiresChallengeBondArtifact = adjudicationReports.some(
    (report) => report.schema_version === "originagent.evolution.adjudication_report.v2",
  );
  if (requiresChallengeBondArtifact && !hasChallengeBondLockArtifact(testCreditReports)) {
    errors.push("missing challenge_bond_lock test credit artifact for EC-15B adjudication audit");
  }
  if (abuseReport) {
    const validation = validateAbuseReport(abuseReport);
    if (!validation.ok) {
      errors.push(...validation.errors.map((error) => `abuse report: ${error}`));
    }
    validateAbuseSignalEventLinks(abuseReport, events, errors);
  }
  if (trustPolicyReport) {
    const validation = validateTrustPolicyReport(trustPolicyReport, abuseReport);
    if (!validation.ok) {
      errors.push(...validation.errors.map((error) => `trust policy report: ${error}`));
    }
  }
  validateMigrationIndexes(events, errors);
  const reputation_delta = challengeSummary.reputation;
  const eventsSummary = summarizeEvents(events);

  const candidate: Omit<AuditBundle, "ok" | "privacy_scan" | "errors"> & { errors: string[] } = {
    schema_version: "originagent.evolution.audit_bundle.v1",
    errors,
    chain_id: deployment.chainId,
    deployment,
    events: eventsSummary,
    evidence_linkage,
    challenge_linkage,
    agent_passport_linkage,
    agent_migration_linkage,
    memory_vault_linkage,
    ...(reputation_checkpoint_linkage.length > 0 ? { reputation_checkpoint_linkage } : {}),
    ...(unit_kind_linkage.length > 0 ? { unit_kind_linkage } : {}),
    ...(abuseReport ? { abuse_signals: abuseReport.signals } : {}),
    ...(trustPolicyReport ? { trust_policy_summary: summarizeTrustPolicyReport(trustPolicyReport) } : {}),
    ...(test_credit_linkage.length > 0 ? { test_credit_linkage } : {}),
    ...(adjudication_linkage.length > 0 ? { adjudication_linkage } : {}),
    ...(community_work_linkage.length > 0 ? { community_work_linkage } : {}),
    reputation_delta,
    evidence_summary: evidenceSummary,
    notes: [
      "EvidenceSubmitted events do not contain proofBundleHash or reportHash; evidenceId verification depends on evidence report artifacts.",
      ...(adjudication_linkage.length > 0
        ? [
            "adjudication_linkage checks event presence and hash consistency between on-chain ValidatorVerdictSubmitted/ChallengeResponseSubmitted events and adjudication_report.verdict_hashes/response_hashes arrays. Independent hash re-computation of underlying verdict/response artifacts is performed by validate-validator-verdict and validate-challenge-response CLI commands.",
            "EC-15B adjudication_linkage checks AdjudicationPhaseStarted deadlines, ValidatorVerdictCommitted commitment hashes, ValidatorVerdictRevealed verdict hashes, and terminal finalize/expire events against adjudication_report.v2. It does not independently recompute underlying commitment, reveal, response, or verdict artifact hashes.",
            "v2 finalized challenges produce both ChallengeAdjudicationFinalized (adjudication registry) and ChallengeResolved (verification registry) events; adjudication_linkage validates the former, challenge_linkage validates the latter.",
            "quorum enforcement is verified on-chain by ChallengeAdjudicationRegistry; audit-bundle does not recompute quorum and does not use operatorGroupHash or runnerFingerprintHash hints as quorum proof.",
          ]
        : []),
    ],
  };
  const privacyErrors = collectPrivacyErrors({
    audit_bundle: candidate,
    indexed_events: events,
    memory_vaults: memoryVaults,
    unit_kind_proposals: unitKindProposals,
    unit_kind_reviews: unitKindReviews,
    module_manifests: moduleManifests,
    module_acquisition_receipts: moduleAcquisitionReceipts,
    verification_run_receipts: verificationRunReceipts,
    community_work_claims: communityWorkClaims,
    abuse_report: abuseReport,
    trust_policy_report: trustPolicyReport,
    test_credit_reports: testCreditReports,
    adjudication_reports: adjudicationReports,
  });
  if (privacyErrors.length > 0) {
    errors.push(...privacyErrors.map((error) => `privacy: ${error}`));
  }
  return {
    ...candidate,
    ok: errors.length === 0,
    errors,
    privacy_scan: {
      ok: privacyErrors.length === 0,
      errors: privacyErrors,
    },
  };
}

function agentPassportLinkage(
  record: AgentPassportRecord,
  events: IndexedChainEvent[],
  errors: string[],
): AgentPassportLinkage {
  const validation = validateAgentPassportRecord(record);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => `agent passport: ${error}`));
  }
  const genesisHash = computeAgentGenesisHash(record.owner, record.agent_key_hash, record.genesis_nonce, record.metadata_hash);
  const passportId = computeAgentPassportId(record.owner, record.agent_key_hash, genesisHash);
  const event = events.find(
    (candidate) => candidate.event_name === "AgentPassportRegistered" && candidate.args.passportId === passportId,
  );
  let artifactMatched = false;
  if (!event) {
    errors.push(`missing AgentPassportRegistered event for passport ${passportId}`);
  } else {
    artifactMatched =
      getAddress(String(event.args.owner)) === getAddress(record.owner) &&
      String(event.args.agentKeyHash) === record.agent_key_hash &&
      String(event.args.genesisHash) === genesisHash &&
      String(event.args.metadataHash) === record.metadata_hash;
    if (!artifactMatched) {
      errors.push(`AgentPassportRegistered event does not match artifact for passport ${passportId}`);
    }
  }
  return {
    passport_id: passportId,
    event_found: Boolean(event),
    artifact_matched: artifactMatched,
  };
}

function agentMigrationLinkage(
  record: AgentMigrationRecord,
  events: IndexedChainEvent[],
  errors: string[],
): AgentMigrationLinkage {
  const validation = validateAgentMigrationRecord(record);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => `agent migration: ${error}`));
  }
  const migrationHash = computeAgentMigrationHash(
    record.passport_id,
    record.old_agent_key_hash,
    record.new_agent_key_hash,
    record.migration_nonce,
  );
  const event = events.find(
    (candidate) =>
      candidate.event_name === "AgentPassportMigrationRecorded" &&
      candidate.args.passportId === record.passport_id &&
      candidate.args.migrationHash === migrationHash,
  );
  let artifactMatched = false;
  let migrationIndex = 0;
  if (!event) {
    errors.push(`missing AgentPassportMigrationRecorded event for migration ${migrationHash}`);
  } else {
    migrationIndex = numberValue(event.args.migrationIndex);
    artifactMatched =
      getAddress(String(event.args.owner)) === getAddress(record.owner) &&
      String(event.args.oldAgentKeyHash) === record.old_agent_key_hash &&
      String(event.args.newAgentKeyHash) === record.new_agent_key_hash;
    if (!artifactMatched) {
      errors.push(`AgentPassportMigrationRecorded event does not match artifact for migration ${migrationHash}`);
    }
  }
  return {
    passport_id: record.passport_id,
    migration_hash: migrationHash,
    event_found: Boolean(event),
    artifact_matched: artifactMatched,
    migration_index: migrationIndex,
  };
}

function memoryVaultLinkage(
  vault: MemoryVaultArtifact,
  agentPassports: AgentPassportRecord[],
  agentMigrations: AgentMigrationRecord[],
  errors: string[],
): MemoryVaultLinkage {
  const validation = validateMemoryVault(vault);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => `memory vault: ${error}`));
  }
  const passportId = typeof vault.metadata?.passport_id === "string" ? vault.metadata.passport_id : "";
  const agentKeyHash = typeof vault.metadata?.agent_key_hash === "string" ? vault.metadata.agent_key_hash : "";
  const passportLinked =
    agentPassports.some(
      (record) => record.passport_id === passportId && record.agent_key_hash === agentKeyHash,
    ) ||
    agentMigrations.some(
      (record) =>
        record.passport_id === passportId &&
        (record.old_agent_key_hash === agentKeyHash || record.new_agent_key_hash === agentKeyHash),
    );
  if (!passportLinked) {
    errors.push(`memory vault ${validation.vaultDigest || vault.vault_digest || "<unknown>"} does not match any agent passport or migration artifact`);
  }
  return {
    vault_digest: validation.vaultDigest || String(vault.vault_digest || ""),
    passport_id: passportId,
    agent_key_hash: agentKeyHash,
    artifact_valid: validation.ok,
    passport_linked: passportLinked,
  };
}

function reputationCheckpointLinkage(
  report: AgentReputationReport,
  events: IndexedChainEvent[],
  agentPassports: AgentPassportRecord[],
  errors: string[],
): ReputationCheckpointLinkage {
  const validation = validateAgentReputationReport(report);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => `agent reputation report: ${error}`));
  }
  const reportHashBytes32 = toBytes32(report.report_hash, "report_hash");
  const ownerLinked = reputationOwnerLinked(report, events, agentPassports);
  if (!ownerLinked) {
    errors.push(`agent reputation report ${report.report_hash} is not linked to passport owner ${report.owner}`);
  }

  const sourceEventsMatched = report.records.every((record) =>
    reputationRecordSourceMatched(record, report, events, errors),
  );

  const checkpoint = events.find(
    (event) =>
      event.event_name === "AgentReputationCheckpointed" &&
      event.args.passportId === report.passport_id &&
      event.args.reportHash === reportHashBytes32,
  );
  let reportHashMatched = false;
  let checkpointIndex = 0;
  if (!checkpoint) {
    errors.push(`missing AgentReputationCheckpointed event for reputation report ${report.report_hash}`);
  } else {
    checkpointIndex = numberValue(checkpoint.args.checkpointIndex);
    reportHashMatched =
      numberValue(checkpoint.args.score) === report.score &&
      numberValue(checkpoint.args.positiveCount) === report.positive_count &&
      numberValue(checkpoint.args.negativeCount) === report.negative_count &&
      String(checkpoint.args.reportHash) === reportHashBytes32;
    if (!reportHashMatched) {
      errors.push(`AgentReputationCheckpointed event does not match reputation report ${report.report_hash}`);
    }
  }

  return {
    passport_id: report.passport_id,
    report_hash: report.report_hash,
    artifact_valid: validation.ok,
    owner_linked: ownerLinked,
    source_events_matched: sourceEventsMatched,
    checkpoint_event_found: Boolean(checkpoint),
    report_hash_matched: reportHashMatched,
    score: report.score,
    checkpoint_index: checkpointIndex,
  };
}

function reputationOwnerLinked(
  report: AgentReputationReport,
  events: IndexedChainEvent[],
  agentPassports: AgentPassportRecord[],
): boolean {
  if (
    agentPassports.some(
      (passport) => passport.passport_id === report.passport_id && getAddress(passport.owner) === getAddress(report.owner),
    )
  ) {
    return true;
  }
  return events.some(
    (event) =>
      event.event_name === "AgentPassportRegistered" &&
      event.args.passportId === report.passport_id &&
      getAddress(String(event.args.owner)) === getAddress(report.owner),
  );
}

function reputationRecordSourceMatched(
  record: AgentReputationReport["records"][number],
  report: AgentReputationReport,
  events: IndexedChainEvent[],
  errors: string[],
): boolean {
  const validation = validateAgentReputationRecord(record);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => `agent reputation record: ${error}`));
    return false;
  }
  if (record.passport_id !== report.passport_id || getAddress(record.owner) !== getAddress(report.owner)) {
    errors.push(`agent reputation record ${record.source_id} does not match report passport or owner`);
    return false;
  }
  const submitted = events.find(
    (event) => event.event_name === "ChallengeSubmitted" && event.args.challengeId === record.source_id,
  );
  if (!submitted) {
    errors.push(`missing ChallengeSubmitted event for reputation source ${record.source_id}`);
    return false;
  }
  const resolved = events.find(
    (event) => event.event_name === "ChallengeResolved" && event.args.challengeId === record.source_id,
  );
  if (!resolved) {
    errors.push(`missing ChallengeResolved event for reputation source ${record.source_id}`);
    return false;
  }
  const expectedUpheld = record.source === "challenge_upheld";
  const matched =
    getAddress(String(submitted.args.challenger)) === getAddress(record.subject_address) &&
    Boolean(resolved.args.upheld) === expectedUpheld;
  if (!matched) {
    errors.push(`challenge events do not match reputation record ${record.source_id}`);
  }
  return matched;
}

function unitKindLinkage(
  proposal: UnitKindProposal,
  reviews: UnitKindReview[],
  events: IndexedChainEvent[],
  errors: string[],
): UnitKindLinkage {
  const proposalValidation = validateUnitKindProposal(proposal);
  if (!proposalValidation.ok) {
    errors.push(...proposalValidation.errors.map((error) => `unit kind proposal: ${error}`));
  }
  const kindIdHash =
    typeof proposal.kind_id === "string" ? computeUnitKindIdHash(proposal.kind_id) : (`0x${"0".repeat(64)}` as Hex);
  const versionHash =
    typeof proposal.version === "string" ? computeUnitKindVersionHash(proposal.version) : (`0x${"0".repeat(64)}` as Hex);
  const kindVersionKey = computeUnitKindVersionKey(kindIdHash, versionHash);
  const proposalHash = safeBytes32(proposal.proposal_hash, "proposal_hash");
  const schemaHash = safeBytes32(proposal.schema_hash, "schema_hash");
  const proposalEvent = events.find(
    (event) =>
      event.event_name === "EvolutionUnitKindProposed" &&
      event.args.kindVersionKey === kindVersionKey &&
      event.args.kindIdHash === kindIdHash,
  );
  let proposalEventMatched = false;
  if (!proposalEvent) {
    errors.push(`missing EvolutionUnitKindProposed event for unit kind ${proposal.kind_id}@${proposal.version}`);
  } else {
    proposalEventMatched =
      String(proposalEvent.args.versionHash) === versionHash &&
      String(proposalEvent.args.schemaHash) === schemaHash &&
      String(proposalEvent.args.proposalHash) === proposalHash;
    if (!proposalEventMatched) {
      errors.push(`EvolutionUnitKindProposed event does not match proposal ${proposal.kind_id}@${proposal.version}`);
    }
  }

  const review = reviews.find((candidate) => candidate.kind_id === proposal.kind_id && candidate.version === proposal.version);
  let reviewHash = "";
  let reviewEventFound = false;
  let statusEventFound = false;
  let status = "";
  let artifactValid = proposalValidation.ok;
  if (!review) {
    errors.push(`missing unit kind review artifact for ${proposal.kind_id}@${proposal.version}`);
  } else {
    const reviewValidation = validateUnitKindReview(review);
    artifactValid = artifactValid && reviewValidation.ok;
    if (!reviewValidation.ok) {
      errors.push(...reviewValidation.errors.map((error) => `unit kind review: ${error}`));
    }
    reviewHash = review.review_hash;
    status = review.recommended_status;
    const reviewHashBytes32 = safeBytes32(review.review_hash, "review_hash");
    const reviewEvent = events.find(
      (event) =>
        event.event_name === "EvolutionUnitKindReviewSet" &&
        event.args.kindVersionKey === kindVersionKey &&
        event.args.reviewReportHash === reviewHashBytes32,
    );
    reviewEventFound = Boolean(reviewEvent);
    if (!reviewEvent) {
      errors.push(`missing EvolutionUnitKindReviewSet event for unit kind ${proposal.kind_id}@${proposal.version}`);
    }
    const expectedStatus = reviewValidation.ok ? unitKindStatusId(review.recommended_status) : 0;
    const statusEvent = events.find(
      (event) =>
        event.event_name === "EvolutionUnitKindStatusChanged" &&
        event.args.kindVersionKey === kindVersionKey &&
        numberValue(event.args.newStatus) === expectedStatus,
    );
    statusEventFound = Boolean(statusEvent);
    if (!statusEvent) {
      errors.push(`missing EvolutionUnitKindStatusChanged event for unit kind ${proposal.kind_id}@${proposal.version}`);
    }
  }

  return {
    kind_id: String(proposal.kind_id),
    version: String(proposal.version),
    kind_id_hash: kindIdHash,
    version_hash: versionHash,
    kind_version_key: kindVersionKey,
    proposal_hash: String(proposal.proposal_hash),
    review_hash: reviewHash,
    artifact_valid: artifactValid,
    proposal_event_found: Boolean(proposalEvent),
    proposal_event_matched: proposalEventMatched,
    review_event_found: reviewEventFound,
    status_event_found: statusEventFound,
    status,
  };
}

function validateModuleVerificationArtifactSets(
  manifests: ModuleManifest[],
  acquisitionReceipts: ModuleAcquisitionReceipt[],
  runReceipts: VerificationRunReceipt[],
  claims: CommunityWorkClaim[],
  errors: string[],
): void {
  const manifestHashes = new Set(manifests.map((manifest) => manifest.manifest_hash));
  const acquisitionHashes = new Set(acquisitionReceipts.map((receipt) => receipt.receipt_hash));
  for (const manifest of manifests) {
    const validation = validateModuleManifest(manifest);
    if (!validation.ok) {
      errors.push(...validation.errors.map((error) => `module manifest: ${error}`));
    }
  }
  for (const receipt of acquisitionReceipts) {
    const validation = validateModuleAcquisitionReceipt(receipt);
    if (!validation.ok) {
      errors.push(...validation.errors.map((error) => `module acquisition receipt: ${error}`));
    }
  }
  for (const receipt of runReceipts) {
    const validation = validateVerificationRunReceipt(receipt);
    if (!validation.ok) {
      errors.push(...validation.errors.map((error) => `verification run receipt: ${error}`));
    }
    if (!manifestHashes.has(receipt.manifest_hash)) {
      errors.push(`verification run receipt ${receipt.receipt_hash} references missing manifest ${receipt.manifest_hash}`);
    }
    if (!acquisitionHashes.has(receipt.acquisition_receipt_hash)) {
      errors.push(`verification run receipt ${receipt.receipt_hash} references missing acquisition receipt ${receipt.acquisition_receipt_hash}`);
    }
  }
  for (const claim of claims) {
    const validation = validateCommunityWorkClaim(claim);
    if (!validation.ok) {
      errors.push(...validation.errors.map((error) => `community work claim: ${error}`));
    }
  }
}

function communityWorkLinkage(
  claim: CommunityWorkClaim,
  manifests: ModuleManifest[],
  acquisitionReceipts: ModuleAcquisitionReceipt[],
  runReceipts: VerificationRunReceipt[],
  errors: string[],
): CommunityWorkLinkage {
  const validation = validateCommunityWorkClaim(claim);
  const claimId = typeof claim.claim_id === "string" ? claim.claim_id : "";
  const claimHash = typeof claim.claim_hash === "string" ? claim.claim_hash : "";
  const artifactHashes = new Set(Array.isArray(claim.artifact_hashes) ? claim.artifact_hashes : []);
  const manifestHashes = new Set(manifests.map((manifest) => manifest.manifest_hash));
  const acquisitionHashes = new Set(acquisitionReceipts.map((receipt) => receipt.receipt_hash));
  const runHashes = new Set(runReceipts.map((receipt) => receipt.receipt_hash));
  const allArtifactHashes = new Set([...manifestHashes, ...acquisitionHashes, ...runHashes]);

  for (const artifactHash of artifactHashes) {
    if (!allArtifactHashes.has(artifactHash)) {
      errors.push(`community work claim ${claimId} references missing artifact hash ${artifactHash}`);
    }
  }

  const linkedManifests = manifests.filter((manifest) => artifactHashes.has(manifest.manifest_hash));
  const linkedAcquisitions = acquisitionReceipts.filter((receipt) => artifactHashes.has(receipt.receipt_hash));
  const linkedRuns = runReceipts.filter((receipt) => artifactHashes.has(receipt.receipt_hash));

  const manifestLinked = linkedManifests.length > 0;
  const acquisitionLinked = linkedAcquisitions.length > 0;
  let runLinked = linkedRuns.length > 0;
  let linkedAcquisitionsHashMatched = linkedAcquisitions.length > 0 && linkedAcquisitions.every((receipt) => receipt.hash_matched);

  if (!manifestLinked) {
    errors.push(`community work claim ${claimId} does not link a module manifest artifact`);
  }
  if (!acquisitionLinked) {
    errors.push(`community work claim ${claimId} does not link a module acquisition receipt artifact`);
  }
  if (linkedAcquisitions.some((receipt) => receipt.hash_matched !== true)) {
    linkedAcquisitionsHashMatched = false;
    errors.push(`community work claim ${claimId} links a module acquisition receipt with hash_matched=false`);
  }
  if (linkedRuns.length === 0) {
    runLinked = false;
    errors.push(`community work claim ${claimId} does not link a verification run receipt artifact`);
  }

  for (const run of linkedRuns) {
    const runManifestLinked = manifestHashes.has(run.manifest_hash);
    const runAcquisitionLinked = acquisitionHashes.has(run.acquisition_receipt_hash);
    if (!runManifestLinked) {
      runLinked = false;
      errors.push(`verification run receipt ${run.receipt_hash} references missing manifest ${run.manifest_hash}`);
    }
    if (!runAcquisitionLinked) {
      runLinked = false;
      errors.push(`verification run receipt ${run.receipt_hash} references missing acquisition receipt ${run.acquisition_receipt_hash}`);
    }
    const acquisition = acquisitionReceipts.find((candidate) => candidate.receipt_hash === run.acquisition_receipt_hash);
    if (acquisition && acquisition.hash_matched !== true) {
      linkedAcquisitionsHashMatched = false;
      errors.push(`verification run receipt ${run.receipt_hash} references acquisition receipt with hash_matched=false`);
    }
  }

  const proofBound =
    typeof claim.proof_uri === "string" &&
    claim.proof_uri.length > 0 &&
    typeof claim.proof_digest === "string" &&
    claim.proof_digest.length > 0;
  if (!proofBound) {
    errors.push(`community work claim ${claimId} is missing proof_uri or proof_digest`);
  }

  return {
    claim_id: claimId,
    claim_hash: claimHash,
    responsible_address: typeof claim.responsible_address === "string" ? claim.responsible_address : "",
    work_kind: typeof claim.work_kind === "string" ? claim.work_kind : "",
    artifact_valid: validation.ok,
    manifest_linked: manifestLinked,
    acquisition_receipt_linked: acquisitionLinked,
    verification_run_linked: runLinked,
    hash_matched: linkedAcquisitionsHashMatched,
    proof_bound: proofBound,
  };
}

function testCreditLinkage(
  report: TestCreditReport,
  events: IndexedChainEvent[],
  trustPolicyReport: TrustPolicyReport | undefined,
  errors: string[],
): TestCreditLinkage[] {
  const validation = validateTestCreditReport(report, trustPolicyReport);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => `test credit report: ${error}`));
  }
  return report.actions.map((action) => {
    if (isChallengeBondReason(action.reason)) {
      return {
        passport_id: action.passport_id,
        report_hash: report.report_hash,
        action_hash: action.action_hash,
        action: action.action,
        reason: action.reason,
        amount: action.amount,
        denied: false,
        event_found: null,
        event_matched: true,
        operation_index: null,
      };
    }

    if (action.action === "deny") {
      return {
        passport_id: action.passport_id,
        report_hash: report.report_hash,
        action_hash: action.action_hash,
        action: action.action,
        reason: action.reason,
        amount: action.amount,
        denied: true,
        event_found: null,
        event_matched: true,
        operation_index: null,
      };
    }

    const eventName = action.action === "grant" ? "TestCreditGranted" : "TestCreditConsumed";
    const event = events.find(
      (candidate) =>
        candidate.event_name === eventName &&
        candidate.args.passportId === action.passport_id &&
        candidate.args.actionHash === toBytes32(action.action_hash, "action_hash"),
    );
    let eventMatched = false;
    let operationIndex: number | null = null;
    if (!event) {
      errors.push(`missing ${eventName} event for test credit action ${action.action_hash}`);
    } else {
      operationIndex = numberValue(event.args.operationIndex);
      eventMatched =
        numberValue(event.args.amount) === action.amount &&
        String(event.args.trustPolicyReportHash) === toBytes32(action.trust_policy_report_hash, "trust_policy_report_hash");
      if (!eventMatched) {
        errors.push(`${eventName} event does not match test credit action ${action.action_hash}`);
      }
    }

    return {
      passport_id: action.passport_id,
      report_hash: report.report_hash,
      action_hash: action.action_hash,
      action: action.action,
      reason: action.reason,
      amount: action.amount,
      denied: false,
      event_found: Boolean(event),
      event_matched: eventMatched,
      operation_index: operationIndex,
    };
  });
}

function adjudicationLinkage(
  report: AdjudicationReport,
  events: IndexedChainEvent[],
  errors: string[],
): AdjudicationLinkage {
  const validation = validateAdjudicationReport(report);
  if (!validation.ok) {
    errors.push(...validation.errors.map((error) => `adjudication report: ${error}`));
  }
  if (report.schema_version === "originagent.evolution.adjudication_report.v2") {
    return adjudicationLinkageV2(report, events, errors);
  }
  return adjudicationLinkageV1(report, events, errors);
}

function adjudicationLinkageV1(
  report: AdjudicationReportV1,
  events: IndexedChainEvent[],
  errors: string[],
): AdjudicationLinkage {
  const challengeId = safeBytes32(report.challenge_id, "challenge_id");
  const responseHashes = Array.isArray(report.response_hashes)
    ? report.response_hashes.map((hash) => safeBytes32(hash, "response_hash"))
    : [];
  const verdictHashes = Array.isArray(report.verdict_hashes)
    ? report.verdict_hashes.map((hash) => safeBytes32(hash, "verdict_hash"))
    : [];

  let responseEventsMatched = true;
  for (const responseHash of responseHashes) {
    const responseEvent = events.find(
      (event) =>
        event.event_name === "ChallengeResponseSubmitted" &&
        event.args.challengeId === challengeId &&
        event.args.responseHash === responseHash,
    );
    if (!responseEvent) {
      responseEventsMatched = false;
      errors.push(`missing ChallengeResponseSubmitted event for response ${responseHash}`);
    }
  }

  let verdictEventsMatched = true;
  for (const verdictHash of verdictHashes) {
    const verdictEvent = events.find(
      (event) =>
        event.event_name === "ValidatorVerdictSubmitted" &&
        event.args.challengeId === challengeId &&
        event.args.verdictHash === verdictHash,
    );
    if (!verdictEvent) {
      verdictEventsMatched = false;
      errors.push(`missing ValidatorVerdictSubmitted event for verdict ${verdictHash}`);
    }
  }

  const finalEvent = events.find(
    (event) =>
      event.event_name === "ChallengeAdjudicationFinalized" &&
      event.args.challengeId === challengeId,
  );
  let finalReportMatched = false;
  let outcomeMatched = false;
  let effectiveVerdictCount = 0;
  if (!finalEvent) {
    errors.push(`missing ChallengeAdjudicationFinalized event for challenge ${challengeId}`);
  } else {
    finalReportMatched = String(finalEvent.args.finalReportHash) === safeBytes32(report.final_report_hash, "final_report_hash");
    outcomeMatched = Boolean(finalEvent.args.claimedUpheld) === Boolean(report.claimed_upheld);
    effectiveVerdictCount = numberValue(finalEvent.args.effectiveVerdictCount);
    if (!finalReportMatched) {
      errors.push(`ChallengeAdjudicationFinalized finalReportHash mismatch for challenge ${challengeId}`);
    }
    if (!outcomeMatched) {
      errors.push(`ChallengeAdjudicationFinalized outcome mismatch for challenge ${challengeId}`);
    }
    if (typeof report.effective_verdict_count === "number" && effectiveVerdictCount !== report.effective_verdict_count) {
      errors.push(`ChallengeAdjudicationFinalized effectiveVerdictCount mismatch for challenge ${challengeId}`);
    }
  }

  return {
    challenge_id: challengeId,
    report_hash: String(report.report_hash),
    response_hashes: responseHashes,
    verdict_hashes: verdictHashes,
    response_events_matched: responseEventsMatched,
    verdict_events_matched: verdictEventsMatched,
    finalize_event_found: Boolean(finalEvent),
    final_report_matched: finalReportMatched,
    outcome_matched: outcomeMatched,
    effective_verdict_count: effectiveVerdictCount,
  };
}

function adjudicationLinkageV2(
  report: AdjudicationReportV2,
  events: IndexedChainEvent[],
  errors: string[],
): AdjudicationLinkage {
  const challengeId = safeBytes32(report.challenge_id, "challenge_id");
  const responseHashes = Array.isArray(report.response_hashes)
    ? report.response_hashes.map((hash) => safeBytes32(hash, "response_hash"))
    : [];
  const commitmentHashes = Array.isArray(report.commitment_hashes)
    ? report.commitment_hashes.map((hash) => safeBytes32(hash, "commitment_hash"))
    : [];
  const verdictHashes = Array.isArray(report.revealed_verdict_hashes)
    ? report.revealed_verdict_hashes.map((hash) => safeBytes32(hash, "verdict_hash"))
    : [];

  const phaseEvent = events.find(
    (event) =>
      event.event_name === "AdjudicationPhaseStarted" &&
      event.args.challengeId === challengeId,
  );
  let phaseDeadlinesMatched = false;
  if (!phaseEvent) {
    errors.push(`missing AdjudicationPhaseStarted event for challenge ${challengeId}`);
  } else {
    phaseDeadlinesMatched =
      timestampSeconds(report.response_by) === numberValue(phaseEvent.args.responseBy) &&
      timestampSeconds(report.commit_by) === numberValue(phaseEvent.args.commitBy) &&
      timestampSeconds(report.reveal_by) === numberValue(phaseEvent.args.revealBy);
    if (!phaseDeadlinesMatched) {
      errors.push(`AdjudicationPhaseStarted deadline mismatch for challenge ${challengeId}`);
    }
  }

  let responseEventsMatched = true;
  for (const responseHash of responseHashes) {
    const responseEvent = events.find(
      (event) =>
        event.event_name === "ChallengeResponseSubmitted" &&
        event.args.challengeId === challengeId &&
        event.args.responseHash === responseHash,
    );
    if (!responseEvent) {
      responseEventsMatched = false;
      errors.push(`missing ChallengeResponseSubmitted event for response ${responseHash}`);
    }
  }

  let commitEventsMatched = true;
  for (const commitmentHash of commitmentHashes) {
    const commitEvent = events.find(
      (event) =>
        event.event_name === "ValidatorVerdictCommitted" &&
        event.args.challengeId === challengeId &&
        event.args.commitmentHash === commitmentHash,
    );
    if (!commitEvent) {
      commitEventsMatched = false;
      errors.push(`missing ValidatorVerdictCommitted event for commitment ${commitmentHash}`);
    }
  }

  let revealEventsMatched = true;
  for (const verdictHash of verdictHashes) {
    const revealEvent = events.find(
      (event) =>
        event.event_name === "ValidatorVerdictRevealed" &&
        event.args.challengeId === challengeId &&
        event.args.verdictHash === verdictHash,
    );
    if (!revealEvent) {
      revealEventsMatched = false;
      errors.push(`missing ValidatorVerdictRevealed event for verdict ${verdictHash}`);
    }
  }

  let finalizeEvent: IndexedChainEvent | undefined;
  let expireEvent: IndexedChainEvent | undefined;
  let finalReportMatched = false;
  let expirationReportMatched = false;
  let outcomeMatched = false;
  let effectiveVerdictCount = 0;
  if (report.phase === "finalized") {
    finalizeEvent = events.find(
      (event) =>
        event.event_name === "ChallengeAdjudicationFinalized" &&
        event.args.challengeId === challengeId,
    );
    if (!finalizeEvent) {
      errors.push(`missing ChallengeAdjudicationFinalized event for challenge ${challengeId}`);
    } else {
      finalReportMatched = String(finalizeEvent.args.finalReportHash) === safeBytes32(report.final_report_hash, "final_report_hash");
      outcomeMatched = Boolean(finalizeEvent.args.claimedUpheld) === Boolean(report.claimed_upheld);
      effectiveVerdictCount = numberValue(finalizeEvent.args.effectiveVerdictCount);
      if (!finalReportMatched) {
        errors.push(`ChallengeAdjudicationFinalized finalReportHash mismatch for challenge ${challengeId}`);
      }
      if (!outcomeMatched) {
        errors.push(`ChallengeAdjudicationFinalized outcome mismatch for challenge ${challengeId}`);
      }
      if (typeof report.effective_verdict_count === "number" && effectiveVerdictCount !== report.effective_verdict_count) {
        errors.push(`ChallengeAdjudicationFinalized effectiveVerdictCount mismatch for challenge ${challengeId}`);
      }
    }
  } else {
    expireEvent = events.find(
      (event) =>
        event.event_name === "ChallengeAdjudicationExpiredNoQuorum" &&
        event.args.challengeId === challengeId,
    );
    if (!expireEvent) {
      errors.push(`missing ChallengeAdjudicationExpiredNoQuorum event for challenge ${challengeId}`);
    } else {
      expirationReportMatched =
        String(expireEvent.args.expirationReportHash) === safeBytes32(report.expiration_report_hash, "expiration_report_hash");
      effectiveVerdictCount = report.effective_verdict_count;
      if (!expirationReportMatched) {
        errors.push(`ChallengeAdjudicationExpiredNoQuorum expirationReportHash mismatch for challenge ${challengeId}`);
      }
    }
  }

  return {
    challenge_id: challengeId,
    report_hash: String(report.report_hash),
    phase: report.phase,
    response_hashes: responseHashes,
    commitment_hashes: commitmentHashes,
    verdict_hashes: verdictHashes,
    revealed_verdict_hashes: verdictHashes,
    phase_event_found: Boolean(phaseEvent),
    phase_deadlines_matched: phaseDeadlinesMatched,
    response_events_matched: responseEventsMatched,
    commit_events_matched: commitEventsMatched,
    verdict_events_matched: revealEventsMatched,
    reveal_events_matched: revealEventsMatched,
    finalize_event_found: Boolean(finalizeEvent),
    expire_event_found: Boolean(expireEvent),
    final_report_matched: finalReportMatched,
    expiration_report_matched: expirationReportMatched,
    outcome_matched: report.phase === "finalized" ? outcomeMatched : true,
    effective_verdict_count: effectiveVerdictCount,
  };
}

function validateMigrationIndexes(events: IndexedChainEvent[], errors: string[]): void {
  const expectedByPassport = new Map<string, number>();
  const migrationEvents = events
    .filter((event) => event.event_name === "AgentPassportMigrationRecorded")
    .sort((left, right) => left.block_number - right.block_number || left.log_index - right.log_index);
  for (const event of migrationEvents) {
    const passportId = String(event.args.passportId);
    const expected = (expectedByPassport.get(passportId) ?? 0) + 1;
    const actual = numberValue(event.args.migrationIndex);
    if (actual !== expected) {
      errors.push(`AgentPassportMigrationRecorded migrationIndex mismatch for passport ${passportId}: expected ${expected}, got ${actual}`);
    }
    expectedByPassport.set(passportId, actual);
  }
}

function hasChallengeBondLockArtifact(reports: TestCreditReport[]): boolean {
  return reports.some((report) =>
    report.actions.some((action) => action.reason === "challenge_bond_lock" && action.amount === 10),
  );
}

function isChallengeBondReason(reason: string): boolean {
  return reason === "challenge_bond_lock" ||
    reason === "challenge_bond_refund" ||
    reason === "challenge_bond_consume" ||
    reason === "challenge_bond_partial_fee";
}

function validateAbuseSignalEventLinks(report: AbuseReport, events: IndexedChainEvent[], errors: string[]): void {
  for (const signal of report.signals) {
    if (!signal.evidence.startsWith("event:")) {
      continue;
    }
    const [, eventName, needle] = signal.evidence.split(":", 3);
    const linked = events.some((event) => {
      if (event.event_name !== eventName) {
        return false;
      }
      return !needle || JSON.stringify(event).includes(needle);
    });
    if (!linked) {
      errors.push(`abuse signal ${signal.category} references missing event link ${signal.evidence}`);
    }
  }
}

function evidenceLinkage(report: EvidenceReport, events: IndexedChainEvent[], errors: string[]): EvidenceLinkage {
  const evidenceId = computeEvidenceId(report);
  const event = events.find((candidate) => candidate.event_name === "EvidenceSubmitted" && candidate.args.evidenceId === evidenceId);
  let artifactMatched = false;
  if (!event) {
    errors.push(`missing EvidenceSubmitted event for evidence ${evidenceId}`);
  } else {
    artifactMatched =
      event.args.moduleDigest === toBytes32(report.module_digest, "module_digest") &&
      numberValue(event.args.evidenceType) === evidenceTypeId(report.evidence_type) &&
      getAddress(String(event.args.reporter)) === getAddress(report.reporter);
    if (!artifactMatched) {
      errors.push(`EvidenceSubmitted event does not match artifact for evidence ${evidenceId}`);
    }
  }
  return {
    evidence_id: evidenceId,
    report_hash: report.report_hash,
    event_found: Boolean(event),
    artifact_matched: artifactMatched,
  };
}

function challengeLinkage(record: ChallengeRecord, events: IndexedChainEvent[], errors: string[]): ChallengeLinkage {
  const challengeId = toBytes32(record.challenge_id, "challenge_id");
  const evidenceId = toBytes32(record.evidence_id, "evidence_id");
  const submitted = events.find(
    (event) => event.event_name === "ChallengeSubmitted" && event.args.challengeId === challengeId,
  );
  let recordMatched = false;
  if (!submitted) {
    errors.push(`missing ChallengeSubmitted event for challenge ${challengeId}`);
  } else {
    const computed = computeChallengeId(
      String(submitted.args.evidenceId),
      String(submitted.args.challenger),
      String(submitted.args.reasonHash),
    );
    recordMatched =
      computed === challengeId &&
      String(submitted.args.evidenceId) === evidenceId &&
      String(submitted.args.moduleDigest) === toBytes32(record.module_digest, "module_digest") &&
      String(submitted.args.reasonHash) === toBytes32(record.reason_hash, "reason_hash") &&
      getAddress(String(submitted.args.challenger)) === getAddress(record.challenger);
    if (!recordMatched) {
      errors.push(`ChallengeSubmitted event does not match record for challenge ${challengeId}`);
    }
  }

  const resolved = events.find((event) => event.event_name === "ChallengeResolved" && event.args.challengeId === challengeId);
  const resolutionFound = Boolean(resolved);
  if (record.status !== "submitted" && !resolved) {
    errors.push(`missing ChallengeResolved event for challenge ${challengeId}`);
  }
  if (resolved) {
    const expectedUpheld = record.status === "upheld";
    if (Boolean(resolved.args.upheld) !== expectedUpheld || String(resolved.args.evidenceId) !== evidenceId) {
      errors.push(`ChallengeResolved event does not match record status for challenge ${challengeId}`);
    }
    if (record.resolution_hash && String(resolved.args.resolutionHash) !== toBytes32(record.resolution_hash, "resolution_hash")) {
      errors.push(`ChallengeResolved resolutionHash mismatch for challenge ${challengeId}`);
    }
  }

  const invalidated = events.find(
    (event) => event.event_name === "EvidenceInvalidated" && event.args.evidenceId === evidenceId,
  );
  const invalidationFound = Boolean(invalidated);
  if (record.status === "upheld" && !invalidated) {
    errors.push(`missing EvidenceInvalidated event for upheld challenge ${challengeId}`);
  }

  return {
    challenge_id: challengeId,
    evidence_id: evidenceId,
    event_found: Boolean(submitted),
    record_matched: recordMatched,
    resolution_found: resolutionFound,
    invalidation_found: invalidationFound,
    status: record.status,
  };
}

function decodeIndexedEvent(
  log: Log,
  deployment: DeploymentInfo,
  addressToContract: Map<string, ContractName>,
): IndexedChainEvent | undefined {
  const contract = addressToContract.get(getAddress(log.address));
  if (!contract || log.blockNumber === null || log.transactionHash === null || log.logIndex === null) {
    return undefined;
  }
  const decoded = decodeEventLog({
    abi: ALL_EVENT_ABI,
    data: log.data,
    topics: log.topics,
  });
  return {
    schema_version: "originagent.evolution.event.v1",
    chain_id: deployment.chainId,
    network: deployment.network,
    contract,
    contract_address: getAddress(log.address),
    event_name: String(decoded.eventName),
    block_number: numberValue(log.blockNumber),
    transaction_hash: log.transactionHash,
    log_index: numberValue(log.logIndex),
    args: jsonReady(decoded.args),
  };
}

function addressContractMap(deployment: DeploymentInfo): Map<string, ContractName> {
  return new Map(
    Object.entries(deployment.contracts)
      .filter((entry): entry is [string, Address] => Boolean(entry[1]))
      .map(([contract, address]) => [getAddress(address), contract as ContractName]),
  );
}

function summarizeEvents(events: IndexedChainEvent[]): AuditBundle["events"] {
  const by_contract: Record<string, number> = {};
  const by_event: Record<string, number> = {};
  for (const event of events) {
    by_contract[event.contract] = (by_contract[event.contract] ?? 0) + 1;
    by_event[event.event_name] = (by_event[event.event_name] ?? 0) + 1;
  }
  return {
    total: events.length,
    by_contract,
    by_event,
  };
}

function writeJsonLines(events: IndexedChainEvent[], path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
}

function parseBlockNumber(value: string, flagName: string): bigint {
  const parsed = BigInt(value);
  if (parsed < 0n) {
    throw new Error(`--${flagName} must be non-negative`);
  }
  return parsed;
}

function parseToBlock(value: string): bigint | "latest" {
  if (value === "latest") {
    return "latest";
  }
  return parseBlockNumber(value, "to-block");
}

function jsonReady(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return normalizeJson(value) as Record<string, unknown>;
}

function normalizeJson(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }
  if (typeof value === "object" && value !== null) {
    const normalized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (!/^\d+$/.test(key)) {
        normalized[key] = normalizeJson(item);
      }
    }
    return normalized;
  }
  return value;
}

function numberValue(value: unknown): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "number") {
    return value;
  }
  return Number(value);
}

function timestampSeconds(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : Number.NaN;
}

function safeBytes32(value: unknown, fieldName: string): Hex {
  if (typeof value !== "string") {
    return `0x${"0".repeat(64)}` as Hex;
  }
  try {
    return toBytes32(value, fieldName);
  } catch {
    return `0x${"0".repeat(64)}` as Hex;
  }
}
