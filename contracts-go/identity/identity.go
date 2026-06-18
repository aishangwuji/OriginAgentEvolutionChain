// Package identity implements the IdentityRegistry contract for the OriginAgent Evolution Chain.
// It records address-based roles (Developer, Validator, Operator) on the consortium chain.
//
// ChainMaker migration notes:
//   - Solidity onlyOwner → caller org membership check (Foundation organization)
//   - mapping(address => IdentityRecord) → PutState/GetState with IDENTITY prefix
//   - No token, stake, or economic operations
package main

import (
	"encoding/json"
	"fmt"

	"chainmaker.org/chainmaker/contract-sdk-go/v2/sdk"
	protogo "chainmaker.org/chainmaker/pb/protogo"

	"originagent-evolution-chain/contracts-go/common"
)

// IdentityRecord stores the on-chain role and metadata for an address.
type IdentityRecord struct {
	Address      string `json:"address"`
	Role         uint8  `json:"role"`
	MetadataHash string `json:"metadataHash"`
	Exists       bool   `json:"exists"`
}

// FoundationOrgID is the organization ID authorized for admin operations.
// In production, this should be read from chain config or passed as init parameter.
const FoundationOrgID = "originagent-foundation"

type IdentityRegistry struct{}

func (c *IdentityRegistry) InitContract() protogo.Response {
	return sdk.Success([]byte("IdentityRegistry initialized"))
}

func (c *IdentityRegistry) UpgradeContract() protogo.Response {
	return sdk.Success([]byte("IdentityRegistry upgraded"))
}

func (c *IdentityRegistry) InvokeContract(method string) protogo.Response {
	switch method {
	case "register_identity":
		return c.registerIdentity()
	case "get_identity":
		return c.getIdentity()
	case "set_role":
		return c.setRole()
	default:
		return sdk.Error(fmt.Sprintf("unknown method: %s", method))
	}
}

// registerIdentity registers a new identity record for the caller.
// Args: role (uint8), metadataHash (string 64 hex)
func (c *IdentityRegistry) registerIdentity() protogo.Response {
	args := sdk.Instance.GetArgs()
	roleStr := string(args["role"])
	metadataHash := string(args["metadata_hash"])

	if len(metadataHash) != 64 {
		return sdk.Error("metadata_hash must be 64 hex characters")
	}

	var role uint8
	if _, err := fmt.Sscanf(roleStr, "%d", &role); err != nil {
		return sdk.Error(fmt.Sprintf("invalid role: %s", roleStr))
	}
	if role < common.RoleDeveloper || role > common.RoleOperator {
		return sdk.Error(fmt.Sprintf("invalid role value: %d", role))
	}

	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %v", err))
	}

	// Check for duplicate.
	key := common.BuildKey(common.PrefixIdentity, caller)
	existing, _ := sdk.Instance.GetStateFromKey(key)
	if len(existing) > 0 {
		var rec IdentityRecord
		if err := json.Unmarshal([]byte(existing), &rec); err == nil && rec.Exists {
			return sdk.Error("identity already registered")
		}
	}

	record := IdentityRecord{
		Address:      caller,
		Role:         role,
		MetadataHash: metadataHash,
		Exists:       true,
	}
	data, err := common.ToJSON(record)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal record: %v", err))
	}

	if err := sdk.Instance.PutStateFromKey(key, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store identity: %v", err))
	}

	sdk.Instance.EmitEvent("IdentityRegistered", []string{caller, roleStr, metadataHash})
	return sdk.Success([]byte(caller))
}

// getIdentity reads an identity record by address.
// Args: address (string)
func (c *IdentityRegistry) getIdentity() protogo.Response {
	args := sdk.Instance.GetArgs()
	address := string(args["address"])
	if address == "" {
		return sdk.Error("address is required")
	}

	key := common.BuildKey(common.PrefixIdentity, address)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read identity: %v", err))
	}
	if len(data) == 0 {
		return sdk.Success([]byte(`{"exists":false}`))
	}

	return sdk.Success([]byte(data))
}

// setRole updates the role for an existing identity. Foundation-only.
// Args: address (string), role (uint8)
func (c *IdentityRegistry) setRole() protogo.Response {
	// Foundation org check — replaces Solidity onlyOwner.
	if err := requireFoundationOrg(); err != nil {
		return sdk.Error(err.Error())
	}

	args := sdk.Instance.GetArgs()
	address := string(args["address"])
	roleStr := string(args["role"])

	if address == "" {
		return sdk.Error("address is required")
	}
	var role uint8
	if _, err := fmt.Sscanf(roleStr, "%d", &role); err != nil {
		return sdk.Error(fmt.Sprintf("invalid role: %s", roleStr))
	}
	if role < common.RoleDeveloper || role > common.RoleOperator {
		return sdk.Error(fmt.Sprintf("invalid role value: %d", role))
	}

	key := common.BuildKey(common.PrefixIdentity, address)
	existing, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read identity: %v", err))
	}
	if len(existing) == 0 {
		return sdk.Error("identity not found")
	}

	var rec IdentityRecord
	if err := json.Unmarshal([]byte(existing), &rec); err != nil {
		return sdk.Error(fmt.Sprintf("failed to unmarshal: %v", err))
	}

	rec.Role = role
	data, err := common.ToJSON(rec)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %v", err))
	}

	if err := sdk.Instance.PutStateFromKey(key, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to update identity: %v", err))
	}

	sdk.Instance.EmitEvent("IdentityRoleSet", []string{address, roleStr})
	return sdk.Success([]byte(address))
}

// requireFoundationOrg checks that the caller belongs to the Foundation organization.
func requireFoundationOrg() error {
	orgID, err := sdk.Instance.GetSenderOrgId()
	if err != nil {
		return fmt.Errorf("failed to get sender org: %v", err)
	}
	if orgID != FoundationOrgID {
		return fmt.Errorf("unauthorized org: %s (required: %s)", orgID, FoundationOrgID)
	}
	return nil
}

func main() {
	sdk.Instance.Start(new(IdentityRegistry))
}
