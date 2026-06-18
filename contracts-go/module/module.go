// Package module implements the ModuleRegistry contract for the OriginAgent Evolution Chain.
// It records module submissions with digests, type, version, and storage URIs.
//
// ChainMaker migration notes:
//   - Anyone can submit (no onlyOwner gate), matching the original Solidity
//   - mapping(bytes32 => ModuleRecord) → PutState/GetState with MODULE prefix
package main

import (
	"encoding/json"
	"fmt"

	"chainmaker.org/chainmaker/contract-sdk-go/v2/sandbox"
	"chainmaker.org/chainmaker/contract-sdk-go/v2/sdk"
	protogo "chainmaker.org/chainmaker/contract-sdk-go/v2/pb/protogo"

	"originagent-evolution-chain/contracts-go/common"
)

// ModuleRecord stores a submitted module's metadata.
type ModuleRecord struct {
	ModuleDigest  string `json:"moduleDigest"`
	ModuleIDHash  string `json:"moduleIdHash"`
	ModuleType    uint8  `json:"moduleType"`
	VersionHash   string `json:"versionHash"`
	StorageURI    string `json:"storageUri"`
	Submitter     string `json:"submitter"`
	Status        uint8  `json:"status"`
	SubmittedAt   int64  `json:"submittedAt"`
}

type ModuleRegistry struct{}

func (c *ModuleRegistry) InitContract() protogo.Response {
	return sdk.Success([]byte("ModuleRegistry initialized"))
}

func (c *ModuleRegistry) UpgradeContract() protogo.Response {
	return sdk.Success([]byte("ModuleRegistry upgraded"))
}

func (c *ModuleRegistry) InvokeContract(method string) protogo.Response {
	switch method {
	case "submit_module":
		return c.submitModule()
	case "get_module":
		return c.getModule()
	case "module_exists":
		return c.moduleExists()
	default:
		return sdk.Error(fmt.Sprintf("unknown method: %s", method))
	}
}

// submitModule records a new module submission. Open to any caller.
// Args: module_digest (64 hex), module_id_hash (64 hex), module_type (uint8),
//
//	version_hash (64 hex), storage_uri (string)
func (c *ModuleRegistry) submitModule() protogo.Response {
	args := sdk.Instance.GetArgs()
	moduleDigest := string(args["module_digest"])
	moduleIDHash := string(args["module_id_hash"])
	moduleTypeStr := string(args["module_type"])
	versionHash := string(args["version_hash"])
	storageURI := string(args["storage_uri"])

	if len(moduleDigest) != 64 || len(moduleIDHash) != 64 || len(versionHash) != 64 {
		return sdk.Error("module_digest, module_id_hash, and version_hash must each be 64 hex characters")
	}
	if storageURI == "" {
		return sdk.Error("storage_uri is required")
	}

	var moduleType uint8
	if _, err := fmt.Sscanf(moduleTypeStr, "%d", &moduleType); err != nil {
		return sdk.Error(fmt.Sprintf("invalid module_type: %s", moduleTypeStr))
	}
	if moduleType == common.ModuleTypeUnknown || moduleType > common.ModuleTypeTool {
		return sdk.Error(fmt.Sprintf("invalid module type: %d", moduleType))
	}

	// Check for duplicate.
	key := common.BuildKey(common.PrefixModule, moduleDigest)
	existing, _ := sdk.Instance.GetStateFromKey(key)
	if len(existing) > 0 {
		var rec ModuleRecord
		if err := json.Unmarshal([]byte(existing), &rec); err == nil && rec.Status != common.ModuleStatusNone {
			return sdk.Error("module already submitted")
		}
	}

	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %v", err))
	}

	timestamp, err := common.GetTxTimestamp()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get timestamp: %v", err))
	}

	record := ModuleRecord{
		ModuleDigest:  moduleDigest,
		ModuleIDHash:  moduleIDHash,
		ModuleType:    moduleType,
		VersionHash:   versionHash,
		StorageURI:    storageURI,
		Submitter:     caller,
		Status:        common.ModuleStatusSubmitted,
		SubmittedAt:   timestamp,
	}
	data, err := common.ToJSON(record)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal record: %v", err))
	}

	if err := sdk.Instance.PutStateFromKey(key, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store module: %v", err))
	}

	sdk.Instance.EmitEvent("ModuleSubmitted", []string{
		moduleDigest, moduleIDHash, moduleTypeStr, versionHash, storageURI, caller,
	})
	return sdk.Success([]byte(moduleDigest))
}

// getModule reads a module record by digest.
// Args: module_digest (64 hex)
func (c *ModuleRegistry) getModule() protogo.Response {
	args := sdk.Instance.GetArgs()
	moduleDigest := string(args["module_digest"])
	if len(moduleDigest) != 64 {
		return sdk.Error("module_digest must be 64 hex characters")
	}

	key := common.BuildKey(common.PrefixModule, moduleDigest)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read module: %v", err))
	}
	if len(data) == 0 {
		return sdk.Success([]byte(`{"status":0}`))
	}
	return sdk.Success([]byte(data))
}

// moduleExists checks whether a module digest has been submitted.
// Args: module_digest (64 hex)
func (c *ModuleRegistry) moduleExists() protogo.Response {
	args := sdk.Instance.GetArgs()
	moduleDigest := string(args["module_digest"])
	if len(moduleDigest) != 64 {
		return sdk.Error("module_digest must be 64 hex characters")
	}

	key := common.BuildKey(common.PrefixModule, moduleDigest)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read: %v", err))
	}

	if len(data) == 0 {
		return sdk.Success([]byte("false"))
	}
	var rec ModuleRecord
	if err := json.Unmarshal([]byte(data), &rec); err != nil {
		return sdk.Success([]byte("false"))
	}
	if rec.Status == common.ModuleStatusNone {
		return sdk.Success([]byte("false"))
	}
	return sdk.Success([]byte("true"))
}

func main() {
	sandbox.Start(new(ModuleRegistry))
}
