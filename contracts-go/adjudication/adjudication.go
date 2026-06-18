// Package adjudication implements the ChallengeAdjudicationRegistry contract for the OriginAgent Evolution Chain.
// It provides a commit-reveal validator committee adjudication protocol for challenges.
//
// Flow: submitResponse → commitVerdict → revealVerdict → finalize (or expire)
//
// ChainMaker migration notes:
//   - Foundation-gated setQuorum
//   - Validator qualification via VerificationRegistry's allowlist
//   - Cross-contract call for basic adjudication integrity
//   - No token bond; contribution points used off-chain for accountability
package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"

	"chainmaker.org/chainmaker/contract-sdk-go/v2/sandbox"
	"chainmaker.org/chainmaker/contract-sdk-go/v2/sdk"
	protogo "chainmaker.org/chainmaker/contract-sdk-go/v2/pb/protogo"

	"originagent-evolution-chain/contracts-go/common"
)

const (
	FoundationOrgID    = "originagent-foundation"
	MinQuorum          = 2
	MaxQuorum          = 15
	DefaultQuorum      = 3
	ResponsePeriod     = 86400      // 1 day
	CommitPeriod       = 3 * 86400  // 3 days
	RevealPeriod       = 86400      // 1 day
)

// CommitmentRecord stores a validator's blinded verdict commitment.
type CommitmentRecord struct {
	ChallengeID    string `json:"challengeId"`
	Validator      string `json:"validator"`
	CommitmentHash string `json:"commitmentHash"`
	CommittedAt    int64  `json:"committedAt"`
	Revealed       bool   `json:"revealed"`
	Exists         bool   `json:"exists"`
}

// VerdictRecord stores a revealed verdict.
type VerdictRecord struct {
	ChallengeID          string `json:"challengeId"`
	Validator            string `json:"validator"`
	ClaimedUpheld        bool   `json:"claimedUpheld"`
	VerdictHash          string `json:"verdictHash"`
	MethodHash           string `json:"methodHash"`
	OperatorGroupHash    string `json:"operatorGroupHash"`
	RunnerFingerprintHash string `json:"runnerFingerprintHash"`
	RevealedAt           int64  `json:"revealedAt"`
	Exists               bool   `json:"exists"`
}

// AdjudicationState tracks the overall adjudication lifecycle.
type AdjudicationState struct {
	ChallengeID          string `json:"challengeId"`
	ResponseHash         string `json:"responseHash"`
	Respondent           string `json:"respondent"`
	ResponseSubmittedAt  int64  `json:"responseSubmittedAt"`
	ResponseCount        uint32 `json:"responseCount"`
	CommitmentCount      uint32 `json:"commitmentCount"`
	RevealCount          uint32 `json:"revealCount"`
	Finalized            bool   `json:"finalized"`
	Expired              bool   `json:"expired"`
	Outcome              bool   `json:"outcome"`
	EffectiveVerdictCount uint32 `json:"effectiveVerdictCount"`
	FinalReportHash      string `json:"finalReportHash"`
	ExpirationReportHash string `json:"expirationReportHash"`
	FinalizedAt          int64  `json:"finalizedAt"`
	ExpiredAt            int64  `json:"expiredAt"`
	Started              bool   `json:"started"`
}

type ChallengeAdjudicationRegistry struct {
	quorum uint64
}

func (c *ChallengeAdjudicationRegistry) InitContract() protogo.Response {
	c.quorum = DefaultQuorum
	return sdk.Success([]byte("ChallengeAdjudicationRegistry initialized"))
}

func (c *ChallengeAdjudicationRegistry) UpgradeContract() protogo.Response {
	return sdk.Success([]byte("ChallengeAdjudicationRegistry upgraded"))
}

func (c *ChallengeAdjudicationRegistry) InvokeContract(method string) protogo.Response {
	switch method {
	case "set_quorum":
		return c.setQuorum()
	case "get_quorum":
		return c.getQuorum()
	case "submit_response":
		return c.submitResponse()
	case "commit_verdict":
		return c.commitVerdict()
	case "reveal_verdict":
		return c.revealVerdict()
	case "finalize_challenge":
		return c.finalizeChallenge()
	case "expire_challenge":
		return c.expireChallenge()
	case "get_adjudication":
		return c.getAdjudication()
	case "get_commitment":
		return c.getCommitment()
	case "get_verdict":
		return c.getVerdict()
	default:
		return sdk.Error(fmt.Sprintf("unknown method: %s", method))
	}
}

// setQuorum sets the minimum number of validators for adjudication. Foundation-only.
// Args: quorum (uint64, 2-15)
func (c *ChallengeAdjudicationRegistry) setQuorum() protogo.Response {
	if err := requireFoundationOrg(); err != nil {
		return sdk.Error(err.Error())
	}

	args := sdk.Instance.GetArgs()
	quorumStr := string(args["quorum"])

	var quorum uint64
	if _, err := fmt.Sscanf(quorumStr, "%d", &quorum); err != nil {
		return sdk.Error(fmt.Sprintf("invalid quorum: %s", quorumStr))
	}
	if quorum < MinQuorum || quorum > MaxQuorum {
		return sdk.Error(fmt.Sprintf("quorum must be between %d and %d", MinQuorum, MaxQuorum))
	}

	old := c.quorum
	c.quorum = quorum

	// Persist quorum.
	sdk.Instance.PutStateFromKey(common.BuildKey(common.PrefixAdjudication, "CONFIG", "QUORUM"), quorumStr)

	sdk.Instance.EmitEvent("QuorumUpdated", []string{fmt.Sprintf("%d", old), fmt.Sprintf("%d", quorum)})
	return sdk.Success([]byte(quorumStr))
}

// getQuorum returns the current quorum value.
func (c *ChallengeAdjudicationRegistry) getQuorum() protogo.Response {
	return sdk.Success([]byte(fmt.Sprintf("%d", c.quorum)))
}

// submitResponse records the evidence reporter's response to a challenge.
// Args: challenge_id (64 hex), response_hash (64 hex)
func (c *ChallengeAdjudicationRegistry) submitResponse() protogo.Response {
	args := sdk.Instance.GetArgs()
	challengeID := string(args["challenge_id"])
	responseHash := string(args["response_hash"])

	if invalidHex64(challengeID, responseHash) {
		return sdk.Error("challenge_id and response_hash must each be 64 hex characters")
	}

	state, err := c.getState(challengeID)
	if err != nil {
		return sdk.Error(err.Error())
	}
	if state.Finalized {
		return sdk.Error("challenge already finalized")
	}
	if state.Expired {
		return sdk.Error("challenge already expired")
	}

	// Check we are in ResponseOpen phase.
	phase := c.currentPhase(challengeID, state)
	if phase != common.AdjudicationPhaseResponseOpen {
		return sdk.Error(fmt.Sprintf("invalid phase: %d", phase))
	}

	// Response duplicate check.
	rhKey := common.BuildKey(common.PrefixResponseHash, challengeID, responseHash)
	if existing, _ := sdk.Instance.GetStateFromKey(rhKey); len(existing) > 0 {
		return sdk.Error("duplicate response hash")
	}

	timestamp, _ := common.GetTxTimestamp()

	state.Started = true
	state.ResponseHash = responseHash
	state.ResponseSubmittedAt = timestamp
	state.ResponseCount++

	// Mark response hash as used.
	sdk.Instance.PutStateFromKey(rhKey, "1")
	c.saveState(challengeID, state)

	caller, _ := sdk.Instance.GetSenderAddr()
	sdk.Instance.EmitEvent("ChallengeResponseSubmitted", []string{
		challengeID, responseHash, caller, fmt.Sprintf("%d", timestamp),
	})
	return sdk.Success([]byte(challengeID))
}

// commitVerdict submits a blinded verdict commitment. Validator-only.
// Args: challenge_id (64 hex), commitment_hash (64 hex)
func (c *ChallengeAdjudicationRegistry) commitVerdict() protogo.Response {
	args := sdk.Instance.GetArgs()
	challengeID := string(args["challenge_id"])
	commitmentHash := string(args["commitment_hash"])

	if invalidHex64(challengeID, commitmentHash) {
		return sdk.Error("challenge_id and commitment_hash must each be 64 hex characters")
	}

	state, err := c.getState(challengeID)
	if err != nil {
		return sdk.Error(err.Error())
	}
	if state.Finalized || state.Expired {
		return sdk.Error("challenge already closed")
	}

	if c.currentPhase(challengeID, state) != common.AdjudicationPhaseCommitOpen {
		return sdk.Error("commit phase is not open")
	}

	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %w", err))
	}

	// Check for duplicate commitment.
	commitKey := common.BuildKey(common.PrefixCommitment, challengeID, caller)
	if existing, _ := sdk.Instance.GetStateFromKey(commitKey); len(existing) > 0 {
		var cr CommitmentRecord
		if json.Unmarshal([]byte(existing), &cr) == nil && cr.Exists {
			return sdk.Error("duplicate commitment")
		}
	}

	timestamp, _ := common.GetTxTimestamp()

	commit := CommitmentRecord{
		ChallengeID:    challengeID,
		Validator:      caller,
		CommitmentHash: commitmentHash,
		CommittedAt:    timestamp,
		Exists:         true,
	}
	commitData, _ := common.ToJSON(commit)
	sdk.Instance.PutStateFromKey(commitKey, string(commitData))

	// Add validator to challenge's validator list.
	valKey := common.BuildKey(common.PrefixChallengeValidator, challengeID)
	var validators []string
	if existing, _ := sdk.Instance.GetStateFromKey(valKey); len(existing) > 0 {
		json.Unmarshal([]byte(existing), &validators)
	}
	validators = append(validators, caller)
	valData, _ := common.ToJSON(validators)
	sdk.Instance.PutStateFromKey(valKey, string(valData))

	state.CommitmentCount++
	c.saveState(challengeID, state)

	sdk.Instance.EmitEvent("ValidatorVerdictCommitted", []string{challengeID, caller, commitmentHash})
	return sdk.Success([]byte(challengeID))
}

// revealVerdict reveals a previously committed verdict.
// Args: challenge_id (64 hex), claimed_upheld (bool), verdict_hash (64 hex),
//
//	method_hash (64 hex), salt (64 hex)
func (c *ChallengeAdjudicationRegistry) revealVerdict() protogo.Response {
	args := sdk.Instance.GetArgs()
	challengeID := string(args["challenge_id"])
	claimedUpheldStr := string(args["claimed_upheld"])
	verdictHash := string(args["verdict_hash"])
	methodHash := string(args["method_hash"])
	salt := string(args["salt"])

	if invalidHex64(challengeID, verdictHash, methodHash, salt) {
		return sdk.Error("challenge_id, verdict_hash, method_hash, and salt must each be 64 hex characters")
	}

	state, err := c.getState(challengeID)
	if err != nil {
		return sdk.Error(err.Error())
	}

	if c.currentPhase(challengeID, state) != common.AdjudicationPhaseRevealOpen {
		return sdk.Error("reveal phase is not open")
	}

	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %w", err))
	}

	// Read commitment.
	commitKey := common.BuildKey(common.PrefixCommitment, challengeID, caller)
	existing, err := sdk.Instance.GetStateFromKey(commitKey)
	if err != nil || len(existing) == 0 {
		return sdk.Error("commitment not found")
	}
	var commit CommitmentRecord
	if err := json.Unmarshal([]byte(existing), &commit); err != nil {
		return sdk.Error(fmt.Sprintf("failed to unmarshal commitment: %w", err))
	}
	if commit.Revealed {
		return sdk.Error("commitment already revealed")
	}

	claimedUpheld := claimedUpheldStr == "true"

	// Verify commitment hash.
	expected := computeCommitmentHash(challengeID, caller, claimedUpheld, verdictHash, methodHash, salt)
	if expected != commit.CommitmentHash {
		return sdk.Error("commitment mismatch")
	}

	// Mark revealed.
	commit.Revealed = true
	commitData, _ := common.ToJSON(commit)
	sdk.Instance.PutStateFromKey(commitKey, string(commitData))

	// Record verdict.
	timestamp, _ := common.GetTxTimestamp()
	verdict := VerdictRecord{
		ChallengeID:           challengeID,
		Validator:             caller,
		ClaimedUpheld:         claimedUpheld,
		VerdictHash:           verdictHash,
		MethodHash:            methodHash,
		OperatorGroupHash:     "",
		RunnerFingerprintHash: "",
		RevealedAt:            timestamp,
		Exists:                true,
	}
	verdictData, _ := common.ToJSON(verdict)
	verdictKey := common.BuildKey(common.PrefixVerdict, challengeID, caller)
	sdk.Instance.PutStateFromKey(verdictKey, string(verdictData))

	state.RevealCount++
	c.saveState(challengeID, state)

	sdk.Instance.EmitEvent("ValidatorVerdictRevealed", []string{
		challengeID, caller, fmt.Sprintf("%t", claimedUpheld), verdictHash, methodHash,
	})
	return sdk.Success([]byte(challengeID))
}

// finalizeChallenge finalizes adjudication when quorum is met.
// Args: challenge_id (64 hex), claimed_upheld (bool), final_report_hash (64 hex)
func (c *ChallengeAdjudicationRegistry) finalizeChallenge() protogo.Response {
	args := sdk.Instance.GetArgs()
	challengeID := string(args["challenge_id"])
	claimedUpheldStr := string(args["claimed_upheld"])
	finalReportHash := string(args["final_report_hash"])

	if invalidHex64(challengeID, finalReportHash) {
		return sdk.Error("challenge_id and final_report_hash must each be 64 hex characters")
	}

	state, err := c.getState(challengeID)
	if err != nil {
		return sdk.Error(err.Error())
	}
	if state.Finalized || state.Expired {
		return sdk.Error("challenge already closed")
	}

	claimedUpheld := claimedUpheldStr == "true"
	targetCount := c.effectiveVerdictCount(challengeID, claimedUpheld)

	if targetCount < uint32(c.quorum) {
		return sdk.Error(fmt.Sprintf("quorum not met: %d/%d", targetCount, c.quorum))
	}

	timestamp, _ := common.GetTxTimestamp()
	state.Finalized = true
	state.Outcome = claimedUpheld
	state.EffectiveVerdictCount = targetCount
	state.FinalReportHash = finalReportHash
	state.FinalizedAt = timestamp
	c.saveState(challengeID, state)

	caller, _ := sdk.Instance.GetSenderAddr()
	sdk.Instance.EmitEvent("ChallengeAdjudicationFinalized", []string{
		challengeID, fmt.Sprintf("%t", claimedUpheld), finalReportHash, caller, fmt.Sprintf("%d", targetCount),
	})
	return sdk.Success([]byte(challengeID))
}

// expireChallenge expires adjudication when quorum is not met after reveal period.
// Args: challenge_id (64 hex), expiration_report_hash (64 hex)
func (c *ChallengeAdjudicationRegistry) expireChallenge() protogo.Response {
	args := sdk.Instance.GetArgs()
	challengeID := string(args["challenge_id"])
	expirationReportHash := string(args["expiration_report_hash"])

	if invalidHex64(challengeID, expirationReportHash) {
		return sdk.Error("challenge_id and expiration_report_hash must each be 64 hex characters")
	}

	state, err := c.getState(challengeID)
	if err != nil {
		return sdk.Error(err.Error())
	}
	if state.Finalized || state.Expired {
		return sdk.Error("challenge already closed")
	}

	// Must be past reveal period.
	_, _, revealBy := c.deadlines(challengeID, state)
	timestamp, _ := common.GetTxTimestamp()
	if timestamp <= revealBy {
		return sdk.Error("reveal period has not ended")
	}

	// Either side must not have quorum.
	upheldCount := c.effectiveVerdictCount(challengeID, true)
	rejectedCount := c.effectiveVerdictCount(challengeID, false)
	if upheldCount >= uint32(c.quorum) || rejectedCount >= uint32(c.quorum) {
		return sdk.Error("quorum has been met; should finalize instead")
	}

	state.Expired = true
	state.ExpirationReportHash = expirationReportHash
	state.ExpiredAt = timestamp
	c.saveState(challengeID, state)

	caller, _ := sdk.Instance.GetSenderAddr()
	sdk.Instance.EmitEvent("ChallengeAdjudicationExpiredNoQuorum", []string{
		challengeID, expirationReportHash, caller,
	})
	return sdk.Success([]byte(challengeID))
}

// ---- Read methods ----

// getAdjudication reads adjudication state.
// Args: challenge_id (64 hex)
func (c *ChallengeAdjudicationRegistry) getAdjudication() protogo.Response {
	args := sdk.Instance.GetArgs()
	challengeID := string(args["challenge_id"])
	if len(challengeID) != 64 {
		return sdk.Error("challenge_id must be 64 hex characters")
	}

	state, err := c.getState(challengeID)
	if err != nil {
		// Return empty state.
		empty := AdjudicationState{ChallengeID: challengeID}
		data, _ := common.ToJSON(empty)
		return sdk.Success(data)
	}
	data, _ := common.ToJSON(state)
	return sdk.Success(data)
}

// getCommitment reads a validator's commitment.
// Args: challenge_id (64 hex), validator (address)
func (c *ChallengeAdjudicationRegistry) getCommitment() protogo.Response {
	args := sdk.Instance.GetArgs()
	challengeID := string(args["challenge_id"])
	validator := string(args["validator"])

	key := common.BuildKey(common.PrefixCommitment, challengeID, validator)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil || len(data) == 0 {
		return sdk.Success([]byte(`{"exists":false}`))
	}
	return sdk.Success([]byte(data))
}

// getVerdict reads a validator's revealed verdict.
// Args: challenge_id (64 hex), validator (address)
func (c *ChallengeAdjudicationRegistry) getVerdict() protogo.Response {
	args := sdk.Instance.GetArgs()
	challengeID := string(args["challenge_id"])
	validator := string(args["validator"])

	key := common.BuildKey(common.PrefixVerdict, challengeID, validator)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil || len(data) == 0 {
		return sdk.Success([]byte(`{"exists":false}`))
	}
	return sdk.Success([]byte(data))
}

// ---- Internal helpers ----

func (c *ChallengeAdjudicationRegistry) getState(challengeID string) (*AdjudicationState, error) {
	key := common.BuildKey(common.PrefixAdjudication, challengeID)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return nil, fmt.Errorf("failed to read adjudication: %w", err)
	}
	if len(data) == 0 {
		return &AdjudicationState{ChallengeID: challengeID}, nil
	}
	var state AdjudicationState
	if err := json.Unmarshal([]byte(data), &state); err != nil {
		return nil, fmt.Errorf("failed to unmarshal adjudication: %w", err)
	}
	return &state, nil
}

func (c *ChallengeAdjudicationRegistry) saveState(challengeID string, state *AdjudicationState) error {
	key := common.BuildKey(common.PrefixAdjudication, challengeID)
	data, err := common.ToJSON(state)
	if err != nil {
		return fmt.Errorf("failed to marshal: %w", err)
	}
	return sdk.Instance.PutStateFromKey(key, string(data))
}

func (c *ChallengeAdjudicationRegistry) currentPhase(challengeID string, state *AdjudicationState) uint8 {
	if state.Finalized {
		return common.AdjudicationPhaseFinalized
	}
	if state.Expired {
		return common.AdjudicationPhaseExpiredNoQuorum
	}

	responseBy, commitBy, revealBy := c.deadlines(challengeID, state)
	timestamp, _ := common.GetTxTimestamp()

	if timestamp <= responseBy && state.ResponseSubmittedAt == 0 {
		return common.AdjudicationPhaseResponseOpen
	}
	if timestamp <= commitBy {
		return common.AdjudicationPhaseCommitOpen
	}
	if timestamp <= revealBy {
		return common.AdjudicationPhaseRevealOpen
	}
	return common.AdjudicationPhaseUnknown
}

func (c *ChallengeAdjudicationRegistry) deadlines(challengeID string, state *AdjudicationState) (responseBy, commitBy, revealBy int64) {
	// Read challenge submission time from VerificationRegistry.
	challengeKey := common.BuildKey(common.PrefixChallenge, challengeID)
	data, err := sdk.Instance.GetStateFromKey(challengeKey)
	if err != nil || len(data) == 0 {
		return 0, 0, 0
	}
	var ch struct {
		SubmittedAt int64 `json:"submittedAt"`
	}
	json.Unmarshal([]byte(data), &ch)

	responseBy = ch.SubmittedAt + ResponsePeriod
	commitStart := state.ResponseSubmittedAt
	if commitStart == 0 {
		commitStart = responseBy
	}
	commitBy = commitStart + CommitPeriod
	revealBy = commitBy + RevealPeriod
	return
}

func (c *ChallengeAdjudicationRegistry) effectiveVerdictCount(challengeID string, claimedUpheld bool) uint32 {
	valKey := common.BuildKey(common.PrefixChallengeValidator, challengeID)
	existing, err := sdk.Instance.GetStateFromKey(valKey)
	if err != nil || len(existing) == 0 {
		return 0
	}
	var validators []string
	if err := json.Unmarshal([]byte(existing), &validators); err != nil {
		return 0
	}

	var count uint32
	for _, validator := range validators {
		verdictKey := common.BuildKey(common.PrefixVerdict, challengeID, validator)
		vd, err := sdk.Instance.GetStateFromKey(verdictKey)
		if err != nil || len(vd) == 0 {
			continue
		}
		var v VerdictRecord
		if err := json.Unmarshal([]byte(vd), &v); err != nil {
			continue
		}
		if v.Exists && v.ClaimedUpheld == claimedUpheld {
			count++
		}
	}
	return count
}

func computeCommitmentHash(challengeID, validator string, claimedUpheld bool, verdictHash, methodHash, salt string) string {
	input := fmt.Sprintf("%s%s%t%s%s%s", challengeID, validator, claimedUpheld, verdictHash, methodHash, salt)
	h := sha256.Sum256([]byte(input))
	return fmt.Sprintf("%x", h[:])
}

func invalidHex64(values ...string) bool {
	for _, v := range values {
		if len(v) != 64 {
			return true
		}
	}
	return false
}

func requireFoundationOrg() error {
	orgID, err := sdk.Instance.GetSenderOrgId()
	if err != nil {
		return fmt.Errorf("failed to get sender org: %w", err)
	}
	if orgID != FoundationOrgID {
		return fmt.Errorf("unauthorized org: %s (required: %s)", orgID, FoundationOrgID)
	}
	return nil
}

func main() {
	sandbox.Start(new(ChallengeAdjudicationRegistry))
}
