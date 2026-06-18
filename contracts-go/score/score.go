// Package score implements the ScoreCommitReveal contract for the OriginAgent Evolution Chain.
// It provides blind (commit-reveal) scoring for evolution modules.
//
// Commit phase: submit hash(uint8(score) || bytes32(reason_hash) || bytes32(salt))
// Reveal phase: reveal score, reason_hash, salt → contract verifies hash match
//
// ChainMaker migration notes:
//   - No onlyOwner gate — open to any caller (same as original)
//   - mapping(bytes32 => CommitRecord) → PutState/GetState with SCORE_COMMIT/SCORE_REVEAL prefixes
//   - commit_hash = keccak256(score || reason_hash || salt) → SHA-256 of concatenation
package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strconv"

	"chainmaker.org/chainmaker/contract-sdk-go/v2/sandbox"
	"chainmaker.org/chainmaker/contract-sdk-go/v2/sdk"
	protogo "chainmaker.org/chainmaker/contract-sdk-go/v2/pb/protogo"

	"originagent-evolution-chain/contracts-go/common"
)

// CommitRecord stores the blinded score commitment.
type CommitRecord struct {
	ModuleDigest   string `json:"moduleDigest"`
	Scorer         string `json:"scorer"`
	CommitHash     string `json:"commitHash"`
	CommittedAt    int64  `json:"committedAt"`
	Exists         bool   `json:"exists"`
}

// RevealRecord stores the revealed score.
type RevealRecord struct {
	ModuleDigest string `json:"moduleDigest"`
	Scorer       string `json:"scorer"`
	Score        uint8  `json:"score"`
	ReasonHash   string `json:"reasonHash"`
	Salt         string `json:"salt"`
	RevealedAt   int64  `json:"revealedAt"`
	Exists       bool   `json:"exists"`
}

type ScoreCommitReveal struct{}

func (c *ScoreCommitReveal) InitContract() protogo.Response {
	return sdk.Success([]byte("ScoreCommitReveal initialized"))
}

func (c *ScoreCommitReveal) UpgradeContract() protogo.Response {
	return sdk.Success([]byte("ScoreCommitReveal upgraded"))
}

func (c *ScoreCommitReveal) InvokeContract(method string) protogo.Response {
	switch method {
	case "commit_score":
		return c.commitScore()
	case "reveal_score":
		return c.revealScore()
	case "get_commit":
		return c.getCommit()
	case "get_reveal":
		return c.getReveal()
	default:
		return sdk.Error(fmt.Sprintf("unknown method: %s", method))
	}
}

// commitScore submits a blinded score commitment.
// Args: module_digest (64 hex), commit_hash (64 hex)
// commit_hash = sha256(score_byte || reason_hash_bytes || salt_bytes)
func (c *ScoreCommitReveal) commitScore() protogo.Response {
	args := sdk.Instance.GetArgs()
	moduleDigest := string(args["module_digest"])
	commitHash := string(args["commit_hash"])

	if len(moduleDigest) != 64 || len(commitHash) != 64 {
		return sdk.Error("module_digest and commit_hash must each be 64 hex characters")
	}

	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %v", err))
	}

	// Check for duplicate commit by same scorer for same module.
	commitKey := common.BuildKey(common.PrefixScoreCommit, moduleDigest, caller)
	existing, _ := sdk.Instance.GetStateFromKey(commitKey)
	if len(existing) > 0 {
		var rec CommitRecord
		if err := json.Unmarshal([]byte(existing), &rec); err == nil && rec.Exists {
			return sdk.Error("score already committed for this module by this scorer")
		}
	}

	timestamp, err := common.GetTxTimestamp()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get timestamp: %v", err))
	}

	record := CommitRecord{
		ModuleDigest: moduleDigest,
		Scorer:       caller,
		CommitHash:   commitHash,
		CommittedAt:  timestamp,
		Exists:       true,
	}
	data, err := common.ToJSON(record)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %v", err))
	}

	if err := sdk.Instance.PutStateFromKey(commitKey, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store commit: %v", err))
	}

	sdk.Instance.EmitEvent("ScoreCommitted", []string{moduleDigest, caller, commitHash})
	return sdk.Success([]byte(commitKey))
}

// revealScore reveals a previously committed score.
// Args: module_digest (64 hex), score (uint8 0-100), reason_hash (64 hex), salt (64 hex)
// Contract verifies: sha256(score_byte || reason_hash_bytes || salt_bytes) == stored commit_hash
func (c *ScoreCommitReveal) revealScore() protogo.Response {
	args := sdk.Instance.GetArgs()
	moduleDigest := string(args["module_digest"])
	scoreStr := string(args["score"])
	reasonHash := string(args["reason_hash"])
	salt := string(args["salt"])

	if len(moduleDigest) != 64 || len(reasonHash) != 64 || len(salt) != 64 {
		return sdk.Error("module_digest, reason_hash, and salt must each be 64 hex characters")
	}

	score, err := strconv.Atoi(scoreStr)
	if err != nil || score < 0 || score > 100 {
		return sdk.Error("score must be an integer in [0, 100]")
	}

	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %v", err))
	}

	// Read the commit record.
	commitKey := common.BuildKey(common.PrefixScoreCommit, moduleDigest, caller)
	existing, err := sdk.Instance.GetStateFromKey(commitKey)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read commit: %v", err))
	}
	if len(existing) == 0 {
		return sdk.Error("no commit found for this module and scorer")
	}

	var commitRecord CommitRecord
	if err := json.Unmarshal([]byte(existing), &commitRecord); err != nil {
		return sdk.Error(fmt.Sprintf("failed to unmarshal commit: %v", err))
	}

	// Verify the commitment hash.
	expected := fmt.Sprintf("%x", computeCommitHash(uint8(score), reasonHash, salt))
	if expected != commitRecord.CommitHash {
		return sdk.Error(fmt.Sprintf("commitment mismatch: expected %s, got %s", expected, commitRecord.CommitHash))
	}

	// Check for duplicate reveal.
	revealKey := common.BuildKey(common.PrefixScoreReveal, moduleDigest, caller)
	revealExisting, _ := sdk.Instance.GetStateFromKey(revealKey)
	if len(revealExisting) > 0 {
		var rec RevealRecord
		if err := json.Unmarshal([]byte(revealExisting), &rec); err == nil && rec.Exists {
			return sdk.Error("score already revealed")
		}
	}

	timestamp, err := common.GetTxTimestamp()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get timestamp: %v", err))
	}

	revealRecord := RevealRecord{
		ModuleDigest: moduleDigest,
		Scorer:       caller,
		Score:        uint8(score),
		ReasonHash:   reasonHash,
		Salt:         salt,
		RevealedAt:   timestamp,
		Exists:       true,
	}
	revealData, err := common.ToJSON(revealRecord)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal reveal: %v", err))
	}

	if err := sdk.Instance.PutStateFromKey(revealKey, string(revealData)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store reveal: %v", err))
	}

	sdk.Instance.EmitEvent("ScoreRevealed", []string{moduleDigest, caller, scoreStr, reasonHash})
	return sdk.Success([]byte(revealKey))
}

// getCommit reads a score commitment.
// Args: module_digest (64 hex), scorer (address)
func (c *ScoreCommitReveal) getCommit() protogo.Response {
	args := sdk.Instance.GetArgs()
	moduleDigest := string(args["module_digest"])
	scorer := string(args["scorer"])

	key := common.BuildKey(common.PrefixScoreCommit, moduleDigest, scorer)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read: %v", err))
	}
	if len(data) == 0 {
		return sdk.Success([]byte(`{"exists":false}`))
	}
	return sdk.Success([]byte(data))
}

// getReveal reads a revealed score.
// Args: module_digest (64 hex), scorer (address)
func (c *ScoreCommitReveal) getReveal() protogo.Response {
	args := sdk.Instance.GetArgs()
	moduleDigest := string(args["module_digest"])
	scorer := string(args["scorer"])

	key := common.BuildKey(common.PrefixScoreReveal, moduleDigest, scorer)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read: %v", err))
	}
	if len(data) == 0 {
		return sdk.Success([]byte(`{"exists":false}`))
	}
	return sdk.Success([]byte(data))
}

// computeCommitHash computes sha256(score_byte || reason_hash_bytes || salt_bytes).
func computeCommitHash(score uint8, reasonHash, salt string) []byte {
	input := append([]byte{score}, []byte(reasonHash)...)
	input = append(input, []byte(salt)...)
	hash := sha256.Sum256(input)
	return hash[:]
}

func main() {
	sandbox.Start(new(ScoreCommitReveal))
}
