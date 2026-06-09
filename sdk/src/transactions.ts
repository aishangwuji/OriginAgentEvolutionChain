import { createWalletClient, getAddress, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { assertOciDigestMatchesArtifact } from "./artifact.ts";
import {
  validateAdjudicationReport,
  validateChallengeResponse,
  validateValidatorVerdict,
  validateValidatorVerdictCommitment,
  validateValidatorVerdictReveal,
  type AdjudicationReport,
  type ChallengeResponse,
  type ValidatorVerdict,
  type ValidatorVerdictCommitment,
  type ValidatorVerdictReveal,
} from "./adjudication.ts";
import {
  AGENT_PASSPORT_REGISTRY_ABI,
  AGENT_REPUTATION_REGISTRY_ABI,
  CHALLENGE_ADJUDICATION_REGISTRY_ABI,
  encodeCall,
  EVOLUTION_UNIT_KIND_REGISTRY_ABI,
  getChallengeAdjudicationRegistry,
  getEvolutionUnitKindRegistry,
  getReputationRegistry,
  getTestCreditLedger,
  IDENTITY_REGISTRY_ABI,
  IDENTITY_ROLE_IDS,
  loadDeployment,
  MODULE_REGISTRY_ABI,
  MODULE_TYPE_IDS,
  SCORE_COMMIT_REVEAL_ABI,
  TEST_CREDIT_LEDGER_ABI,
  VERIFICATION_REGISTRY_ABI,
  type ContractName,
  type DeploymentInfo,
  type IdentityRoleName,
} from "./contracts.ts";
import { toBytes32 } from "./canonical.ts";
import {
  evidenceReportToContractArgs,
  validateEvidenceReport,
  type EvidenceReport,
} from "./evidence.ts";
import { computeAgentPassportId } from "./passport.ts";
import { prepareModuleSubmission, validateProofBundle, type ProofBundle } from "./proof.ts";
import { computeScoreCommitHash } from "./score.ts";
import {
  computeUnitKindIdHash,
  computeUnitKindVersionHash,
  computeUnitKindVersionKey,
  unitKindStatusId,
  validateUnitKindProposal,
  validateUnitKindReview,
  type UnitKindProposal,
  type UnitKindReview,
  type UnitKindStatus,
} from "./unit-kind.ts";

export interface DryRunTransaction {
  ok: true;
  dryRun: true;
  network: string;
  chainId: number;
  contract: ContractName;
  target: Address;
  method: string;
  args: readonly unknown[];
  calldata: Hex;
  publicPayload: Record<string, unknown>;
}

export interface BroadcastTransaction {
  ok: true;
  dryRun: false;
  network: string;
  chainId: number;
  contract: ContractName;
  target: Address;
  method: string;
  transactionHash: Hex;
}

export interface TransactionOptions {
  network: string;
  dryRun?: boolean;
  deploymentsDir?: string;
}

export async function registerIdentityTransaction(
  role: string,
  metadataHash: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const roleId = identityRoleId(role);
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const args = [roleId, toBytes32(metadataHash, "metadataHash")] as const;
  return buildOrBroadcast(
    deployment,
    "IdentityRegistry",
    "registerIdentity",
    args,
    {
      role,
      roleId,
      metadataHash: args[1],
    },
    Boolean(options.dryRun),
  );
}

export async function registerAgentPassportTransaction(
  owner: string,
  agentKeyHash: string,
  genesisHash: string,
  metadataHash: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const ownerAddress = getAddress(owner);
  assertOwnerSignerIfBroadcast(ownerAddress, options);
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const args = [
    toBytes32(agentKeyHash, "agent_key_hash"),
    toBytes32(genesisHash, "genesis_hash"),
    toBytes32(metadataHash, "metadata_hash"),
  ] as const;
  return buildOrBroadcast(
    deployment,
    "AgentPassportRegistry",
    "registerAgentPassport",
    args,
    {
      owner: ownerAddress,
      agentKeyHash: args[0],
      genesisHash: args[1],
      metadataHash: args[2],
      passportId: computeAgentPassportId(ownerAddress, args[0], args[1]),
    },
    Boolean(options.dryRun),
  );
}

export async function recordAgentMigrationTransaction(
  owner: string,
  passportId: string,
  newAgentKeyHash: string,
  migrationHash: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const ownerAddress = getAddress(owner);
  assertOwnerSignerIfBroadcast(ownerAddress, options);
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const args = [
    toBytes32(passportId, "passport_id"),
    toBytes32(newAgentKeyHash, "new_agent_key_hash"),
    toBytes32(migrationHash, "migration_hash"),
  ] as const;
  return buildOrBroadcast(
    deployment,
    "AgentPassportRegistry",
    "recordAgentMigration",
    args,
    {
      owner: ownerAddress,
      passportId: args[0],
      newAgentKeyHash: args[1],
      migrationHash: args[2],
    },
    Boolean(options.dryRun),
  );
}

export async function checkpointAgentReputationTransaction(
  passportId: string,
  score: number,
  positiveCount: number,
  negativeCount: number,
  reportHash: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  assertInt32(score, "score");
  assertUint32(positiveCount, "positive_count");
  assertUint32(negativeCount, "negative_count");
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  if (!getReputationRegistry(deployment)) {
    throw new Error("AgentReputationRegistry not found in deployment; this network may not support EC-10 reputation");
  }
  const args = [
    toBytes32(passportId, "passport_id"),
    score,
    positiveCount,
    negativeCount,
    toBytes32(reportHash, "report_hash"),
  ] as const;
  return buildOrBroadcast(
    deployment,
    "AgentReputationRegistry",
    "checkpointReputation",
    args,
    {
      passportId: args[0],
      score,
      positiveCount,
      negativeCount,
      reportHash: args[4],
    },
    Boolean(options.dryRun),
  );
}

export async function proposeUnitKindTransaction(
  proposal: UnitKindProposal,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const validation = validateUnitKindProposal(proposal);
  if (!validation.ok) {
    throw new Error(`invalid unit kind proposal: ${validation.errors.join("; ")}`);
  }
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  if (!getEvolutionUnitKindRegistry(deployment)) {
    throw new Error("EvolutionUnitKindRegistry not found in deployment; this network may not support EC-11 unit kinds");
  }
  const kindIdHash = computeUnitKindIdHash(proposal.kind_id);
  const versionHash = computeUnitKindVersionHash(proposal.version);
  const args = [
    kindIdHash,
    versionHash,
    toBytes32(proposal.schema_hash, "schema_hash"),
    toBytes32(proposal.proposal_hash, "proposal_hash"),
  ] as const;
  return buildOrBroadcast(
    deployment,
    "EvolutionUnitKindRegistry",
    "proposeKind",
    args,
    {
      kindId: proposal.kind_id,
      version: proposal.version,
      kindIdHash,
      versionHash,
      kindVersionKey: computeUnitKindVersionKey(kindIdHash, versionHash),
      schemaHash: args[2],
      proposalHash: args[3],
    },
    Boolean(options.dryRun),
  );
}

export async function setUnitKindReviewTransaction(
  review: UnitKindReview,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const validation = validateUnitKindReview(review);
  if (!validation.ok) {
    throw new Error(`invalid unit kind review: ${validation.errors.join("; ")}`);
  }
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  assertDeployerSignerIfBroadcast(deployment, options);
  if (!getEvolutionUnitKindRegistry(deployment)) {
    throw new Error("EvolutionUnitKindRegistry not found in deployment; this network may not support EC-11 unit kinds");
  }
  const kindIdHash = computeUnitKindIdHash(review.kind_id);
  const versionHash = computeUnitKindVersionHash(review.version);
  const args = [kindIdHash, versionHash, toBytes32(review.review_hash, "review_hash")] as const;
  return buildOrBroadcast(
    deployment,
    "EvolutionUnitKindRegistry",
    "setReviewReport",
    args,
    {
      kindId: review.kind_id,
      version: review.version,
      kindIdHash,
      versionHash,
      kindVersionKey: computeUnitKindVersionKey(kindIdHash, versionHash),
      reviewHash: args[2],
    },
    Boolean(options.dryRun),
  );
}

export async function setUnitKindStatusTransaction(
  kindId: string,
  version: string,
  status: UnitKindStatus,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  assertDeployerSignerIfBroadcast(deployment, options);
  if (!getEvolutionUnitKindRegistry(deployment)) {
    throw new Error("EvolutionUnitKindRegistry not found in deployment; this network may not support EC-11 unit kinds");
  }
  const kindIdHash = computeUnitKindIdHash(kindId);
  const versionHash = computeUnitKindVersionHash(version);
  const statusId = unitKindStatusId(status);
  const args = [kindIdHash, versionHash, statusId] as const;
  return buildOrBroadcast(
    deployment,
    "EvolutionUnitKindRegistry",
    "setKindStatus",
    args,
    {
      kindId,
      version,
      kindIdHash,
      versionHash,
      kindVersionKey: computeUnitKindVersionKey(kindIdHash, versionHash),
      status,
      statusId,
    },
    Boolean(options.dryRun),
  );
}

export async function grantTestCreditTransaction(
  passportId: string,
  amount: number,
  actionHash: string,
  trustPolicyReportHash: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  return testCreditTransaction("grantCredit", passportId, amount, actionHash, trustPolicyReportHash, options);
}

export async function consumeTestCreditTransaction(
  passportId: string,
  amount: number,
  actionHash: string,
  trustPolicyReportHash: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  return testCreditTransaction("consumeCredit", passportId, amount, actionHash, trustPolicyReportHash, options);
}

export async function submitModuleTransaction(
  bundle: ProofBundle,
  storageUri: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  assertOciDigestMatchesArtifact(storageUri, bundle.artifact_digest);
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const submission = prepareModuleSubmission(bundle, storageUri);
  const args = [
    submission.moduleDigest,
    submission.moduleIdHash,
    MODULE_TYPE_IDS[submission.moduleType],
    submission.versionHash,
    submission.storageUri,
  ] as const;
  return buildOrBroadcast(
    deployment,
    "ModuleRegistry",
    "submitModule",
    args,
    {
      moduleDigest: submission.moduleDigest,
      moduleIdHash: submission.moduleIdHash,
      moduleType: submission.moduleType,
      versionHash: submission.versionHash,
      manifestHash: submission.manifestHash,
      proofBundleHash: submission.proofBundleHash,
      storageUri: submission.storageUri,
    },
    Boolean(options.dryRun),
  );
}

export async function submitToolModuleTransaction(
  bundle: ProofBundle,
  storageUri: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  if (bundle.module_type !== "tool") {
    throw new Error("submit-tool-module only accepts proof bundles with module_type=tool");
  }
  return submitModuleTransaction(bundle, storageUri, options);
}

export async function submitVerificationTransaction(
  bundle: ProofBundle,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const validation = validateProofBundle(bundle);
  if (!validation.ok) {
    throw new Error(`invalid proof bundle: ${validation.errors.join("; ")}`);
  }
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const args = [
    toBytes32(bundle.artifact_digest, "artifact_digest"),
    toBytes32(bundle.proof_bundle_hash, "proof_bundle_hash"),
    toBytes32(bundle.verification_report_digest, "verification_report_digest"),
    toBytes32(bundle.capability_snapshot_digest, "capability_snapshot_digest", true),
    toBytes32(bundle.telemetry_digest, "telemetry_digest"),
  ] as const;
  return buildOrBroadcast(
    deployment,
    "VerificationRegistry",
    "submitReport",
    args,
    {
      moduleDigest: args[0],
      proofBundleHash: args[1],
      verificationReportHash: args[2],
      capabilitySnapshotHash: args[3],
      telemetryDigest: args[4],
    },
    Boolean(options.dryRun),
  );
}

export async function setValidatorProfileTransaction(
  validator: string,
  operatorGroupHash: string,
  runnerFingerprintHash: string,
  allowed: boolean,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const args = [
    getAddress(validator),
    toBytes32(operatorGroupHash, "operator_group_hash"),
    toBytes32(runnerFingerprintHash, "runner_fingerprint_hash"),
    allowed,
  ] as const;
  return buildOrBroadcast(
    deployment,
    "VerificationRegistry",
    "setValidatorProfile",
    args,
    {
      validator: args[0],
      operatorGroupHash: args[1],
      runnerFingerprintHash: args[2],
      allowed,
    },
    Boolean(options.dryRun),
  );
}

export async function submitValidatorReportTransaction(
  report: EvidenceReport,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const validation = validateEvidenceReport(report);
  if (!validation.ok) {
    throw new Error(`invalid evidence report: ${validation.errors.join("; ")}`);
  }
  if (report.report_status !== "active") {
    throw new Error("only active evidence reports can be submitted on-chain");
  }
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const args = evidenceReportToContractArgs(report);
  return buildOrBroadcast(
    deployment,
    "VerificationRegistry",
    "submitEvidence",
    args,
    {
      moduleDigest: args[0],
      proofBundleHash: args[1],
      reportHash: args[2],
      evidenceType: report.evidence_type,
      operatorGroupHash: args[4],
      runnerFingerprintHash: args[5],
      challengeWindowEnd: args[6],
      testnetOnly: true,
    },
    Boolean(options.dryRun),
  );
}

export async function invalidateEvidenceTransaction(
  evidenceId: string,
  reasonHash: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const args = [toBytes32(evidenceId, "evidenceId"), toBytes32(reasonHash, "reasonHash")] as const;
  return buildOrBroadcast(
    deployment,
    "VerificationRegistry",
    "invalidateEvidence",
    args,
    {
      evidenceId: args[0],
      reasonHash: args[1],
      testnetOnly: true,
    },
    Boolean(options.dryRun),
  );
}

export async function submitChallengeTransaction(
  evidenceId: string,
  reasonHash: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const args = [toBytes32(evidenceId, "evidenceId"), toBytes32(reasonHash, "reasonHash")] as const;
  return buildOrBroadcast(
    deployment,
    "VerificationRegistry",
    "submitChallenge",
    args,
    {
      evidenceId: args[0],
      reasonHash: args[1],
      testnetOnly: true,
    },
    Boolean(options.dryRun),
  );
}

export async function resolveChallengeTransaction(
  challengeId: string,
  upheld: boolean,
  resolutionHash: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const args = [toBytes32(challengeId, "challengeId"), upheld, toBytes32(resolutionHash, "resolutionHash")] as const;
  return buildOrBroadcast(
    deployment,
    "VerificationRegistry",
    "resolveChallenge",
    args,
    {
      challengeId: args[0],
      upheld,
      resolutionHash: args[2],
      testnetOnly: true,
      legacySandboxOnly: true,
    },
    Boolean(options.dryRun),
  );
}

export async function submitChallengeResponseTransaction(
  response: ChallengeResponse,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const validation = validateChallengeResponse(response);
  if (!validation.ok) {
    throw new Error(`invalid challenge response: ${validation.errors.join("; ")}`);
  }
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  if (!getChallengeAdjudicationRegistry(deployment)) {
    throw new Error("ChallengeAdjudicationRegistry not found in deployment; this network may not support EC-15B adjudication");
  }
  const args = [toBytes32(response.challenge_id, "challenge_id"), toBytes32(response.response_hash, "response_hash")] as const;
  return buildOrBroadcast(
    deployment,
    "ChallengeAdjudicationRegistry",
    "submitResponse",
    args,
    {
      challengeId: args[0],
      evidenceId: response.evidence_id,
      respondent: response.respondent,
      responseHash: args[1],
      recordHash: response.record_hash,
    },
    Boolean(options.dryRun),
  );
}

export async function commitValidatorVerdictTransaction(
  commitment: ValidatorVerdictCommitment,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const validation = validateValidatorVerdictCommitment(commitment);
  if (!validation.ok) {
    throw new Error(`invalid validator verdict commitment: ${validation.errors.join("; ")}`);
  }
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  if (!getChallengeAdjudicationRegistry(deployment)) {
    throw new Error("ChallengeAdjudicationRegistry not found in deployment; this network may not support EC-15B adjudication");
  }
  const args = [
    toBytes32(commitment.challenge_id, "challenge_id"),
    toBytes32(commitment.commitment_hash, "commitment_hash"),
  ] as const;
  return buildOrBroadcast(
    deployment,
    "ChallengeAdjudicationRegistry",
    "commitVerdict",
    args,
    {
      challengeId: args[0],
      validator: commitment.validator,
      commitmentHash: args[1],
      recordHash: commitment.record_hash,
    },
    Boolean(options.dryRun),
  );
}

export async function submitValidatorVerdictTransaction(
  verdict: ValidatorVerdict,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const validation = validateValidatorVerdict(verdict);
  if (!validation.ok) {
    throw new Error(`invalid legacy validator verdict: ${validation.errors.join("; ")}`);
  }
  void options;
  throw new Error("submitValidatorVerdictTransaction is a legacy EC-15A helper; use commitValidatorVerdictTransaction and revealValidatorVerdictTransaction for EC-15B");
}

export async function revealValidatorVerdictTransaction(
  reveal: ValidatorVerdictReveal,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const validation = validateValidatorVerdictReveal(reveal);
  if (!validation.ok) {
    throw new Error(`invalid validator verdict reveal: ${validation.errors.join("; ")}`);
  }
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  if (!getChallengeAdjudicationRegistry(deployment)) {
    throw new Error("ChallengeAdjudicationRegistry not found in deployment; this network may not support EC-15B adjudication");
  }
  const args = [
    toBytes32(reveal.challenge_id, "challenge_id"),
    reveal.claimed_upheld,
    toBytes32(reveal.verdict_hash, "verdict_hash"),
    toBytes32(reveal.method_hash, "method_hash"),
    toBytes32(reveal.salt, "salt"),
  ] as const;
  return buildOrBroadcast(
    deployment,
    "ChallengeAdjudicationRegistry",
    "revealVerdict",
    args,
    {
      challengeId: args[0],
      validator: reveal.validator,
      claimedUpheld: reveal.claimed_upheld,
      verdictHash: args[2],
      methodHash: args[3],
      salt: args[4],
      commitmentHash: reveal.commitment_hash,
      recordHash: reveal.record_hash,
    },
    Boolean(options.dryRun),
  );
}

export async function finalizeChallengeAdjudicationTransaction(
  report: AdjudicationReport,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const validation = validateAdjudicationReport(report);
  if (!validation.ok) {
    throw new Error(`invalid adjudication report: ${validation.errors.join("; ")}`);
  }
  if (report.phase !== "finalized") {
    throw new Error("only finalized adjudication reports can finalize a challenge");
  }
  if (report.claimed_upheld === null || report.final_report_hash === null) {
    throw new Error("finalized adjudication reports require claimed_upheld and final_report_hash");
  }
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  if (!getChallengeAdjudicationRegistry(deployment)) {
    throw new Error("ChallengeAdjudicationRegistry not found in deployment; this network may not support EC-15B adjudication");
  }
  const args = [
    toBytes32(report.challenge_id, "challenge_id"),
    report.claimed_upheld,
    toBytes32(report.final_report_hash, "final_report_hash"),
  ] as const;
  return buildOrBroadcast(
    deployment,
    "ChallengeAdjudicationRegistry",
    "finalizeChallenge",
    args,
    {
      challengeId: args[0],
      claimedUpheld: report.claimed_upheld,
      finalReportHash: args[2],
      quorum: report.quorum,
      effectiveVerdictCount: report.effective_verdict_count,
      reportHash: report.report_hash,
    },
    Boolean(options.dryRun),
  );
}

export async function expireChallengeNoQuorumTransaction(
  report: AdjudicationReport,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const validation = validateAdjudicationReport(report);
  if (!validation.ok) {
    throw new Error(`invalid adjudication report: ${validation.errors.join("; ")}`);
  }
  if (report.phase !== "expired_no_quorum") {
    throw new Error("only expired_no_quorum adjudication reports can expire a challenge");
  }
  if (report.expiration_report_hash === null) {
    throw new Error("expired adjudication reports require expiration_report_hash");
  }
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  if (!getChallengeAdjudicationRegistry(deployment)) {
    throw new Error("ChallengeAdjudicationRegistry not found in deployment; this network may not support EC-15B adjudication");
  }
  const args = [
    toBytes32(report.challenge_id, "challenge_id"),
    toBytes32(report.expiration_report_hash, "expiration_report_hash"),
  ] as const;
  return buildOrBroadcast(
    deployment,
    "ChallengeAdjudicationRegistry",
    "expireChallengeNoQuorum",
    args,
    {
      challengeId: args[0],
      expirationReportHash: args[1],
      quorum: report.quorum,
      effectiveVerdictCount: report.effective_verdict_count,
      reportHash: report.report_hash,
    },
    Boolean(options.dryRun),
  );
}

export async function submitScoreCommitTransaction(
  moduleDigest: string,
  score: number,
  reasonHash: string,
  salt: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const commitHash = computeScoreCommitHash(score, reasonHash, salt);
  const args = [toBytes32(moduleDigest, "moduleDigest"), commitHash] as const;
  return buildOrBroadcast(
    deployment,
    "ScoreCommitReveal",
    "commitScore",
    args,
    {
      moduleDigest: args[0],
      score,
      reasonHash: toBytes32(reasonHash, "reasonHash"),
      salt: toBytes32(salt, "salt"),
      commitHash,
    },
    Boolean(options.dryRun),
  );
}

export async function submitScoreRevealTransaction(
  moduleDigest: string,
  score: number,
  reasonHash: string,
  salt: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  const args = [
    toBytes32(moduleDigest, "moduleDigest"),
    score,
    toBytes32(reasonHash, "reasonHash"),
    toBytes32(salt, "salt"),
  ] as const;
  return buildOrBroadcast(
    deployment,
    "ScoreCommitReveal",
    "revealScore",
    args,
    {
      moduleDigest: args[0],
      score,
      reasonHash: args[2],
      salt: args[3],
      commitHash: computeScoreCommitHash(score, reasonHash, salt),
    },
    Boolean(options.dryRun),
  );
}

async function buildOrBroadcast(
  deployment: DeploymentInfo,
  contract: ContractName,
  method: string,
  args: readonly unknown[],
  publicPayload: Record<string, unknown>,
  dryRun: boolean,
): Promise<DryRunTransaction | BroadcastTransaction> {
  const target = deployment.contracts[contract];
  if (!target) {
    throw new Error(`${contract} not found in deployment`);
  }
  const calldata = encodeCall(contract, method, args);
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      network: deployment.network,
      chainId: deployment.chainId,
      contract,
      target,
      method,
      args,
      calldata,
      publicPayload,
    };
  }

  const rpcUrl = process.env.EVOLUTION_CHAIN_RPC_URL;
  const privateKey = process.env.EVOLUTION_CHAIN_PRIVATE_KEY;
  if (!rpcUrl) {
    throw new Error("EVOLUTION_CHAIN_RPC_URL is required when --dry-run is not set");
  }
  if (!privateKey) {
    throw new Error("EVOLUTION_CHAIN_PRIVATE_KEY is required when --dry-run is not set");
  }
  const account = privateKeyToAccount(toBytes32(privateKey, "EVOLUTION_CHAIN_PRIVATE_KEY"));
  const wallet = createWalletClient({
    account,
    transport: http(rpcUrl),
  });
  const transactionHash = await wallet.writeContract({
    address: target,
    abi: abiFor(contract),
    functionName: method,
    args,
  });
  return {
    ok: true,
    dryRun: false,
    network: deployment.network,
    chainId: deployment.chainId,
    contract,
    target,
    method,
    transactionHash,
  };
}

function abiFor(contract: ContractName) {
  if (contract === "IdentityRegistry") {
    return IDENTITY_REGISTRY_ABI;
  }
  if (contract === "AgentPassportRegistry") {
    return AGENT_PASSPORT_REGISTRY_ABI;
  }
  if (contract === "AgentReputationRegistry") {
    return AGENT_REPUTATION_REGISTRY_ABI;
  }
  if (contract === "EvolutionUnitKindRegistry") {
    return EVOLUTION_UNIT_KIND_REGISTRY_ABI;
  }
  if (contract === "TestCreditLedger") {
    return TEST_CREDIT_LEDGER_ABI;
  }
  if (contract === "ChallengeAdjudicationRegistry") {
    return CHALLENGE_ADJUDICATION_REGISTRY_ABI;
  }
  if (contract === "ModuleRegistry") {
    return MODULE_REGISTRY_ABI;
  }
  if (contract === "VerificationRegistry") {
    return VERIFICATION_REGISTRY_ABI;
  }
  if (contract === "ScoreCommitReveal") {
    return SCORE_COMMIT_REVEAL_ABI;
  }
  throw new Error(`unsupported broadcast contract: ${contract}`);
}

function assertInt32(value: number, name: string): void {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
    throw new Error(`--${name} must be a signed 32-bit integer`);
  }
}

function assertUint32(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 4294967295) {
    throw new Error(`--${name} must be an unsigned 32-bit integer`);
  }
}

function assertUint64(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive safe integer`);
  }
}

function identityRoleId(role: string): number {
  if (role === "developer" || role === "validator" || role === "operator") {
    return IDENTITY_ROLE_IDS[role as IdentityRoleName];
  }
  throw new Error("--role must be developer, validator, or operator");
}

function assertOwnerSignerIfBroadcast(owner: Address, options: TransactionOptions): void {
  if (Boolean(options.dryRun)) {
    return;
  }
  const privateKey = process.env.EVOLUTION_CHAIN_PRIVATE_KEY;
  if (!privateKey) {
    return;
  }
  const signer = privateKeyToAccount(toBytes32(privateKey, "EVOLUTION_CHAIN_PRIVATE_KEY")).address;
  if (getAddress(signer) !== owner) {
    throw new Error("--owner must match EVOLUTION_CHAIN_PRIVATE_KEY signer for passport broadcasts");
  }
}

function assertDeployerSignerIfBroadcast(deployment: DeploymentInfo, options: TransactionOptions): void {
  if (Boolean(options.dryRun)) {
    return;
  }
  const privateKey = process.env.EVOLUTION_CHAIN_PRIVATE_KEY;
  if (!privateKey) {
    return;
  }
  const signer = privateKeyToAccount(toBytes32(privateKey, "EVOLUTION_CHAIN_PRIVATE_KEY")).address;
  if (getAddress(signer) !== getAddress(deployment.deployer)) {
    throw new Error("owner-only broadcasts require EVOLUTION_CHAIN_PRIVATE_KEY signer to match deployment deployer");
  }
}

async function testCreditTransaction(
  method: "grantCredit" | "consumeCredit",
  passportId: string,
  amount: number,
  actionHash: string,
  trustPolicyReportHash: string,
  options: TransactionOptions,
): Promise<DryRunTransaction | BroadcastTransaction> {
  assertUint64(amount, "amount");
  const deployment = loadDeployment(options.network, options.deploymentsDir);
  assertDeployerSignerIfBroadcast(deployment, options);
  if (!getTestCreditLedger(deployment)) {
    throw new Error("TestCreditLedger not found in deployment; this network may not support EC-14 test credit");
  }
  const args = [
    toBytes32(passportId, "passport_id"),
    amount,
    toBytes32(actionHash, "action_hash"),
    toBytes32(trustPolicyReportHash, "trust_policy_report_hash"),
  ] as const;
  return buildOrBroadcast(
    deployment,
    "TestCreditLedger",
    method,
    args,
    {
      passportId: args[0],
      amount,
      actionHash: args[2],
      trustPolicyReportHash: args[3],
    },
    Boolean(options.dryRun),
  );
}
