// Package common defines shared types and constants used across all ChainMaker Go contracts
// for the OriginAgent Evolution Chain consortium network.
package common

import (
	"encoding/json"
	"strconv"

	"chainmaker.org/chainmaker/contract-sdk-go/v2/sdk"
)

// Identity roles — mirrors IdentityRegistry.IdentityRole from the Solidity version.
const (
	RoleNone      uint8 = 0
	RoleDeveloper uint8 = 1
	RoleValidator uint8 = 2
	RoleOperator  uint8 = 3
)

// Module types — mirrors ModuleRegistry.ModuleType.
const (
	ModuleTypeUnknown    uint8 = 0
	ModuleTypeSkill      uint8 = 1
	ModuleTypeDomainPack uint8 = 2
	ModuleTypeWorkflow   uint8 = 3
	ModuleTypeTool       uint8 = 4
)

// Evidence types — mirrors VerificationRegistry.EvidenceType.
const (
	EvidenceTypeUnknown                  uint8 = 0
	EvidenceTypeLocalClientReport        uint8 = 1
	EvidenceTypeUserSignedReceipt        uint8 = 2
	EvidenceTypeValidatorReport          uint8 = 3
	EvidenceTypeUnqualifiedValidatorReport uint8 = 4
	EvidenceTypeFoundationSeedReport     uint8 = 5
)

// Report statuses.
const (
	ReportStatusActive      uint8 = 0
	ReportStatusInvalidated uint8 = 1
)

// Challenge statuses.
const (
	ChallengeStatusUnknown   uint8 = 0
	ChallengeStatusSubmitted uint8 = 1
	ChallengeStatusUpheld    uint8 = 2
	ChallengeStatusRejected  uint8 = 3
)

// Adjudication phases — mirrors ChallengeAdjudicationRegistry.AdjudicationPhase.
const (
	AdjudicationPhaseUnknown         uint8 = 0
	AdjudicationPhaseResponseOpen    uint8 = 1
	AdjudicationPhaseCommitOpen      uint8 = 2
	AdjudicationPhaseRevealOpen      uint8 = 3
	AdjudicationPhaseFinalized       uint8 = 4
	AdjudicationPhaseExpiredNoQuorum uint8 = 5
)

// Unit kind statuses — mirrors EvolutionUnitKindRegistry.
const (
	UnitKindStatusProposed  uint8 = 0
	UnitKindStatusCanonical uint8 = 1
	UnitKindStatusDeprecated uint8 = 2
)

// Passport statuses.
const (
	PassportStatusActive  uint8 = 0
	PassportStatusRetired uint8 = 1
	PassportStatusRevoked uint8 = 2
)

// Module publication statuses.
const (
	ModuleStatusNone      uint8 = 0
	ModuleStatusSubmitted uint8 = 1
)

// State key prefixes for composite key construction.
const (
	PrefixIdentity        = "IDENTITY"
	PrefixPassport        = "PASSPORT"
	PrefixReputation      = "REPUTATION"
	PrefixModule          = "MODULE"
	PrefixEvidence        = "EVIDENCE"
	PrefixChallenge       = "CHALLENGE"
	PrefixScoreCommit     = "SCORE_COMMIT"
	PrefixScoreReveal     = "SCORE_REVEAL"
	PrefixCredit          = "CREDIT"
	PrefixUnitKind        = "UNITKIND"
	PrefixAdjudication    = "ADJUDICATION"
	PrefixValidator       = "VALIDATOR"
	PrefixCommitment      = "COMMITMENT"
	PrefixVerdict         = "VERDICT"
	PrefixModuleEvidence  = "MODULE_EVIDENCE"
	PrefixResponseHash    = "RESPONSE_HASH"
	PrefixChallengeValidator = "CHALLENGE_VALIDATOR"
)

// BuildKey constructs a composite state key from a prefix and components.
func BuildKey(prefix string, components ...string) string {
	if len(components) == 0 {
		return prefix
	}
	// Pre-allocate: prefix + len(":")*len(components) + sum(component lengths)
	n := len(prefix) + len(components)
	for _, c := range components {
		n += len(c)
	}
	b := make([]byte, 0, n)
	b = append(b, prefix...)
	for _, c := range components {
		b = append(b, ':')
		b = append(b, c...)
	}
	return string(b)
}

// ToJSON marshals a value to canonical JSON bytes.
func ToJSON(v any) ([]byte, error) {
	return json.Marshal(v)
}

// FromJSON unmarshals canonical JSON bytes into a value.
func FromJSON(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

// GetTxTimestamp returns the current transaction timestamp as int64 (Unix seconds).
func GetTxTimestamp() (int64, error) {
	ts, err := sdk.Instance.GetTxTimeStamp()
	if err != nil {
		return 0, err
	}
	n, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return 0, err
	}
	return n, nil
}

// BytesToHex32 validates that b is exactly 32 bytes and returns it as a hex string.
// Returns an empty string if validation fails.
func BytesToHex32(b []byte) string {
	if len(b) != 32 {
		return ""
	}
	return string(b)
}
