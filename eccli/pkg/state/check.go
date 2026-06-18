// Package state provides chain state reading utilities for the CLI.
// It queries registration contracts and returns parsed state.
package state

import (
	"encoding/json"
	"fmt"

	sdk "chainmaker.org/chainmaker/sdk-go/v2"
	"chainmaker.org/chainmaker/pb-go/v2/common"
)

// ChainState represents aggregated chain state read results.
type ChainState struct {
	Module     *ModuleState     `json:"module,omitempty"`
	Evidence   *EvidenceState   `json:"evidence,omitempty"`
	Challenge  *ChallengeState  `json:"challenge,omitempty"`
	Passport   *PassportState   `json:"passport,omitempty"`
	Credit     *CreditState     `json:"credit,omitempty"`
}

// ModuleState holds a module record from the chain.
type ModuleState struct {
	ModuleDigest string `json:"moduleDigest"`
	ModuleIDHash string `json:"moduleIdHash"`
	ModuleType   uint8  `json:"moduleType"`
	VersionHash  string `json:"versionHash"`
	StorageURI   string `json:"storageUri"`
	Submitter    string `json:"submitter"`
	Status       uint8  `json:"status"`
}

// EvidenceState holds an evidence record.
type EvidenceState struct {
	EvidenceID string `json:"evidenceId"`
	Status     uint8  `json:"status"`
	Reporter   string `json:"reporter"`
}

// ChallengeState holds a challenge record.
type ChallengeState struct {
	ChallengeID string `json:"challengeId"`
	Status      uint8  `json:"status"`
	Challenger  string `json:"challenger"`
}

// PassportState holds an agent passport.
type PassportState struct {
	PassportID string `json:"passportId"`
	Owner      string `json:"owner"`
	Status     uint8  `json:"status"`
}

// CreditState holds a credit account.
type CreditState struct {
	PassportID string `json:"passportId"`
	Balance    uint64 `json:"balance"`
	Granted    uint64 `json:"granted"`
	Consumed   uint64 `json:"consumed"`
}

// CheckState reads all specified chain state in one pass.
func CheckState(client *sdk.ChainClient, moduleDigest, evidenceID, challengeID, passportID string) (*ChainState, error) {
	state := &ChainState{}

	if moduleDigest != "" {
		result, err := query(client, "module", "get_module", moduleParams(moduleDigest))
		if err != nil {
			return state, fmt.Errorf("module query failed: %w", err)
		}
		var ms ModuleState
		if err := json.Unmarshal([]byte(result), &ms); err == nil {
			state.Module = &ms
		}
	}

	if evidenceID != "" {
		result, err := query(client, "verification", "get_evidence", simpleParam("evidence_id", evidenceID))
		if err != nil {
			return state, fmt.Errorf("evidence query failed: %w", err)
		}
		var es EvidenceState
		if err := json.Unmarshal([]byte(result), &es); err == nil {
			state.Evidence = &es
		}
	}

	if challengeID != "" {
		result, err := query(client, "verification", "get_challenge", simpleParam("challenge_id", challengeID))
		if err != nil {
			return state, fmt.Errorf("challenge query failed: %w", err)
		}
		var cs ChallengeState
		if err := json.Unmarshal([]byte(result), &cs); err == nil {
			state.Challenge = &cs
		}
	}

	if passportID != "" {
		result, err := query(client, "passport", "get_passport", simpleParam("passport_id", passportID))
		if err != nil {
			return state, fmt.Errorf("passport query failed: %w", err)
		}
		var ps PassportState
		if err := json.Unmarshal([]byte(result), &ps); err == nil {
			state.Passport = &ps
		}

		creditResult, err := query(client, "credit", "get_balance", simpleParam("passport_id", passportID))
		if err == nil {
			var cr CreditState
			if json.Unmarshal([]byte(creditResult), &cr) == nil {
				state.Credit = &cr
			}
		}
	}

	return state, nil
}

func query(client *sdk.ChainClient, contract, method string, params map[string]string) (string, error) {
	var kvs []*common.KeyValuePair
	for k, v := range params {
		kvs = append(kvs, &common.KeyValuePair{Key: k, Value: []byte(v)})
	}
	resp, err := client.QueryContract(contract, method, kvs, -1)
	if err != nil {
		return "", err
	}
	return string(resp.ContractResult.Result), nil
}

func moduleParams(digest string) map[string]string {
	return map[string]string{"module_digest": digest}
}

func simpleParam(key, value string) map[string]string {
	return map[string]string{key: value}
}
