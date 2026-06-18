// Package unitkind implements the EvolutionUnitKindRegistry contract for the OriginAgent Evolution Chain.
// It records open Agent capability type definitions (e.g., tool@1, skill@1).
//
// Each unit kind defines schema, permission, verification, sandbox, install,
// rollback, and deprecation semantics. tool@1 is the first canonical kind.
//
// ChainMaker migration notes:
//   - propose/review/set-status are Foundation-gated
//   - mapping(bytes32 => UnitKind) → PutState/GetState with UNITKIND prefix
package main

import (
	"encoding/json"
	"fmt"

	"chainmaker.org/chainmaker/contract-sdk-go/v2/sandbox"
	"chainmaker.org/chainmaker/contract-sdk-go/v2/sdk"
	protogo "chainmaker.org/chainmaker/contract-sdk-go/v2/pb/protogo"

	"originagent-evolution-chain/contracts-go/common"
)

const FoundationOrgID = "originagent-foundation"

// UnitKind stores an evolution unit capability type definition.
type UnitKind struct {
	KindID       string `json:"kindId"`
	Version      uint64 `json:"version"`
	DisplayName  string `json:"displayName"`
	Submitter    string `json:"submitter"`
	Status       uint8  `json:"status"`
	ReviewHash   string `json:"reviewHash"`
	Reviewer     string `json:"reviewer"`
	ProposedAt   int64  `json:"proposedAt"`
	ReviewedAt   int64  `json:"reviewedAt"`
	Exists       bool   `json:"exists"`
}

type EvolutionUnitKindRegistry struct{}

func (c *EvolutionUnitKindRegistry) InitContract() protogo.Response {
	return sdk.Success([]byte("EvolutionUnitKindRegistry initialized"))
}

func (c *EvolutionUnitKindRegistry) UpgradeContract() protogo.Response {
	return sdk.Success([]byte("EvolutionUnitKindRegistry upgraded"))
}

func (c *EvolutionUnitKindRegistry) InvokeContract(method string) protogo.Response {
	switch method {
	case "propose_kind":
		return c.proposeKind()
	case "review_kind":
		return c.reviewKind()
	case "set_kind_status":
		return c.setKindStatus()
	case "get_kind":
		return c.getKind()
	default:
		return sdk.Error(fmt.Sprintf("unknown method: %s", method))
	}
}

// proposeKind proposes a new evolution unit kind. Foundation-only.
// Args: kind_id (string), version (uint64), display_name (string),
//
//	submitter (address)
func (c *EvolutionUnitKindRegistry) proposeKind() protogo.Response {
	if err := requireFoundationOrg(); err != nil {
		return sdk.Error(err.Error())
	}

	args := sdk.Instance.GetArgs()
	kindID := string(args["kind_id"])
	versionStr := string(args["version"])
	displayName := string(args["display_name"])
	submitter := string(args["submitter"])

	if kindID == "" || displayName == "" || submitter == "" {
		return sdk.Error("kind_id, display_name, and submitter are required")
	}

	var version uint64
	if _, err := fmt.Sscanf(versionStr, "%d", &version); err != nil || version == 0 {
		return sdk.Error("version must be a positive integer")
	}

	// Check duplicate.
	key := common.BuildKey(common.PrefixUnitKind, kindID, versionStr)
	if existing, _ := sdk.Instance.GetStateFromKey(key); len(existing) > 0 {
		var k UnitKind
		if json.Unmarshal([]byte(existing), &k) == nil && k.Exists {
			return sdk.Error("unit kind already proposed")
		}
	}

	timestamp, err := common.GetTxTimestamp()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get timestamp: %w", err))
	}

	kind := UnitKind{
		KindID:      kindID,
		Version:     version,
		DisplayName: displayName,
		Submitter:   submitter,
		Status:      common.UnitKindStatusProposed,
		ProposedAt:  timestamp,
		Exists:      true,
	}
	data, err := common.ToJSON(kind)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %w", err))
	}
	if err := sdk.Instance.PutStateFromKey(key, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store unit kind: %w", err))
	}

	sdk.Instance.EmitEvent("UnitKindProposed", []string{kindID, versionStr, displayName, submitter})
	return sdk.Success([]byte(key))
}

// reviewKind records a review for a proposed unit kind. Foundation-only.
// Args: kind_id (string), version (uint64), reviewer (address),
//
//	recommended_status (uint8), review_hash (64 hex)
func (c *EvolutionUnitKindRegistry) reviewKind() protogo.Response {
	if err := requireFoundationOrg(); err != nil {
		return sdk.Error(err.Error())
	}

	args := sdk.Instance.GetArgs()
	kindID := string(args["kind_id"])
	versionStr := string(args["version"])
	reviewer := string(args["reviewer"])
	recommendedStatusStr := string(args["recommended_status"])
	reviewHash := string(args["review_hash"])

	if kindID == "" || reviewer == "" || len(reviewHash) != 64 {
		return sdk.Error("kind_id, reviewer, and review_hash (64 hex) are required")
	}

	var version uint64
	var recommendedStatus uint8
	if _, err := fmt.Sscanf(versionStr, "%d", &version); err != nil {
		return sdk.Error(fmt.Sprintf("invalid version: %s", versionStr))
	}
	fmt.Sscanf(recommendedStatusStr, "%d", &recommendedStatus)

	key := common.BuildKey(common.PrefixUnitKind, kindID, versionStr)
	existing, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read unit kind: %w", err))
	}
	if len(existing) == 0 {
		return sdk.Error("unit kind not found")
	}

	var kind UnitKind
	if err := json.Unmarshal([]byte(existing), &kind); err != nil {
		return sdk.Error(fmt.Sprintf("failed to unmarshal: %w", err))
	}

	timestamp, err := common.GetTxTimestamp()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get timestamp: %w", err))
	}

	kind.ReviewHash = reviewHash
	kind.Reviewer = reviewer
	kind.ReviewedAt = timestamp

	data, err := common.ToJSON(kind)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %w", err))
	}
	if err := sdk.Instance.PutStateFromKey(key, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store review: %w", err))
	}

	sdk.Instance.EmitEvent("UnitKindReviewed", []string{
		kindID, versionStr, reviewer, recommendedStatusStr, reviewHash,
	})
	return sdk.Success([]byte(key))
}

// setKindStatus updates a unit kind's canonical status. Foundation-only.
// Args: kind_id (string), version (uint64), status (uint8)
func (c *EvolutionUnitKindRegistry) setKindStatus() protogo.Response {
	if err := requireFoundationOrg(); err != nil {
		return sdk.Error(err.Error())
	}

	args := sdk.Instance.GetArgs()
	kindID := string(args["kind_id"])
	versionStr := string(args["version"])
	statusStr := string(args["status"])

	if kindID == "" {
		return sdk.Error("kind_id is required")
	}

	var version uint64
	var status uint8
	if _, err := fmt.Sscanf(versionStr, "%d", &version); err != nil {
		return sdk.Error(fmt.Sprintf("invalid version: %s", versionStr))
	}
	fmt.Sscanf(statusStr, "%d", &status)
	if status != common.UnitKindStatusProposed && status != common.UnitKindStatusCanonical && status != common.UnitKindStatusDeprecated {
		return sdk.Error(fmt.Sprintf("invalid status: %d", status))
	}

	key := common.BuildKey(common.PrefixUnitKind, kindID, versionStr)
	existing, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read: %w", err))
	}
	if len(existing) == 0 {
		return sdk.Error("unit kind not found")
	}

	var kind UnitKind
	if err := json.Unmarshal([]byte(existing), &kind); err != nil {
		return sdk.Error(fmt.Sprintf("failed to unmarshal: %w", err))
	}

	kind.Status = status
	data, err := common.ToJSON(kind)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %w", err))
	}
	if err := sdk.Instance.PutStateFromKey(key, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store: %w", err))
	}

	sdk.Instance.EmitEvent("UnitKindStatusSet", []string{kindID, versionStr, statusStr})
	return sdk.Success([]byte(key))
}

// getKind reads a unit kind definition.
// Args: kind_id (string), version (uint64)
func (c *EvolutionUnitKindRegistry) getKind() protogo.Response {
	args := sdk.Instance.GetArgs()
	kindID := string(args["kind_id"])
	versionStr := string(args["version"])

	if kindID == "" {
		return sdk.Error("kind_id is required")
	}

	var version uint64
	fmt.Sscanf(versionStr, "%d", &version)

	key := common.BuildKey(common.PrefixUnitKind, kindID, versionStr)
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
	sandbox.Start(new(EvolutionUnitKindRegistry))
}
