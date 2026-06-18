// Package reputation implements the AgentReputationRegistry contract for the OriginAgent Evolution Chain.
// It stores passive Passport-level reputation checkpoints (formerly testnet reputation).
//
// Reputation sources: challenge_upheld, challenge_rejected, verification_contribution, etc.
// Reputation is not transferable and not a token — it reflects contribution standing.
//
// ChainMaker migration notes:
//   - checkpoint_reputation is Foundation-gated
//   - mapping(bytes32 => ReputationCheckpoint) → PutState/GetState with REPUTATION prefix
package main

import (
	"fmt"

	"chainmaker.org/chainmaker/contract-sdk-go/v2/sdk"
	protogo "chainmaker.org/chainmaker/pb/protogo"

	"originagent-evolution-chain/contracts-go/common"
)

const FoundationOrgID = "originagent-foundation"

// ReputationCheckpoint stores a snapshot of a passport's standing.
type ReputationCheckpoint struct {
	PassportID    string `json:"passportId"`
	Owner         string `json:"owner"`
	Score         int32  `json:"score"`
	PositiveCount uint64 `json:"positiveCount"`
	NegativeCount uint64 `json:"negativeCount"`
	ReportHash    string `json:"reportHash"`
	CheckpointedAt int64 `json:"checkpointedAt"`
	Sequence      uint64 `json:"sequence"`
	Exists        bool   `json:"exists"`
}

type AgentReputationRegistry struct{}

func (c *AgentReputationRegistry) InitContract() protogo.Response {
	return sdk.Success([]byte("AgentReputationRegistry initialized"))
}

func (c *AgentReputationRegistry) UpgradeContract() protogo.Response {
	return sdk.Success([]byte("AgentReputationRegistry upgraded"))
}

func (c *AgentReputationRegistry) InvokeContract(method string) protogo.Response {
	switch method {
	case "checkpoint_reputation":
		return c.checkpointReputation()
	case "get_reputation":
		return c.getReputation()
	case "get_latest_checkpoint":
		return c.getLatestCheckpoint()
	default:
		return sdk.Error(fmt.Sprintf("unknown method: %s", method))
	}
}

// checkpointReputation records a new reputation checkpoint. Foundation-only.
// Args: passport_id (64 hex), owner (address), score (int32),
//
//	positive_count (uint64), negative_count (uint64), report_hash (64 hex)
func (c *AgentReputationRegistry) checkpointReputation() protogo.Response {
	if err := requireFoundationOrg(); err != nil {
		return sdk.Error(err.Error())
	}

	args := sdk.Instance.GetArgs()
	passportID := string(args["passport_id"])
	owner := string(args["owner"])
	scoreStr := string(args["score"])
	positiveCountStr := string(args["positive_count"])
	negativeCountStr := string(args["negative_count"])
	reportHash := string(args["report_hash"])

	if len(passportID) != 64 || len(reportHash) != 64 {
		return sdk.Error("passport_id and report_hash must each be 64 hex characters")
	}
	if owner == "" {
		return sdk.Error("owner is required")
	}

	var score int32
	var positiveCount, negativeCount uint64
	if _, err := fmt.Sscanf(scoreStr, "%d", &score); err != nil {
		return sdk.Error(fmt.Sprintf("invalid score: %s", scoreStr))
	}
	fmt.Sscanf(positiveCountStr, "%d", &positiveCount)
	fmt.Sscanf(negativeCountStr, "%d", &negativeCount)

	timestamp, err := sdk.Instance.GetTxTimeStamp()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get timestamp: %w", err))
	}

	// Get current sequence.
	seqKey := common.BuildKey(common.PrefixReputation, passportID, "SEQ")
	seqData, _ := sdk.Instance.GetStateFromKey(seqKey)
	var sequence uint64
	fmt.Sscanf(string(seqData), "%d", &sequence)
	sequence++

	checkpoint := ReputationCheckpoint{
		PassportID:     passportID,
		Owner:          owner,
		Score:          score,
		PositiveCount:  positiveCount,
		NegativeCount:  negativeCount,
		ReportHash:     reportHash,
		CheckpointedAt: timestamp,
		Sequence:       sequence,
		Exists:         true,
	}
	data, err := common.ToJSON(checkpoint)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %w", err))
	}

	// Store checkpoint by sequence.
	cpKey := common.BuildKey(common.PrefixReputation, passportID, fmt.Sprintf("%d", sequence))
	if err := sdk.Instance.PutStateFromKey(cpKey, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store checkpoint: %w", err))
	}

	// Update latest pointer and sequence.
	latestKey := common.BuildKey(common.PrefixReputation, passportID, "LATEST")
	sdk.Instance.PutStateFromKey(latestKey, string(data))
	sdk.Instance.PutStateFromKey(seqKey, fmt.Sprintf("%d", sequence))

	sdk.Instance.EmitEvent("AgentReputationCheckpointed", []string{
		passportID, owner, scoreStr, positiveCountStr, negativeCountStr, reportHash,
	})
	return sdk.Success([]byte(passportID))
}

// getReputation reads a specific checkpoint by passport and sequence.
// Args: passport_id (64 hex), sequence (uint64)
func (c *AgentReputationRegistry) getReputation() protogo.Response {
	args := sdk.Instance.GetArgs()
	passportID := string(args["passport_id"])
	sequenceStr := string(args["sequence"])

	if len(passportID) != 64 {
		return sdk.Error("passport_id must be 64 hex characters")
	}

	var sequence uint64
	fmt.Sscanf(sequenceStr, "%d", &sequence)

	var key string
	if sequence == 0 {
		// Latest.
		key = common.BuildKey(common.PrefixReputation, passportID, "LATEST")
	} else {
		key = common.BuildKey(common.PrefixReputation, passportID, fmt.Sprintf("%d", sequence))
	}

	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read reputation: %w", err))
	}
	if len(data) == 0 {
		return sdk.Success([]byte(`{"exists":false}`))
	}
	return sdk.Success([]byte(data))
}

// getLatestCheckpoint reads the latest reputation checkpoint for a passport.
// Args: passport_id (64 hex)
func (c *AgentReputationRegistry) getLatestCheckpoint() protogo.Response {
	args := sdk.Instance.GetArgs()
	passportID := string(args["passport_id"])
	if len(passportID) != 64 {
		return sdk.Error("passport_id must be 64 hex characters")
	}

	key := common.BuildKey(common.PrefixReputation, passportID, "LATEST")
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read: %w", err))
	}
	if len(data) == 0 {
		return sdk.Success([]byte(`{"exists":false}`))
	}
	return sdk.Success([]byte(data))
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
	sdk.Instance.Start(new(AgentReputationRegistry))
}
