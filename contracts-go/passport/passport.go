// Package passport implements the AgentPassportRegistry contract for the OriginAgent Evolution Chain.
// It records long-lived Agent identity anchors controlled by an owner address.
//
// passportId = sha256(owner || agentKeyHash || genesisHash)
//
// ChainMaker migration notes:
//   - No onlyOwner gate for registration (open to any caller)
//   - Agent key migration is owner-gated (caller must be the passport owner)
//   - mapping(bytes32 => AgentPassport) → PutState/GetState with PASSPORT prefix
package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"

	"chainmaker.org/chainmaker/contract-sdk-go/v2/sdk"
	protogo "chainmaker.org/chainmaker/pb/protogo"

	"originagent-evolution-chain/contracts-go/common"
)

// AgentPassport stores a long-lived Agent identity anchor.
type AgentPassport struct {
	PassportID      string `json:"passportId"`
	Owner           string `json:"owner"`
	AgentKeyHash    string `json:"agentKeyHash"`
	GenesisHash     string `json:"genesisHash"`
	MigrationHash   string `json:"migrationHash"`
	MigrationCount  uint64 `json:"migrationCount"`
	MetadataHash    string `json:"metadataHash"`
	Status          uint8  `json:"status"`
	RegisteredAt    int64  `json:"registeredAt"`
	Exists          bool   `json:"exists"`
}

// MigrationRecord stores a key migration event.
type MigrationRecord struct {
	PassportID      string `json:"passportId"`
	PreviousKeyHash string `json:"previousKeyHash"`
	NewKeyHash      string `json:"newKeyHash"`
	MigrationHash   string `json:"migrationHash"`
	Sequence        uint64 `json:"sequence"`
	MigratedAt      int64  `json:"migratedAt"`
}

type AgentPassportRegistry struct{}

func (c *AgentPassportRegistry) InitContract() protogo.Response {
	return sdk.Success([]byte("AgentPassportRegistry initialized"))
}

func (c *AgentPassportRegistry) UpgradeContract() protogo.Response {
	return sdk.Success([]byte("AgentPassportRegistry upgraded"))
}

func (c *AgentPassportRegistry) InvokeContract(method string) protogo.Response {
	switch method {
	case "register_passport":
		return c.registerPassport()
	case "get_passport":
		return c.getPassport()
	case "migrate_key":
		return c.migrateKey()
	case "get_passport_by_owner":
		return c.getPassportByOwner()
	default:
		return sdk.Error(fmt.Sprintf("unknown method: %s", method))
	}
}

// registerPassport registers a new Agent Passport.
// Args: owner (address), agent_key_hash (64 hex), genesis_nonce (64 hex),
//
//	metadata_hash (64 hex)
func (c *AgentPassportRegistry) registerPassport() protogo.Response {
	args := sdk.Instance.GetArgs()
	owner := string(args["owner"])
	agentKeyHash := string(args["agent_key_hash"])
	genesisNonce := string(args["genesis_nonce"])
	metadataHash := string(args["metadata_hash"])

	if owner == "" {
		return sdk.Error("owner is required")
	}
	if invalidHex64(agentKeyHash, genesisNonce) {
		return sdk.Error("agent_key_hash and genesis_nonce must each be 64 hex characters")
	}

	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %w", err))
	}
	if caller != owner {
		return sdk.Error("caller must be the passport owner")
	}

	// Compute genesisHash = sha256(agentKeyHash || genesisNonce).
	genesisHash := computeHash(agentKeyHash, genesisNonce)
	passportID := computePassportID(owner, agentKeyHash, genesisHash)

	// Check duplicate.
	passportKey := common.BuildKey(common.PrefixPassport, passportID)
	if existing, _ := sdk.Instance.GetStateFromKey(passportKey); len(existing) > 0 {
		var p AgentPassport
		if json.Unmarshal([]byte(existing), &p) == nil && p.Exists {
			return sdk.Error("passport already registered")
		}
	}

	timestamp, err := sdk.Instance.GetTxTimeStamp()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get timestamp: %w", err))
	}

	passport := AgentPassport{
		PassportID:    passportID,
		Owner:         owner,
		AgentKeyHash:  agentKeyHash,
		GenesisHash:   genesisHash,
		MigrationHash: "",
		MetadataHash:  metadataHash,
		Status:        common.PassportStatusActive,
		RegisteredAt:  timestamp,
		Exists:        true,
	}
	data, err := common.ToJSON(passport)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %w", err))
	}
	if err := sdk.Instance.PutStateFromKey(passportKey, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store passport: %w", err))
	}

	// Index by owner.
	ownerKey := common.BuildKey(common.PrefixPassport, "OWNER", owner)
	var ownerPassports []string
	if existing, _ := sdk.Instance.GetStateFromKey(ownerKey); len(existing) > 0 {
		json.Unmarshal([]byte(existing), &ownerPassports)
	}
	ownerPassports = append(ownerPassports, passportID)
	ownerData, _ := common.ToJSON(ownerPassports)
	sdk.Instance.PutStateFromKey(ownerKey, string(ownerData))

	sdk.Instance.EmitEvent("AgentPassportRegistered", []string{
		passportID, owner, agentKeyHash, genesisHash, metadataHash,
	})
	return sdk.Success([]byte(passportID))
}

// getPassport reads a passport by ID.
// Args: passport_id (64 hex)
func (c *AgentPassportRegistry) getPassport() protogo.Response {
	args := sdk.Instance.GetArgs()
	passportID := string(args["passport_id"])
	if len(passportID) != 64 {
		return sdk.Error("passport_id must be 64 hex characters")
	}

	key := common.BuildKey(common.PrefixPassport, passportID)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read passport: %w", err))
	}
	if len(data) == 0 {
		return sdk.Success([]byte(`{"exists":false}`))
	}
	return sdk.Success([]byte(data))
}

// getPassportByOwner reads all passports owned by an address.
// Args: owner (address)
func (c *AgentPassportRegistry) getPassportByOwner() protogo.Response {
	args := sdk.Instance.GetArgs()
	owner := string(args["owner"])
	if owner == "" {
		return sdk.Error("owner is required")
	}

	ownerKey := common.BuildKey(common.PrefixPassport, "OWNER", owner)
	data, err := sdk.Instance.GetStateFromKey(ownerKey)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read: %w", err))
	}
	if len(data) == 0 {
		return sdk.Success([]byte("[]"))
	}
	return sdk.Success([]byte(data))
}

// migrateKey migrates an Agent's key hash. Owner-only.
// Args: passport_id (64 hex), new_key_hash (64 hex)
func (c *AgentPassportRegistry) migrateKey() protogo.Response {
	args := sdk.Instance.GetArgs()
	passportID := string(args["passport_id"])
	newKeyHash := string(args["new_key_hash"])

	if invalidHex64(passportID, newKeyHash) {
		return sdk.Error("passport_id and new_key_hash must each be 64 hex characters")
	}

	key := common.BuildKey(common.PrefixPassport, passportID)
	existing, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read passport: %w", err))
	}
	if len(existing) == 0 {
		return sdk.Error("passport not found")
	}

	var passport AgentPassport
	if err := json.Unmarshal([]byte(existing), &passport); err != nil {
		return sdk.Error(fmt.Sprintf("failed to unmarshal: %w", err))
	}

	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %w", err))
	}
	if caller != passport.Owner {
		return sdk.Error("only the passport owner can migrate keys")
	}

	previousKeyHash := passport.AgentKeyHash

	// Compute new migration hash = sha256(passportID || previousKeyHash || newKeyHash || sequence).
	passport.MigrationCount++
	newSequence := passport.MigrationCount
	migrationInput := fmt.Sprintf("%s%s%s%d", passportID, previousKeyHash, newKeyHash, newSequence)
	migrationHash := computeHashStr(migrationInput)

	timestamp, err := sdk.Instance.GetTxTimeStamp()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get timestamp: %w", err))
	}

	passport.AgentKeyHash = newKeyHash
	passport.MigrationHash = migrationHash

	data, err := common.ToJSON(passport)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %w", err))
	}
	if err := sdk.Instance.PutStateFromKey(key, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to update passport: %w", err))
	}

	// Store migration record.
	migration := MigrationRecord{
		PassportID:      passportID,
		PreviousKeyHash: previousKeyHash,
		NewKeyHash:      newKeyHash,
		MigrationHash:   migrationHash,
		Sequence:        newSequence,
		MigratedAt:      timestamp,
	}
	migrationKey := common.BuildKey(common.PrefixPassport, "MIGRATION", passportID, fmt.Sprintf("%d", newSequence))
	migrationData, _ := common.ToJSON(migration)
	sdk.Instance.PutStateFromKey(migrationKey, string(migrationData))

	sdk.Instance.EmitEvent("AgentPassportMigrationRecorded", []string{
		passportID, previousKeyHash, newKeyHash, migrationHash, fmt.Sprintf("%d", newSequence),
	})
	return sdk.Success([]byte(passportID))
}

// ---- Utility functions ----

func computePassportID(owner, agentKeyHash, genesisHash string) string {
	input := fmt.Sprintf("%s%s%s", owner, agentKeyHash, genesisHash)
	return computeHashStr(input)
}

func computeHash(parts ...string) string {
	var input string
	for _, p := range parts {
		input += p
	}
	return computeHashStr(input)
}

func computeHashStr(input string) string {
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

func main() {
	sdk.Instance.Start(new(AgentPassportRegistry))
}
