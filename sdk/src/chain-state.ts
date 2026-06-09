import { createPublicClient, getAddress, http, type Address, type Hex } from "viem";
import { toBytes32 } from "./canonical.ts";
import {
  AGENT_PASSPORT_REGISTRY_ABI,
  AGENT_REPUTATION_REGISTRY_ABI,
  CHALLENGE_ADJUDICATION_REGISTRY_ABI,
  EVOLUTION_UNIT_KIND_REGISTRY_ABI,
  getChallengeAdjudicationRegistry,
  getEvolutionUnitKindRegistry,
  getReputationRegistry,
  getTestCreditLedger,
  IDENTITY_REGISTRY_ABI,
  loadDeployment,
  MODULE_REGISTRY_ABI,
  TEST_CREDIT_LEDGER_ABI,
  VERIFICATION_REGISTRY_ABI,
  type DeploymentInfo,
} from "./contracts.ts";
import {
  computeUnitKindIdHash,
  computeUnitKindVersionHash,
  computeUnitKindVersionKey,
} from "./unit-kind.ts";

export interface ChainStateCheckInput {
  network: string;
  deploymentsDir?: string;
  moduleDigest?: string;
  evidenceId?: string;
  challengeId?: string;
  passportId?: string;
  unitKind?: string;
  version?: string;
  reporter?: string;
  challenger?: string;
}

export interface ChainStateCheckResult {
  ok: true;
  network: string;
  chainId: number;
  contracts: DeploymentInfo["contracts"];
  module?: {
    moduleDigest: Hex;
    exists: boolean;
  };
  evidence?: {
    evidenceId: Hex;
    status: number;
    statusName: string;
    evidenceType: number;
    evidenceTypeName: string;
  };
  challenge?: {
    challengeId: Hex;
    evidenceId: Hex;
    moduleDigest: Hex;
    reasonHash: Hex;
    challenger: Address;
    submittedAt: number;
    resolvedAt: number;
    resolutionHash: Hex;
    status: number;
    statusName: string;
    adjudication:
      | {
          available: false;
        }
      | {
          available: true;
          phase: number;
          phaseName: string;
          responseHash: Hex;
          respondent: Address;
          responseSubmittedAt: number;
          responseBy: number;
          commitBy: number;
          revealBy: number;
          responseCount: number;
          commitmentCount: number;
          revealCount: number;
          verdictCount: number;
          quorum: number;
          finalized: boolean;
          expired: boolean;
          outcome: boolean;
          outcomeName: string;
          effectiveVerdictCount: number;
          upheldVerdictCount: number;
          rejectedVerdictCount: number;
          finalReportHash: Hex;
          expirationReportHash: Hex;
          finalizedAt: number;
          expiredAt: number;
        };
  };
  passport?: {
    passportId: Hex;
    owner: Address;
    agentKeyHash: Hex;
    genesisHash: Hex;
    metadataHash: Hex;
    registeredAt: number;
    migrationCount: number;
    exists: boolean;
    reputation:
      | {
          available: false;
        }
      | {
          available: true;
          score: number;
          positiveCount: number;
          negativeCount: number;
          reportHash: Hex;
          checkpointCount: number;
          exists: boolean;
        };
    test_credit:
      | {
          available: false;
        }
      | {
          available: true;
          granted: number;
          consumed: number;
          balance: number;
          operationCount: number;
          exists: boolean;
        };
  };
  unitKind?: {
    kindId: string;
    version: string;
    kindIdHash: Hex;
    versionHash: Hex;
    kindVersionKey: Hex;
    available: boolean;
    exists: boolean;
    schemaHash?: Hex;
    proposalHash?: Hex;
    reviewReportHash?: Hex;
    status?: number;
    statusName?: string;
    submitter?: Address;
    registeredAt?: number;
    updatedAt?: number;
  };
  reporter?: SubjectState;
  challenger?: SubjectState;
}

export interface SubjectState {
  address: Address;
  registered: boolean;
  identity: {
    role: number;
    roleName: string;
    metadataHash: Hex;
    registeredAt: number;
    exists: boolean;
  };
  testnetReputation: number;
}

export async function readChainStateCheck(input: ChainStateCheckInput): Promise<ChainStateCheckResult> {
  if (
    !input.moduleDigest &&
    !input.evidenceId &&
    !input.challengeId &&
    !input.passportId &&
    !input.unitKind &&
    !input.reporter &&
    !input.challenger
  ) {
    throw new Error(
      "chain-state-check requires at least one of --module-digest, --evidence-id, --challenge-id, --passport-id, --unit-kind, --reporter, or --challenger",
    );
  }
  const rpcUrl = process.env.EVOLUTION_CHAIN_RPC_URL;
  if (!rpcUrl) {
    throw new Error("EVOLUTION_CHAIN_RPC_URL is required for chain-state-check");
  }

  const deployment = loadDeployment(input.network, input.deploymentsDir);
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const result: ChainStateCheckResult = {
    ok: true,
    network: deployment.network,
    chainId: deployment.chainId,
    contracts: deployment.contracts,
  };

  if (input.moduleDigest) {
    const moduleDigest = toBytes32(input.moduleDigest, "moduleDigest");
    result.module = {
      moduleDigest,
      exists: await publicClient.readContract({
        address: deployment.contracts.ModuleRegistry,
        abi: MODULE_REGISTRY_ABI,
        functionName: "moduleExists",
        args: [moduleDigest],
      }),
    };
  }

  if (input.evidenceId) {
    const evidenceId = toBytes32(input.evidenceId, "evidenceId");
    const status = numberValue(
      await publicClient.readContract({
        address: deployment.contracts.VerificationRegistry,
        abi: VERIFICATION_REGISTRY_ABI,
        functionName: "evidenceStatus",
        args: [evidenceId],
      }),
    );
    const evidenceType = numberValue(
      await publicClient.readContract({
        address: deployment.contracts.VerificationRegistry,
        abi: VERIFICATION_REGISTRY_ABI,
        functionName: "evidenceTypeOf",
        args: [evidenceId],
      }),
    );
    result.evidence = {
      evidenceId,
      status,
      statusName: evidenceStatusName(status),
      evidenceType,
      evidenceTypeName: evidenceTypeName(evidenceType),
    };
  }

  if (input.challengeId) {
    result.challenge = await readChallenge(deployment, publicClient, toBytes32(input.challengeId, "challengeId"));
  }

  if (input.passportId) {
    result.passport = await readPassport(deployment, publicClient, toBytes32(input.passportId, "passport_id"));
  }

  if (input.unitKind) {
    result.unitKind = await readUnitKind(deployment, publicClient, input.unitKind, input.version ?? "1");
  }

  if (input.reporter) {
    result.reporter = await readSubject(deployment, publicClient, getAddress(input.reporter));
  }
  if (input.challenger) {
    result.challenger = await readSubject(deployment, publicClient, getAddress(input.challenger));
  }

  return result;
}

async function readUnitKind(
  deployment: DeploymentInfo,
  publicClient: ReturnType<typeof createPublicClient>,
  kindId: string,
  version: string,
): Promise<NonNullable<ChainStateCheckResult["unitKind"]>> {
  const kindIdHash = computeUnitKindIdHash(kindId);
  const versionHash = computeUnitKindVersionHash(version);
  const kindVersionKey = computeUnitKindVersionKey(kindIdHash, versionHash);
  const registry = getEvolutionUnitKindRegistry(deployment);
  if (!registry) {
    return {
      kindId,
      version,
      kindIdHash,
      versionHash,
      kindVersionKey,
      available: false,
      exists: false,
    };
  }
  const kind = tupleLike(
    await publicClient.readContract({
      address: registry,
      abi: EVOLUTION_UNIT_KIND_REGISTRY_ABI,
      functionName: "kinds",
      args: [kindVersionKey],
    }),
  );
  const status = numberValue(kind.status ?? kind[5]);
  return {
    kindId,
    version,
    kindIdHash,
    versionHash,
    kindVersionKey,
    available: true,
    exists: status !== 0,
    schemaHash: hexValue(kind.schemaHash ?? kind[2]),
    proposalHash: hexValue(kind.proposalHash ?? kind[3]),
    reviewReportHash: hexValue(kind.reviewReportHash ?? kind[4]),
    status,
    statusName: unitKindStatusName(status),
    submitter: getAddress(String(kind.submitter ?? kind[6])),
    registeredAt: numberValue(kind.registeredAt ?? kind[7]),
    updatedAt: numberValue(kind.updatedAt ?? kind[8]),
  };
}

async function readPassport(
  deployment: DeploymentInfo,
  publicClient: ReturnType<typeof createPublicClient>,
  passportId: Hex,
): Promise<NonNullable<ChainStateCheckResult["passport"]>> {
  const passport = tupleLike(
    await publicClient.readContract({
      address: deployment.contracts.AgentPassportRegistry,
      abi: AGENT_PASSPORT_REGISTRY_ABI,
      functionName: "passports",
      args: [passportId],
    }),
  );
  const exists = Boolean(passport.exists ?? passport[6]);
  return {
    passportId,
    owner: getAddress(String(passport.owner ?? passport[0])),
    agentKeyHash: hexValue(passport.agentKeyHash ?? passport[1]),
    genesisHash: hexValue(passport.genesisHash ?? passport[2]),
    metadataHash: hexValue(passport.metadataHash ?? passport[3]),
    registeredAt: numberValue(passport.registeredAt ?? passport[4]),
    migrationCount: numberValue(passport.migrationCount ?? passport[5]),
    exists,
    reputation: await readPassportReputation(deployment, publicClient, passportId),
    test_credit: await readPassportTestCredit(deployment, publicClient, passportId),
  };
}

async function readPassportReputation(
  deployment: DeploymentInfo,
  publicClient: ReturnType<typeof createPublicClient>,
  passportId: Hex,
): Promise<NonNullable<ChainStateCheckResult["passport"]>["reputation"]> {
  const reputationRegistry = getReputationRegistry(deployment);
  if (!reputationRegistry) {
    return { available: false };
  }
  const reputation = tupleLike(
    await publicClient.readContract({
      address: reputationRegistry,
      abi: AGENT_REPUTATION_REGISTRY_ABI,
      functionName: "reputations",
      args: [passportId],
    }),
  );
  return {
    available: true,
    score: numberValue(reputation.score ?? reputation[0]),
    positiveCount: numberValue(reputation.positiveCount ?? reputation[1]),
    negativeCount: numberValue(reputation.negativeCount ?? reputation[2]),
    reportHash: hexValue(reputation.reportHash ?? reputation[3]),
    checkpointCount: numberValue(reputation.checkpointCount ?? reputation[4]),
    exists: Boolean(reputation.exists ?? reputation[5]),
  };
}

async function readPassportTestCredit(
  deployment: DeploymentInfo,
  publicClient: ReturnType<typeof createPublicClient>,
  passportId: Hex,
): Promise<NonNullable<ChainStateCheckResult["passport"]>["test_credit"]> {
  const testCreditLedger = getTestCreditLedger(deployment);
  if (!testCreditLedger) {
    return { available: false };
  }
  const credit = tupleLike(
    await publicClient.readContract({
      address: testCreditLedger,
      abi: TEST_CREDIT_LEDGER_ABI,
      functionName: "credits",
      args: [passportId],
    }),
  );
  return {
    available: true,
    granted: numberValue(credit.granted ?? credit[0]),
    consumed: numberValue(credit.consumed ?? credit[1]),
    balance: numberValue(credit.balance ?? credit[2]),
    operationCount: numberValue(credit.operationCount ?? credit[3]),
    exists: Boolean(credit.exists ?? credit[4]),
  };
}

async function readChallenge(
  deployment: DeploymentInfo,
  publicClient: ReturnType<typeof createPublicClient>,
  challengeId: Hex,
): Promise<NonNullable<ChainStateCheckResult["challenge"]>> {
  const challenge = await publicClient.readContract({
    address: deployment.contracts.VerificationRegistry,
    abi: VERIFICATION_REGISTRY_ABI,
    functionName: "challenges",
    args: [challengeId],
  });
  const tuple = tupleLike(challenge);
  const status = numberValue(tuple.status ?? tuple[8]);
  return {
    challengeId: hexValue(tuple.challengeId ?? tuple[0]),
    evidenceId: hexValue(tuple.evidenceId ?? tuple[1]),
    moduleDigest: hexValue(tuple.moduleDigest ?? tuple[2]),
    reasonHash: hexValue(tuple.reasonHash ?? tuple[3]),
    challenger: getAddress(String(tuple.challenger ?? tuple[4])),
    submittedAt: numberValue(tuple.submittedAt ?? tuple[5]),
    resolvedAt: numberValue(tuple.resolvedAt ?? tuple[6]),
    resolutionHash: hexValue(tuple.resolutionHash ?? tuple[7]),
    status,
    statusName: challengeStatusName(status),
    adjudication: await readChallengeAdjudication(deployment, publicClient, challengeId),
  };
}

async function readChallengeAdjudication(
  deployment: DeploymentInfo,
  publicClient: ReturnType<typeof createPublicClient>,
  challengeId: Hex,
): Promise<NonNullable<ChainStateCheckResult["challenge"]>["adjudication"]> {
  const registry = getChallengeAdjudicationRegistry(deployment);
  if (!registry) {
    return { available: false };
  }
  const [
    quorum,
    phase,
    deadlines,
    response,
    counters,
    result,
    upheldVerdictCount,
    rejectedVerdictCount,
  ] = await Promise.all([
    publicClient.readContract({
      address: registry,
      abi: CHALLENGE_ADJUDICATION_REGISTRY_ABI,
      functionName: "quorum",
      args: [],
    }),
    publicClient.readContract({
      address: registry,
      abi: CHALLENGE_ADJUDICATION_REGISTRY_ABI,
      functionName: "adjudicationPhase",
      args: [challengeId],
    }),
    publicClient.readContract({
      address: registry,
      abi: CHALLENGE_ADJUDICATION_REGISTRY_ABI,
      functionName: "adjudicationDeadlines",
      args: [challengeId],
    }),
    publicClient.readContract({
      address: registry,
      abi: CHALLENGE_ADJUDICATION_REGISTRY_ABI,
      functionName: "adjudicationResponse",
      args: [challengeId],
    }),
    publicClient.readContract({
      address: registry,
      abi: CHALLENGE_ADJUDICATION_REGISTRY_ABI,
      functionName: "adjudicationCounters",
      args: [challengeId],
    }),
    publicClient.readContract({
      address: registry,
      abi: CHALLENGE_ADJUDICATION_REGISTRY_ABI,
      functionName: "adjudicationResult",
      args: [challengeId],
    }),
    publicClient.readContract({
      address: registry,
      abi: CHALLENGE_ADJUDICATION_REGISTRY_ABI,
      functionName: "effectiveVerdictCount",
      args: [challengeId, true],
    }),
    publicClient.readContract({
      address: registry,
      abi: CHALLENGE_ADJUDICATION_REGISTRY_ABI,
      functionName: "effectiveVerdictCount",
      args: [challengeId, false],
    }),
  ]);
  const deadlineTuple = tupleLike(deadlines);
  const responseTuple = tupleLike(response);
  const counterTuple = tupleLike(counters);
  const resultTuple = tupleLike(result);
  const phaseId = numberValue(phase);
  const outcome = Boolean(resultTuple.outcome ?? resultTuple[2]);
  const finalized = Boolean(resultTuple.finalized ?? resultTuple[0]);
  const expired = Boolean(resultTuple.expired ?? resultTuple[1]);
  const revealCount = numberValue(counterTuple.revealCount ?? counterTuple[2]);
  return {
    available: true,
    phase: phaseId,
    phaseName: adjudicationPhaseName(phaseId),
    responseHash: hexValue(responseTuple.responseHash ?? responseTuple[0]),
    respondent: getAddress(String(responseTuple.respondent ?? responseTuple[1])),
    responseSubmittedAt: numberValue(responseTuple.responseSubmittedAt ?? responseTuple[2]),
    responseBy: numberValue(deadlineTuple.responseBy ?? deadlineTuple[0]),
    commitBy: numberValue(deadlineTuple.commitBy ?? deadlineTuple[1]),
    revealBy: numberValue(deadlineTuple.revealBy ?? deadlineTuple[2]),
    responseCount: numberValue(counterTuple.responseCount ?? counterTuple[0]),
    commitmentCount: numberValue(counterTuple.commitmentCount ?? counterTuple[1]),
    revealCount,
    verdictCount: revealCount,
    quorum: numberValue(quorum),
    finalized,
    expired,
    outcome,
    outcomeName: finalized ? (outcome ? "upheld" : "rejected") : expired ? "expired_no_quorum" : "unknown",
    effectiveVerdictCount: numberValue(resultTuple.effectiveVerdictCount ?? resultTuple[3]),
    upheldVerdictCount: numberValue(upheldVerdictCount),
    rejectedVerdictCount: numberValue(rejectedVerdictCount),
    finalReportHash: hexValue(resultTuple.finalReportHash ?? resultTuple[4]),
    expirationReportHash: hexValue(resultTuple.expirationReportHash ?? resultTuple[5]),
    finalizedAt: numberValue(resultTuple.finalizedAt ?? resultTuple[6]),
    expiredAt: numberValue(resultTuple.expiredAt ?? resultTuple[7]),
  };
}

async function readSubject(
  deployment: DeploymentInfo,
  publicClient: ReturnType<typeof createPublicClient>,
  subject: Address,
): Promise<SubjectState> {
  const registered = await publicClient.readContract({
    address: deployment.contracts.IdentityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "isRegistered",
    args: [subject],
  });
  const identity = tupleLike(
    await publicClient.readContract({
      address: deployment.contracts.IdentityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "identities",
      args: [subject],
    }),
  );
  const reputation = await publicClient.readContract({
    address: deployment.contracts.VerificationRegistry,
    abi: VERIFICATION_REGISTRY_ABI,
    functionName: "testnetReputation",
    args: [subject],
  });
  const role = numberValue(identity.role ?? identity[0]);
  return {
    address: subject,
    registered,
    identity: {
      role,
      roleName: identityRoleName(role),
      metadataHash: hexValue(identity.metadataHash ?? identity[1]),
      registeredAt: numberValue(identity.registeredAt ?? identity[2]),
      exists: Boolean(identity.exists ?? identity[3]),
    },
    testnetReputation: numberValue(reputation),
  };
}

function tupleLike(value: unknown): Record<string, unknown> & { [index: number]: unknown } {
  return value as Record<string, unknown> & { [index: number]: unknown };
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

function hexValue(value: unknown): Hex {
  return toBytes32(String(value), "bytes32");
}

function identityRoleName(role: number): string {
  return ["unknown", "developer", "validator", "operator"][role] ?? "unknown";
}

function evidenceStatusName(status: number): string {
  return ["unknown", "active", "invalidated"][status] ?? "unknown";
}

function challengeStatusName(status: number): string {
  return ["unknown", "submitted", "upheld", "rejected"][status] ?? "unknown";
}

function adjudicationPhaseName(phase: number): string {
  return [
    "not_started",
    "response_open",
    "commit_open",
    "reveal_open",
    "finalized",
    "expired_no_quorum",
  ][phase] ?? "unknown";
}

function evidenceTypeName(evidenceType: number): string {
  return [
    "unknown",
    "local_client_report",
    "user_signed_receipt",
    "validator_report",
    "unqualified_validator_report",
    "foundation_seed_report",
  ][evidenceType] ?? "unknown";
}

function unitKindStatusName(status: number): string {
  return ["None", "Draft", "Experimental", "Candidate", "Canonical", "Deprecated", "Rejected"][status] ?? "unknown";
}
