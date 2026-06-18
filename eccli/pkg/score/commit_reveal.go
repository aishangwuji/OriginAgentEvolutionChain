// Package score provides commit-reveal scoring for evolution modules.
// Matches the TypeScript SDK's score.ts exactly.
//
// Commit:  sha256(uint8(score) || bytes32(reason_hash) || bytes32(salt))
// Reveal: verify that the revealed values match the stored commitment.
package score

import (
	"crypto/sha256"
	"fmt"
)

// ComputeCommitHash computes the blinded score commitment hash.
// score must be an integer in [0, 100].
// reasonHash and salt must each be 64 hex characters.
func ComputeCommitHash(score uint8, reasonHash, salt string) (string, error) {
	if score > 100 {
		return "", fmt.Errorf("score must be an integer from 0 to 100")
	}
	if len(reasonHash) != 64 || len(salt) != 64 {
		return "", fmt.Errorf("reasonHash and salt must each be 64 hex characters")
	}

	input := append([]byte{score}, []byte(reasonHash)...)
	input = append(input, []byte(salt)...)
	h := sha256.Sum256(input)
	return fmt.Sprintf("%x", h[:]), nil
}

// VerifyReveal checks whether the revealed score, reasonHash, and salt
// match a previously stored commitHash.
func VerifyReveal(commitHash string, score uint8, reasonHash, salt string) (bool, error) {
	expected, err := ComputeCommitHash(score, reasonHash, salt)
	if err != nil {
		return false, err
	}
	// Normalize commitHash (strip 0x prefix).
	normalized := commitHash
	if len(normalized) >= 2 && normalized[:2] == "0x" {
		normalized = normalized[2:]
	}
	return normalized == expected, nil
}
