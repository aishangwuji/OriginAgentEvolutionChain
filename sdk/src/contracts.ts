import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeFunctionData, getAddress, type Abi, type Address, type Hex } from "viem";

export type ContractName =
  | CoreContractName
  | "AgentReputationRegistry"
  | "EvolutionUnitKindRegistry"
  | "TestCreditLedger"
  | "ChallengeAdjudicationRegistry";

export type CoreContractName =
  | "IdentityRegistry"
  | "AgentPassportRegistry"
  | "ModuleRegistry"
  | "VerificationRegistry"
  | "ScoreCommitReveal";

export type DeploymentContracts = Record<CoreContractName, Address> &
  Partial<Record<"AgentReputationRegistry" | "EvolutionUnitKindRegistry" | "TestCreditLedger" | "ChallengeAdjudicationRegistry", Address>>;

export interface DeploymentInfo {
  chainId: number;
  network: string;
  contracts: DeploymentContracts;
  deployer: Address;
  deployedAt: string;
  contractVersion: string;
}

export const CONTRACT_VERSION = "ec15b.0.0";

export const MODULE_TYPE_IDS = {
  skill: 1,
  domain_pack: 2,
  workflow: 3,
  tool: 4,
} as const;

export const IDENTITY_ROLE_IDS = {
  developer: 1,
  validator: 2,
  operator: 3,
} as const;

export type IdentityRoleName = keyof typeof IDENTITY_ROLE_IDS;

export const IDENTITY_REGISTRY_ABI = [
  {
    type: "event",
    name: "IdentityRegistered",
    inputs: [
      { name: "subject", type: "address", indexed: true },
      { name: "role", type: "uint8", indexed: false },
      { name: "metadataHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "function",
    name: "registerIdentity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "uint8" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "identities",
    stateMutability: "view",
    inputs: [{ name: "subject", type: "address" }],
    outputs: [
      { name: "role", type: "uint8" },
      { name: "metadataHash", type: "bytes32" },
      { name: "registeredAt", type: "uint64" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "isRegistered",
    stateMutability: "view",
    inputs: [{ name: "subject", type: "address" }],
    outputs: [{ name: "registered", type: "bool" }],
  },
] as const satisfies Abi;

export const AGENT_PASSPORT_REGISTRY_ABI = [
  {
    type: "event",
    name: "AgentPassportRegistered",
    inputs: [
      { name: "passportId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "agentKeyHash", type: "bytes32", indexed: false },
      { name: "genesisHash", type: "bytes32", indexed: false },
      { name: "metadataHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentPassportMigrationRecorded",
    inputs: [
      { name: "passportId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "oldAgentKeyHash", type: "bytes32", indexed: false },
      { name: "newAgentKeyHash", type: "bytes32", indexed: false },
      { name: "migrationHash", type: "bytes32", indexed: false },
      { name: "migrationIndex", type: "uint32", indexed: false },
    ],
  },
  {
    type: "function",
    name: "registerAgentPassport",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentKeyHash", type: "bytes32" },
      { name: "genesisHash", type: "bytes32" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [{ name: "passportId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "recordAgentMigration",
    stateMutability: "nonpayable",
    inputs: [
      { name: "passportId", type: "bytes32" },
      { name: "newAgentKeyHash", type: "bytes32" },
      { name: "migrationHash", type: "bytes32" },
    ],
    outputs: [{ name: "migrationIndex", type: "uint32" }],
  },
  {
    type: "function",
    name: "passports",
    stateMutability: "view",
    inputs: [{ name: "passportId", type: "bytes32" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "agentKeyHash", type: "bytes32" },
      { name: "genesisHash", type: "bytes32" },
      { name: "metadataHash", type: "bytes32" },
      { name: "registeredAt", type: "uint64" },
      { name: "migrationCount", type: "uint32" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "computePassportId",
    stateMutability: "pure",
    inputs: [
      { name: "owner", type: "address" },
      { name: "agentKeyHash", type: "bytes32" },
      { name: "genesisHash", type: "bytes32" },
    ],
    outputs: [{ name: "passportId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "computeGenesisHash",
    stateMutability: "pure",
    inputs: [
      { name: "owner", type: "address" },
      { name: "agentKeyHash", type: "bytes32" },
      { name: "genesisNonce", type: "bytes32" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [{ name: "genesisHash", type: "bytes32" }],
  },
  {
    type: "function",
    name: "computeMigrationHash",
    stateMutability: "pure",
    inputs: [
      { name: "passportId", type: "bytes32" },
      { name: "oldAgentKeyHash", type: "bytes32" },
      { name: "newAgentKeyHash", type: "bytes32" },
      { name: "migrationNonce", type: "bytes32" },
    ],
    outputs: [{ name: "migrationHash", type: "bytes32" }],
  },
] as const satisfies Abi;

export const AGENT_REPUTATION_REGISTRY_ABI = [
  {
    type: "event",
    name: "AgentReputationCheckpointed",
    inputs: [
      { name: "passportId", type: "bytes32", indexed: true },
      { name: "score", type: "int32", indexed: false },
      { name: "positiveCount", type: "uint32", indexed: false },
      { name: "negativeCount", type: "uint32", indexed: false },
      { name: "reportHash", type: "bytes32", indexed: false },
      { name: "checkpointIndex", type: "uint32", indexed: false },
    ],
  },
  {
    type: "function",
    name: "checkpointReputation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "passportId", type: "bytes32" },
      { name: "score", type: "int32" },
      { name: "positiveCount", type: "uint32" },
      { name: "negativeCount", type: "uint32" },
      { name: "reportHash", type: "bytes32" },
    ],
    outputs: [{ name: "checkpointIndex", type: "uint32" }],
  },
  {
    type: "function",
    name: "reputations",
    stateMutability: "view",
    inputs: [{ name: "passportId", type: "bytes32" }],
    outputs: [
      { name: "score", type: "int32" },
      { name: "positiveCount", type: "uint32" },
      { name: "negativeCount", type: "uint32" },
      { name: "reportHash", type: "bytes32" },
      { name: "checkpointCount", type: "uint32" },
      { name: "exists", type: "bool" },
    ],
  },
] as const satisfies Abi;

export const EVOLUTION_UNIT_KIND_REGISTRY_ABI = [
  {
    type: "event",
    name: "EvolutionUnitKindProposed",
    inputs: [
      { name: "kindVersionKey", type: "bytes32", indexed: true },
      { name: "kindIdHash", type: "bytes32", indexed: true },
      { name: "versionHash", type: "bytes32", indexed: false },
      { name: "schemaHash", type: "bytes32", indexed: false },
      { name: "proposalHash", type: "bytes32", indexed: false },
      { name: "submitter", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "EvolutionUnitKindReviewSet",
    inputs: [
      { name: "kindVersionKey", type: "bytes32", indexed: true },
      { name: "kindIdHash", type: "bytes32", indexed: true },
      { name: "versionHash", type: "bytes32", indexed: false },
      { name: "reviewReportHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EvolutionUnitKindStatusChanged",
    inputs: [
      { name: "kindVersionKey", type: "bytes32", indexed: true },
      { name: "kindIdHash", type: "bytes32", indexed: true },
      { name: "versionHash", type: "bytes32", indexed: false },
      { name: "previousStatus", type: "uint8", indexed: false },
      { name: "newStatus", type: "uint8", indexed: false },
    ],
  },
  {
    type: "function",
    name: "proposeKind",
    stateMutability: "nonpayable",
    inputs: [
      { name: "kindIdHash", type: "bytes32" },
      { name: "versionHash", type: "bytes32" },
      { name: "schemaHash", type: "bytes32" },
      { name: "proposalHash", type: "bytes32" },
    ],
    outputs: [{ name: "kindVersionKey", type: "bytes32" }],
  },
  {
    type: "function",
    name: "setReviewReport",
    stateMutability: "nonpayable",
    inputs: [
      { name: "kindIdHash", type: "bytes32" },
      { name: "versionHash", type: "bytes32" },
      { name: "reviewReportHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setKindStatus",
    stateMutability: "nonpayable",
    inputs: [
      { name: "kindIdHash", type: "bytes32" },
      { name: "versionHash", type: "bytes32" },
      { name: "status", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "kinds",
    stateMutability: "view",
    inputs: [{ name: "kindVersionKey", type: "bytes32" }],
    outputs: [
      { name: "kindIdHash", type: "bytes32" },
      { name: "versionHash", type: "bytes32" },
      { name: "schemaHash", type: "bytes32" },
      { name: "proposalHash", type: "bytes32" },
      { name: "reviewReportHash", type: "bytes32" },
      { name: "status", type: "uint8" },
      { name: "submitter", type: "address" },
      { name: "registeredAt", type: "uint64" },
      { name: "updatedAt", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "kindExists",
    stateMutability: "view",
    inputs: [
      { name: "kindIdHash", type: "bytes32" },
      { name: "versionHash", type: "bytes32" },
    ],
    outputs: [{ name: "exists", type: "bool" }],
  },
] as const satisfies Abi;

export const TEST_CREDIT_LEDGER_ABI = [
  {
    type: "event",
    name: "TestCreditGranted",
    inputs: [
      { name: "passportId", type: "bytes32", indexed: true },
      { name: "amount", type: "uint64", indexed: false },
      { name: "actionHash", type: "bytes32", indexed: false },
      { name: "trustPolicyReportHash", type: "bytes32", indexed: false },
      { name: "operationIndex", type: "uint32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TestCreditConsumed",
    inputs: [
      { name: "passportId", type: "bytes32", indexed: true },
      { name: "amount", type: "uint64", indexed: false },
      { name: "actionHash", type: "bytes32", indexed: false },
      { name: "trustPolicyReportHash", type: "bytes32", indexed: false },
      { name: "operationIndex", type: "uint32", indexed: false },
    ],
  },
  {
    type: "function",
    name: "grantCredit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "passportId", type: "bytes32" },
      { name: "amount", type: "uint64" },
      { name: "actionHash", type: "bytes32" },
      { name: "trustPolicyReportHash", type: "bytes32" },
    ],
    outputs: [{ name: "operationIndex", type: "uint32" }],
  },
  {
    type: "function",
    name: "consumeCredit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "passportId", type: "bytes32" },
      { name: "amount", type: "uint64" },
      { name: "actionHash", type: "bytes32" },
      { name: "trustPolicyReportHash", type: "bytes32" },
    ],
    outputs: [{ name: "operationIndex", type: "uint32" }],
  },
  {
    type: "function",
    name: "credits",
    stateMutability: "view",
    inputs: [{ name: "passportId", type: "bytes32" }],
    outputs: [
      { name: "granted", type: "uint64" },
      { name: "consumed", type: "uint64" },
      { name: "balance", type: "uint64" },
      { name: "operationCount", type: "uint32" },
      { name: "exists", type: "bool" },
    ],
  },
] as const satisfies Abi;

export const CHALLENGE_ADJUDICATION_REGISTRY_ABI = [
  {
    type: "event",
    name: "ChallengeResponseSubmitted",
    inputs: [
      { name: "challengeId", type: "bytes32", indexed: true },
      { name: "evidenceId", type: "bytes32", indexed: true },
      { name: "respondent", type: "address", indexed: true },
      { name: "responseHash", type: "bytes32", indexed: false },
      { name: "responseSubmittedAt", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AdjudicationPhaseStarted",
    inputs: [
      { name: "challengeId", type: "bytes32", indexed: true },
      { name: "commitStart", type: "uint64", indexed: false },
      { name: "responseBy", type: "uint64", indexed: false },
      { name: "commitBy", type: "uint64", indexed: false },
      { name: "revealBy", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ValidatorVerdictCommitted",
    inputs: [
      { name: "challengeId", type: "bytes32", indexed: true },
      { name: "validator", type: "address", indexed: true },
      { name: "commitmentHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ValidatorVerdictRevealed",
    inputs: [
      { name: "challengeId", type: "bytes32", indexed: true },
      { name: "validator", type: "address", indexed: true },
      { name: "claimedUpheld", type: "bool", indexed: false },
      { name: "verdictHash", type: "bytes32", indexed: false },
      { name: "methodHash", type: "bytes32", indexed: false },
      { name: "operatorGroupHash", type: "bytes32", indexed: false },
      { name: "runnerFingerprintHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ChallengeAdjudicationFinalized",
    inputs: [
      { name: "challengeId", type: "bytes32", indexed: true },
      { name: "claimedUpheld", type: "bool", indexed: false },
      { name: "finalReportHash", type: "bytes32", indexed: false },
      { name: "finalizer", type: "address", indexed: true },
      { name: "effectiveVerdictCount", type: "uint32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ChallengeAdjudicationExpiredNoQuorum",
    inputs: [
      { name: "challengeId", type: "bytes32", indexed: true },
      { name: "expirationReportHash", type: "bytes32", indexed: false },
      { name: "expirer", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ChallengeAdjudicationSplitVote",
    inputs: [
      { name: "challengeId", type: "bytes32", indexed: true },
      { name: "upheldCount", type: "uint32", indexed: false },
      { name: "rejectedCount", type: "uint32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "QuorumUpdated",
    inputs: [
      { name: "oldQuorum", type: "uint256", indexed: false },
      { name: "newQuorum", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "submitResponse",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "responseHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "commitVerdict",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "commitmentHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revealVerdict",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "claimedUpheld", type: "bool" },
      { name: "verdictHash", type: "bytes32" },
      { name: "methodHash", type: "bytes32" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "finalizeChallenge",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "claimedUpheld", type: "bool" },
      { name: "finalReportHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "expireChallengeNoQuorum",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "expirationReportHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setQuorum",
    stateMutability: "nonpayable",
    inputs: [{ name: "newQuorum", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "adjudicationStarted",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [{ name: "started", type: "bool" }],
  },
  {
    type: "function",
    name: "quorum",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "quorum", type: "uint256" }],
  },
  {
    type: "function",
    name: "computeCommitmentHash",
    stateMutability: "pure",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "validator", type: "address" },
      { name: "claimedUpheld", type: "bool" },
      { name: "verdictHash", type: "bytes32" },
      { name: "methodHash", type: "bytes32" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "commitmentHash", type: "bytes32" }],
  },
  {
    type: "function",
    name: "adjudicationPhase",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [{ name: "phase", type: "uint8" }],
  },
  {
    type: "function",
    name: "adjudicationDeadlines",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [
      { name: "responseBy", type: "uint64" },
      { name: "commitBy", type: "uint64" },
      { name: "revealBy", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "adjudicationResponse",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [
      { name: "responseHash", type: "bytes32" },
      { name: "respondent", type: "address" },
      { name: "responseSubmittedAt", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "adjudicationCounters",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [
      { name: "responseCount", type: "uint32" },
      { name: "commitmentCount", type: "uint32" },
      { name: "revealCount", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "adjudicationResult",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [
      { name: "finalized", type: "bool" },
      { name: "expired", type: "bool" },
      { name: "outcome", type: "bool" },
      { name: "effectiveVerdictCount", type: "uint32" },
      { name: "finalReportHash", type: "bytes32" },
      { name: "expirationReportHash", type: "bytes32" },
      { name: "finalizedAt", type: "uint64" },
      { name: "expiredAt", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "effectiveVerdictCount",
    stateMutability: "view",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "claimedUpheld", type: "bool" },
    ],
    outputs: [{ name: "count", type: "uint32" }],
  },
  {
    type: "function",
    name: "validatorCount",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [{ name: "count", type: "uint256" }],
  },
  {
    type: "function",
    name: "responseHashCount",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [{ name: "count", type: "uint256" }],
  },
  {
    type: "function",
    name: "commitmentOf",
    stateMutability: "view",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "validator", type: "address" },
    ],
    outputs: [
      { name: "commitmentHash", type: "bytes32" },
      { name: "committedAt", type: "uint64" },
      { name: "revealed", type: "bool" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "verdictOf",
    stateMutability: "view",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "validator", type: "address" },
    ],
    outputs: [
      { name: "claimedUpheld", type: "bool" },
      { name: "verdictHash", type: "bytes32" },
      { name: "methodHash", type: "bytes32" },
      { name: "operatorGroupHash", type: "bytes32" },
      { name: "runnerFingerprintHash", type: "bytes32" },
      { name: "revealedAt", type: "uint64" },
      { name: "exists", type: "bool" },
    ],
  },
] as const satisfies Abi;

export const MODULE_REGISTRY_ABI = [
  {
    type: "event",
    name: "ModuleSubmitted",
    inputs: [
      { name: "moduleDigest", type: "bytes32", indexed: true },
      { name: "moduleIdHash", type: "bytes32", indexed: true },
      { name: "moduleType", type: "uint8", indexed: false },
      { name: "versionHash", type: "bytes32", indexed: false },
      { name: "storageUri", type: "string", indexed: false },
      { name: "submitter", type: "address", indexed: true },
    ],
  },
  {
    type: "function",
    name: "submitModule",
    stateMutability: "nonpayable",
    inputs: [
      { name: "moduleDigest", type: "bytes32" },
      { name: "moduleIdHash", type: "bytes32" },
      { name: "moduleType", type: "uint8" },
      { name: "versionHash", type: "bytes32" },
      { name: "storageUri", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "moduleExists",
    stateMutability: "view",
    inputs: [{ name: "moduleDigest", type: "bytes32" }],
    outputs: [{ name: "exists", type: "bool" }],
  },
] as const satisfies Abi;

export const VERIFICATION_REGISTRY_ABI = [
  {
    type: "event",
    name: "VerificationReportSubmitted",
    inputs: [
      { name: "moduleDigest", type: "bytes32", indexed: true },
      { name: "proofBundleHash", type: "bytes32", indexed: false },
      { name: "verificationReportHash", type: "bytes32", indexed: false },
      { name: "capabilitySnapshotHash", type: "bytes32", indexed: false },
      { name: "telemetryDigest", type: "bytes32", indexed: false },
      { name: "reporter", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ValidatorProfileSet",
    inputs: [
      { name: "validator", type: "address", indexed: true },
      { name: "operatorGroupHash", type: "bytes32", indexed: false },
      { name: "runnerFingerprintHash", type: "bytes32", indexed: false },
      { name: "allowed", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EvidenceSubmitted",
    inputs: [
      { name: "evidenceId", type: "bytes32", indexed: true },
      { name: "moduleDigest", type: "bytes32", indexed: true },
      { name: "evidenceType", type: "uint8", indexed: false },
      { name: "reporter", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "EvidenceInvalidated",
    inputs: [
      { name: "evidenceId", type: "bytes32", indexed: true },
      { name: "reasonHash", type: "bytes32", indexed: false },
      { name: "actor", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ChallengeSubmitted",
    inputs: [
      { name: "challengeId", type: "bytes32", indexed: true },
      { name: "evidenceId", type: "bytes32", indexed: true },
      { name: "moduleDigest", type: "bytes32", indexed: true },
      { name: "reasonHash", type: "bytes32", indexed: false },
      { name: "challenger", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ChallengeResolved",
    inputs: [
      { name: "challengeId", type: "bytes32", indexed: true },
      { name: "evidenceId", type: "bytes32", indexed: true },
      { name: "upheld", type: "bool", indexed: false },
      { name: "resolutionHash", type: "bytes32", indexed: false },
      { name: "resolver", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ChallengeResolvedOnAlreadyInvalidated",
    inputs: [
      { name: "challengeId", type: "bytes32", indexed: true },
      { name: "evidenceId", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "AdjudicatorProposed",
    inputs: [
      { name: "pendingAdjudicator", type: "address", indexed: true },
      { name: "proposedAt", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AdjudicatorConfirmed",
    inputs: [{ name: "adjudicator", type: "address", indexed: true }],
  },
  {
    type: "function",
    name: "setValidatorProfile",
    stateMutability: "nonpayable",
    inputs: [
      { name: "validator", type: "address" },
      { name: "operatorGroupHash", type: "bytes32" },
      { name: "runnerFingerprintHash", type: "bytes32" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "submitReport",
    stateMutability: "nonpayable",
    inputs: [
      { name: "moduleDigest", type: "bytes32" },
      { name: "proofBundleHash", type: "bytes32" },
      { name: "verificationReportHash", type: "bytes32" },
      { name: "capabilitySnapshotHash", type: "bytes32" },
      { name: "telemetryDigest", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "submitEvidence",
    stateMutability: "nonpayable",
    inputs: [
      { name: "moduleDigest", type: "bytes32" },
      { name: "proofBundleHash", type: "bytes32" },
      { name: "reportHash", type: "bytes32" },
      { name: "evidenceType", type: "uint8" },
      { name: "operatorGroupHash", type: "bytes32" },
      { name: "runnerFingerprintHash", type: "bytes32" },
      { name: "challengeWindowEnd", type: "uint64" },
    ],
    outputs: [{ name: "evidenceId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "invalidateEvidence",
    stateMutability: "nonpayable",
    inputs: [
      { name: "evidenceId", type: "bytes32" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "submitChallenge",
    stateMutability: "nonpayable",
    inputs: [
      { name: "evidenceId", type: "bytes32" },
      { name: "reasonHash", type: "bytes32" },
    ],
    outputs: [{ name: "challengeId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "resolveChallenge",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "upheld", type: "bool" },
      { name: "resolutionHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "proposeAdjudicator",
    stateMutability: "nonpayable",
    inputs: [{ name: "newAdjudicator", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmAdjudicator",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveChallengeFromAdjudicator",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "upheld", type: "bool" },
      { name: "resolutionHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "evidenceReporter",
    stateMutability: "view",
    inputs: [{ name: "evidenceId", type: "bytes32" }],
    outputs: [{ name: "reporter", type: "address" }],
  },
  {
    type: "function",
    name: "evidenceStatus",
    stateMutability: "view",
    inputs: [{ name: "evidenceId", type: "bytes32" }],
    outputs: [{ name: "status", type: "uint8" }],
  },
  {
    type: "function",
    name: "evidenceTypeOf",
    stateMutability: "view",
    inputs: [{ name: "evidenceId", type: "bytes32" }],
    outputs: [{ name: "evidenceType", type: "uint8" }],
  },
  {
    type: "function",
    name: "challenges",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "bytes32" }],
    outputs: [
      { name: "challengeId", type: "bytes32" },
      { name: "evidenceId", type: "bytes32" },
      { name: "moduleDigest", type: "bytes32" },
      { name: "reasonHash", type: "bytes32" },
      { name: "challenger", type: "address" },
      { name: "submittedAt", type: "uint64" },
      { name: "resolvedAt", type: "uint64" },
      { name: "resolutionHash", type: "bytes32" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "testnetReputation",
    stateMutability: "view",
    inputs: [{ name: "subject", type: "address" }],
    outputs: [{ name: "reputation", type: "int32" }],
  },
] as const satisfies Abi;

export const SCORE_COMMIT_REVEAL_ABI = [
  {
    type: "event",
    name: "ScoreCommitted",
    inputs: [
      { name: "moduleDigest", type: "bytes32", indexed: true },
      { name: "scorer", type: "address", indexed: true },
      { name: "commitHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ScoreRevealed",
    inputs: [
      { name: "moduleDigest", type: "bytes32", indexed: true },
      { name: "scorer", type: "address", indexed: true },
      { name: "score", type: "uint8", indexed: false },
      { name: "reasonHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "function",
    name: "commitScore",
    stateMutability: "nonpayable",
    inputs: [
      { name: "moduleDigest", type: "bytes32" },
      { name: "commitHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revealScore",
    stateMutability: "nonpayable",
    inputs: [
      { name: "moduleDigest", type: "bytes32" },
      { name: "score", type: "uint8" },
      { name: "reasonHash", type: "bytes32" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

export function loadDeployment(network: string, deploymentsDir = "deployments"): DeploymentInfo {
  if (!/^[a-zA-Z0-9_-]+$/.test(network)) {
    throw new Error("network must contain only letters, numbers, underscore, or dash");
  }
  const path = resolve(deploymentsDir, `${network}.json`);
  if (!existsSync(path)) {
    throw new Error(`deployment file not found: ${path}`);
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as DeploymentInfo;
  return normalizeDeployment(parsed, network);
}

export function encodeCall(contract: ContractName, method: string, args: readonly unknown[]): Hex {
  if (contract === "IdentityRegistry") {
    return encodeFunctionData({
      abi: IDENTITY_REGISTRY_ABI,
      functionName: method as "registerIdentity",
      args,
    });
  }
  if (contract === "AgentPassportRegistry") {
    return encodeFunctionData({
      abi: AGENT_PASSPORT_REGISTRY_ABI,
      functionName: method as "registerAgentPassport" | "recordAgentMigration",
      args,
    });
  }
  if (contract === "AgentReputationRegistry") {
    return encodeFunctionData({
      abi: AGENT_REPUTATION_REGISTRY_ABI,
      functionName: method as "checkpointReputation",
      args,
    });
  }
  if (contract === "EvolutionUnitKindRegistry") {
    return encodeFunctionData({
      abi: EVOLUTION_UNIT_KIND_REGISTRY_ABI,
      functionName: method as "proposeKind" | "setReviewReport" | "setKindStatus",
      args,
    });
  }
  if (contract === "TestCreditLedger") {
    return encodeFunctionData({
      abi: TEST_CREDIT_LEDGER_ABI,
      functionName: method as "grantCredit" | "consumeCredit",
      args,
    });
  }
  if (contract === "ChallengeAdjudicationRegistry") {
    return encodeFunctionData({
      abi: CHALLENGE_ADJUDICATION_REGISTRY_ABI,
      functionName: method as
        | "submitResponse"
        | "commitVerdict"
        | "revealVerdict"
        | "finalizeChallenge"
        | "expireChallengeNoQuorum"
        | "setQuorum",
      args,
    });
  }
  if (contract === "ModuleRegistry") {
    return encodeFunctionData({ abi: MODULE_REGISTRY_ABI, functionName: method as "submitModule", args });
  }
  if (contract === "VerificationRegistry") {
    return encodeFunctionData({
      abi: VERIFICATION_REGISTRY_ABI,
      functionName: method as
        | "setValidatorProfile"
        | "submitReport"
        | "submitEvidence"
        | "invalidateEvidence"
        | "submitChallenge"
        | "resolveChallenge"
        | "proposeAdjudicator"
        | "confirmAdjudicator"
        | "resolveChallengeFromAdjudicator",
      args,
    });
  }
  if (contract === "ScoreCommitReveal") {
    return encodeFunctionData({
      abi: SCORE_COMMIT_REVEAL_ABI,
      functionName: method as "commitScore" | "revealScore",
      args,
    });
  }
  throw new Error(`unsupported contract for calldata encoding: ${contract}`);
}

export function getReputationRegistry(deployment: DeploymentInfo): Address | undefined {
  const address = deployment.contracts.AgentReputationRegistry;
  if (!address) {
    return undefined;
  }
  try {
    return getAddress(address);
  } catch {
    return undefined;
  }
}

export function getEvolutionUnitKindRegistry(deployment: DeploymentInfo): Address | undefined {
  const address = deployment.contracts.EvolutionUnitKindRegistry;
  if (!address) {
    return undefined;
  }
  try {
    return getAddress(address);
  } catch {
    return undefined;
  }
}

export function getTestCreditLedger(deployment: DeploymentInfo): Address | undefined {
  const address = deployment.contracts.TestCreditLedger;
  if (!address) {
    return undefined;
  }
  try {
    return getAddress(address);
  } catch {
    return undefined;
  }
}

export function getChallengeAdjudicationRegistry(deployment: DeploymentInfo): Address | undefined {
  const address = deployment.contracts.ChallengeAdjudicationRegistry;
  if (!address) {
    return undefined;
  }
  try {
    return getAddress(address);
  } catch {
    return undefined;
  }
}

function normalizeDeployment(value: DeploymentInfo, requestedNetwork: string): DeploymentInfo {
  if (!Number.isInteger(value.chainId) || value.chainId <= 0) {
    throw new Error("deployment chainId must be a positive integer");
  }
  if (value.network !== requestedNetwork) {
    throw new Error(`deployment network mismatch: expected ${requestedNetwork}, got ${value.network}`);
  }
  const requiredContracts: CoreContractName[] = [
    "IdentityRegistry",
    "AgentPassportRegistry",
    "ModuleRegistry",
    "VerificationRegistry",
    "ScoreCommitReveal",
  ];
  const contracts = {} as DeploymentContracts;
  for (const contract of requiredContracts) {
    contracts[contract] = getAddress(value.contracts[contract]);
  }
  const reputationRegistry = getReputationRegistry(value);
  if (reputationRegistry) {
    contracts.AgentReputationRegistry = reputationRegistry;
  }
  const evolutionUnitKindRegistry = getEvolutionUnitKindRegistry(value);
  if (evolutionUnitKindRegistry) {
    contracts.EvolutionUnitKindRegistry = evolutionUnitKindRegistry;
  }
  const testCreditLedger = getTestCreditLedger(value);
  if (testCreditLedger) {
    contracts.TestCreditLedger = testCreditLedger;
  }
  const challengeAdjudicationRegistry = getChallengeAdjudicationRegistry(value);
  if (challengeAdjudicationRegistry) {
    contracts.ChallengeAdjudicationRegistry = challengeAdjudicationRegistry;
  }
  return {
    chainId: value.chainId,
    network: value.network,
    contracts,
    deployer: getAddress(value.deployer),
    deployedAt: value.deployedAt,
    contractVersion: value.contractVersion,
  };
}
