// Package verification implements the VerificationRegistry contract for the OriginAgent Evolution Chain.
// It records evidence reports, validator profiles, challenge submissions, and challenge resolution.
//
// Evidence types (weighted in off-chain SDK, not on-chain):
//   local_client_report: 10
//   user_signed_receipt: 30
//   validator_report: 60
//   unqualified_validator_report: 0
//   foundation_seed_report: 40
//
// ChainMaker migration notes:
//   - Solidity onlyOwner → Foundation org membership checks
//   - Solidity resolveChallengeFromAdjudicator → adjudicator org check
//   - testnetReputation → contribution standing (int32 deltas preserved)
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
	FoundationOrgID         = "originagent-foundation"
	AdjudicatorOrgID        = "originagent-adjudicator"
	AdjudicatorConfirmDelay = 3600 // 1 hour
)

// VerificationReport mirrors a submitted verification report (EC-2 compatibility path).
type VerificationReport struct {
	ModuleDigest           string `json:"moduleDigest"`
	ProofBundleHash        string `json:"proofBundleHash"`
	VerificationReportHash string `json:"verificationReportHash"`
	CapabilitySnapshotHash string `json:"capabilitySnapshotHash"`
	TelemetryDigest        string `json:"telemetryDigest"`
	Reporter               string `json:"reporter"`
	SubmittedAt            int64  `json:"submittedAt"`
	Exists                 bool   `json:"exists"`
}

// ValidatorProfile stores operator/runner identity hashes and allowlist status.
type ValidatorProfile struct {
	OperatorGroupHash     string `json:"operatorGroupHash"`
	RunnerFingerprintHash string `json:"runnerFingerprintHash"`
	Allowed               bool   `json:"allowed"`
	Exists                bool   `json:"exists"`
}

// EvidenceRecord stores evidence attached to a module.
type EvidenceRecord struct {
	EvidenceID            string `json:"evidenceId"`
	ModuleDigest          string `json:"moduleDigest"`
	ProofBundleHash       string `json:"proofBundleHash"`
	ReportHash            string `json:"reportHash"`
	EvidenceType          uint8  `json:"evidenceType"`
	OperatorGroupHash     string `json:"operatorGroupHash"`
	RunnerFingerprintHash string `json:"runnerFingerprintHash"`
	Reporter              string `json:"reporter"`
	SubmittedAt           int64  `json:"submittedAt"`
	ChallengeWindowEnd    int64  `json:"challengeWindowEnd"`
	Status                uint8  `json:"status"`
	TestnetOnly           bool   `json:"testnetOnly"`
	Exists                bool   `json:"exists"`
}

// ChallengeRecord stores a challenge against evidence.
type ChallengeRecord struct {
	ChallengeID    string `json:"challengeId"`
	EvidenceID     string `json:"evidenceId"`
	ModuleDigest   string `json:"moduleDigest"`
	ReasonHash     string `json:"reasonHash"`
	Challenger     string `json:"challenger"`
	SubmittedAt    int64  `json:"submittedAt"`
	ResolvedAt     int64  `json:"resolvedAt"`
	ResolutionHash string `json:"resolutionHash"`
	Status         uint8  `json:"status"`
}

type VerificationRegistry struct{}

func (c *VerificationRegistry) InitContract() protogo.Response {
	return sdk.Success([]byte("VerificationRegistry initialized"))
}

func (c *VerificationRegistry) UpgradeContract() protogo.Response {
	return sdk.Success([]byte("VerificationRegistry upgraded"))
}

func (c *VerificationRegistry) InvokeContract(method string) protogo.Response {
	switch method {
	case "submit_report":
		return c.submitReport()
	case "submit_evidence":
		return c.submitEvidence()
	case "set_validator_profile":
		return c.setValidatorProfile()
	case "get_validator_profile":
		return c.getValidatorProfile()
	case "invalidate_evidence":
		return c.invalidateEvidence()
	case "submit_challenge":
		return c.submitChallenge()
	case "resolve_challenge":
		return c.resolveChallenge()
	case "resolve_challenge_from_adjudicator":
		return c.resolveChallengeFromAdjudicator()
	case "get_evidence":
		return c.getEvidence()
	case "get_challenge":
		return c.getChallenge()
	default:
		return sdk.Error(fmt.Sprintf("unknown method: %s", method))
	}
}

// ---- Report submission (EC-2 compatibility) ----

// submitReport records a local-client verification report.
// Args: module_digest, proof_bundle_hash, verification_report_hash,
//
//	capability_snapshot_hash, telemetry_digest
func (c *VerificationRegistry) submitReport() protogo.Response {
	args := sdk.Instance.GetArgs()
	moduleDigest := string(args["module_digest"])
	proofBundleHash := string(args["proof_bundle_hash"])
	verificationReportHash := string(args["verification_report_hash"])
	capabilitySnapshotHash := string(args["capability_snapshot_hash"])
	telemetryDigest := string(args["telemetry_digest"])

	if invalidHex64(moduleDigest, proofBundleHash, verificationReportHash, telemetryDigest) {
		return sdk.Error("all hash fields must be 64 hex characters")
	}
	if !c.moduleExists(moduleDigest) {
		return sdk.Error("unknown module")
	}

	reportKey := common.BuildKey(common.PrefixModule, "REPORT", moduleDigest)
	if existing, _ := sdk.Instance.GetStateFromKey(reportKey); len(existing) > 0 {
		var r VerificationReport
		if json.Unmarshal([]byte(existing), &r) == nil && r.Exists {
			return sdk.Error("report already submitted for this module")
		}
	}

	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %w", err))
	}

	timestamp, err := common.GetTxTimestamp()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get timestamp: %w", err))
	}

	report := VerificationReport{
		ModuleDigest:           moduleDigest,
		ProofBundleHash:        proofBundleHash,
		VerificationReportHash: verificationReportHash,
		CapabilitySnapshotHash: capabilitySnapshotHash,
		TelemetryDigest:        telemetryDigest,
		Reporter:               caller,
		SubmittedAt:            timestamp,
		Exists:                 true,
	}
	data, err := common.ToJSON(report)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %w", err))
	}
	if err := sdk.Instance.PutStateFromKey(reportKey, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store report: %w", err))
	}

	sdk.Instance.EmitEvent("VerificationReportSubmitted", []string{
		moduleDigest, proofBundleHash, verificationReportHash, capabilitySnapshotHash, telemetryDigest, caller,
	})

	return c.recordEvidence(moduleDigest, proofBundleHash, verificationReportHash,
		common.EvidenceTypeLocalClientReport, "", "", 0)
}

// ---- Evidence submission ----

// submitEvidence records a new evidence record for a module.
// Args: module_digest, proof_bundle_hash, report_hash, evidence_type (uint8),
//
//	operator_group_hash, runner_fingerprint_hash, challenge_window_end (int64)
func (c *VerificationRegistry) submitEvidence() protogo.Response {
	args := sdk.Instance.GetArgs()
	moduleDigest := string(args["module_digest"])
	proofBundleHash := string(args["proof_bundle_hash"])
	reportHash := string(args["report_hash"])
	evidenceTypeStr := string(args["evidence_type"])
	operatorGroupHash := string(args["operator_group_hash"])
	runnerFingerprintHash := string(args["runner_fingerprint_hash"])
	challengeWindowEndStr := string(args["challenge_window_end"])

	if invalidHex64(moduleDigest, proofBundleHash, reportHash) {
		return sdk.Error("module_digest, proof_bundle_hash, and report_hash must each be 64 hex characters")
	}

	var evidenceType uint8
	if _, err := fmt.Sscanf(evidenceTypeStr, "%d", &evidenceType); err != nil {
		return sdk.Error(fmt.Sprintf("invalid evidence_type: %s", evidenceTypeStr))
	}
	if evidenceType == common.EvidenceTypeUnknown || evidenceType > common.EvidenceTypeFoundationSeedReport {
		return sdk.Error(fmt.Sprintf("invalid evidence type: %d", evidenceType))
	}

	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %w", err))
	}

	// Foundation seed reports require Foundation org.
	if evidenceType == common.EvidenceTypeFoundationSeedReport {
		if err := requireFoundationOrg(); err != nil {
			return sdk.Error(err.Error())
		}
	}

	if evidenceType == common.EvidenceTypeValidatorReport {
		profile, found := c.getValidatorProfileInternal(caller)
		if !found || !profile.Allowed || !c.isQualifiedValidator(profile) {
			return c.recordEvidence(moduleDigest, proofBundleHash, reportHash,
				common.EvidenceTypeUnqualifiedValidatorReport, operatorGroupHash, runnerFingerprintHash, 0)
		}
		operatorGroupHash = profile.OperatorGroupHash
		runnerFingerprintHash = profile.RunnerFingerprintHash
	}

	var challengeWindowEnd int64
	fmt.Sscanf(challengeWindowEndStr, "%d", &challengeWindowEnd)

	return c.recordEvidence(moduleDigest, proofBundleHash, reportHash, evidenceType,
		operatorGroupHash, runnerFingerprintHash, challengeWindowEnd)
}

// ---- Validator profiles ----

// setValidatorProfile sets a validator's allowlist profile. Foundation-only.
// Args: validator (address), operator_group_hash, runner_fingerprint_hash, allowed (bool)
func (c *VerificationRegistry) setValidatorProfile() protogo.Response {
	if err := requireFoundationOrg(); err != nil {
		return sdk.Error(err.Error())
	}

	args := sdk.Instance.GetArgs()
	validator := string(args["validator"])
	operatorGroupHash := string(args["operator_group_hash"])
	runnerFingerprintHash := string(args["runner_fingerprint_hash"])
	allowedStr := string(args["allowed"])

	if invalidHex64(operatorGroupHash, runnerFingerprintHash) {
		return sdk.Error("operator_group_hash and runner_fingerprint_hash must each be 64 hex characters")
	}
	if validator == "" {
		return sdk.Error("validator address is required")
	}

	profile := ValidatorProfile{
		OperatorGroupHash:     operatorGroupHash,
		RunnerFingerprintHash: runnerFingerprintHash,
		Allowed:               allowedStr == "true",
		Exists:                true,
	}
	data, err := common.ToJSON(profile)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %w", err))
	}

	key := common.BuildKey(common.PrefixValidator, validator)
	if err := sdk.Instance.PutStateFromKey(key, string(data)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store profile: %w", err))
	}

	sdk.Instance.EmitEvent("ValidatorProfileSet", []string{validator, operatorGroupHash, runnerFingerprintHash, allowedStr})
	return sdk.Success([]byte(validator))
}

// getValidatorProfile reads a validator's profile.
// Args: validator (address)
func (c *VerificationRegistry) getValidatorProfile() protogo.Response {
	args := sdk.Instance.GetArgs()
	validator := string(args["validator"])

	profile, found := c.getValidatorProfileInternal(validator)
	if !found {
		return sdk.Success([]byte(`{"exists":false}`))
	}
	data, _ := common.ToJSON(profile)
	return sdk.Success(data)
}

// ---- Evidence invalidation ----

// invalidateEvidence marks evidence as invalid. Foundation-only.
// Args: evidence_id (64 hex), reason_hash (64 hex)
func (c *VerificationRegistry) invalidateEvidence() protogo.Response {
	if err := requireFoundationOrg(); err != nil {
		return sdk.Error(err.Error())
	}

	args := sdk.Instance.GetArgs()
	evidenceID := string(args["evidence_id"])
	reasonHash := string(args["reason_hash"])

	if invalidHex64(evidenceID, reasonHash) {
		return sdk.Error("evidence_id and reason_hash must each be 64 hex characters")
	}

	evidence, err := c.getEvidenceInternal(evidenceID)
	if err != nil {
		return sdk.Error(err.Error())
	}

	evidence.Status = common.ReportStatusInvalidated
	if err := c.putEvidence(evidence); err != nil {
		return sdk.Error(err.Error())
	}

	caller, _ := sdk.Instance.GetSenderAddr()
	sdk.Instance.EmitEvent("EvidenceInvalidated", []string{evidenceID, reasonHash, caller})
	return sdk.Success([]byte(evidenceID))
}

// ---- Challenge submission and resolution ----

// submitChallenge submits a challenge against active evidence. Open to any caller.
// Args: evidence_id (64 hex), reason_hash (64 hex)
func (c *VerificationRegistry) submitChallenge() protogo.Response {
	args := sdk.Instance.GetArgs()
	evidenceID := string(args["evidence_id"])
	reasonHash := string(args["reason_hash"])

	if invalidHex64(evidenceID, reasonHash) {
		return sdk.Error("evidence_id and reason_hash must each be 64 hex characters")
	}

	evidence, err := c.getEvidenceInternal(evidenceID)
	if err != nil {
		return sdk.Error(err.Error())
	}
	if evidence.Status != common.ReportStatusActive {
		return sdk.Error("evidence is not active")
	}

	timestamp, err := common.GetTxTimestamp()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get timestamp: %w", err))
	}
	if evidence.ChallengeWindowEnd != 0 && timestamp > evidence.ChallengeWindowEnd {
		return sdk.Error("challenge window closed")
	}

	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %w", err))
	}

	challengeID := computeChallengeID(evidenceID, caller, reasonHash)

	challengeKey := common.BuildKey(common.PrefixChallenge, challengeID)
	if existing, _ := sdk.Instance.GetStateFromKey(challengeKey); len(existing) > 0 {
		var ch ChallengeRecord
		if json.Unmarshal([]byte(existing), &ch) == nil && ch.Status != common.ChallengeStatusUnknown {
			return sdk.Error("challenge already submitted")
		}
	}

	challenge := ChallengeRecord{
		ChallengeID:  challengeID,
		EvidenceID:   evidenceID,
		ModuleDigest: evidence.ModuleDigest,
		ReasonHash:   reasonHash,
		Challenger:   caller,
		SubmittedAt:  timestamp,
		Status:       common.ChallengeStatusSubmitted,
	}
	chData, err := common.ToJSON(challenge)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal: %w", err))
	}
	if err := sdk.Instance.PutStateFromKey(challengeKey, string(chData)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store challenge: %w", err))
	}

	sdk.Instance.EmitEvent("ChallengeSubmitted", []string{
		challengeID, evidenceID, evidence.ModuleDigest, reasonHash, caller,
	})
	return sdk.Success([]byte(challengeID))
}

// resolveChallenge resolves a challenge via legacy Foundation path.
// Args: challenge_id (64 hex), upheld (bool), resolution_hash (64 hex)
func (c *VerificationRegistry) resolveChallenge() protogo.Response {
	if err := requireFoundationOrg(); err != nil {
		return sdk.Error(err.Error())
	}

	args := sdk.Instance.GetArgs()
	challengeID := string(args["challenge_id"])
	upheldStr := string(args["upheld"])
	resolutionHash := string(args["resolution_hash"])

	if invalidHex64(challengeID, resolutionHash) {
		return sdk.Error("challenge_id and resolution_hash must each be 64 hex characters")
	}

	if c.adjudicationStarted(challengeID) {
		return sdk.Error("adjudication in progress for this challenge")
	}

	return c.resolveChallengeInternal(challengeID, upheldStr == "true", resolutionHash)
}

// resolveChallengeFromAdjudicator resolves a challenge from the adjudication registry.
// Args: challenge_id (64 hex), upheld (bool), resolution_hash (64 hex)
func (c *VerificationRegistry) resolveChallengeFromAdjudicator() protogo.Response {
	orgID, err := sdk.Instance.GetSenderOrgId()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender org: %w", err))
	}
	if orgID != AdjudicatorOrgID {
		return sdk.Error(fmt.Sprintf("not adjudicator org: %s", orgID))
	}

	args := sdk.Instance.GetArgs()
	challengeID := string(args["challenge_id"])
	upheldStr := string(args["upheld"])
	resolutionHash := string(args["resolution_hash"])

	if invalidHex64(challengeID, resolutionHash) {
		return sdk.Error("challenge_id and resolution_hash must each be 64 hex characters")
	}

	return c.resolveChallengeInternal(challengeID, upheldStr == "true", resolutionHash)
}

// ---- Read methods ----

// getEvidence reads an evidence record.
func (c *VerificationRegistry) getEvidence() protogo.Response {
	args := sdk.Instance.GetArgs()
	evidenceID := string(args["evidence_id"])
	evidence, err := c.getEvidenceInternal(evidenceID)
	if err != nil {
		return sdk.Error(err.Error())
	}
	data, _ := common.ToJSON(evidence)
	return sdk.Success(data)
}

// getChallenge reads a challenge record.
func (c *VerificationRegistry) getChallenge() protogo.Response {
	args := sdk.Instance.GetArgs()
	challengeID := string(args["challenge_id"])
	key := common.BuildKey(common.PrefixChallenge, challengeID)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read: %w", err))
	}
	if len(data) == 0 {
		return sdk.Success([]byte(`{"status":0}`))
	}
	return sdk.Success([]byte(data))
}

// ---- Internal helpers ----

func (c *VerificationRegistry) recordEvidence(
	moduleDigest, proofBundleHash, reportHash string,
	evidenceType uint8, operatorGroupHash, runnerFingerprintHash string,
	challengeWindowEnd int64,
) protogo.Response {
	caller, err := sdk.Instance.GetSenderAddr()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get sender: %w", err))
	}

	evidenceID := computeEvidenceID(moduleDigest, proofBundleHash, reportHash, caller, evidenceType)

	evidenceKey := common.BuildKey(common.PrefixEvidence, evidenceID)
	if existing, _ := sdk.Instance.GetStateFromKey(evidenceKey); len(existing) > 0 {
		var ev EvidenceRecord
		if json.Unmarshal([]byte(existing), &ev) == nil && ev.Exists {
			return sdk.Error("evidence already submitted")
		}
	}

	timestamp, err := common.GetTxTimestamp()
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to get timestamp: %w", err))
	}

	evidence := EvidenceRecord{
		EvidenceID:            evidenceID,
		ModuleDigest:          moduleDigest,
		ProofBundleHash:       proofBundleHash,
		ReportHash:            reportHash,
		EvidenceType:          evidenceType,
		OperatorGroupHash:     operatorGroupHash,
		RunnerFingerprintHash: runnerFingerprintHash,
		Reporter:              caller,
		SubmittedAt:           timestamp,
		ChallengeWindowEnd:    challengeWindowEnd,
		Status:                common.ReportStatusActive,
		TestnetOnly:           true,
		Exists:                true,
	}
	evData, err := common.ToJSON(evidence)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal evidence: %w", err))
	}
	if err := sdk.Instance.PutStateFromKey(evidenceKey, string(evData)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store evidence: %w", err))
	}

	// Append to module evidence index.
	moduleEvidenceKey := common.BuildKey(common.PrefixModuleEvidence, moduleDigest)
	existingList, _ := sdk.Instance.GetStateFromKey(moduleEvidenceKey)
	var evidenceIDs []string
	if len(existingList) > 0 {
		json.Unmarshal([]byte(existingList), &evidenceIDs)
	}
	evidenceIDs = append(evidenceIDs, evidenceID)
	listData, _ := common.ToJSON(evidenceIDs)
	sdk.Instance.PutStateFromKey(moduleEvidenceKey, string(listData))

	sdk.Instance.EmitEvent("EvidenceSubmitted", []string{
		evidenceID, moduleDigest, fmt.Sprintf("%d", evidenceType), caller,
	})
	return sdk.Success([]byte(evidenceID))
}

func (c *VerificationRegistry) resolveChallengeInternal(challengeID string, upheld bool, resolutionHash string) protogo.Response {
	key := common.BuildKey(common.PrefixChallenge, challengeID)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to read challenge: %w", err))
	}
	if len(data) == 0 {
		return sdk.Error("unknown challenge")
	}

	var challenge ChallengeRecord
	if err := json.Unmarshal([]byte(data), &challenge); err != nil {
		return sdk.Error(fmt.Sprintf("failed to unmarshal: %w", err))
	}
	if challenge.Status != common.ChallengeStatusSubmitted {
		return sdk.Error("challenge already resolved")
	}

	if upheld {
		evidence, evErr := c.getEvidenceInternal(challenge.EvidenceID)
		if evErr == nil && evidence.Status == common.ReportStatusActive {
			evidence.Status = common.ReportStatusInvalidated
			c.putEvidence(evidence)
			caller, _ := sdk.Instance.GetSenderAddr()
			sdk.Instance.EmitEvent("EvidenceInvalidated", []string{challenge.EvidenceID, resolutionHash, caller})
		}
		challenge.Status = common.ChallengeStatusUpheld
	} else {
		challenge.Status = common.ChallengeStatusRejected
	}

	timestamp, _ := common.GetTxTimestamp()
	challenge.ResolvedAt = timestamp
	challenge.ResolutionHash = resolutionHash

	chData, err := common.ToJSON(challenge)
	if err != nil {
		return sdk.Error(fmt.Sprintf("failed to marshal challenge: %w", err))
	}
	if err := sdk.Instance.PutStateFromKey(key, string(chData)); err != nil {
		return sdk.Error(fmt.Sprintf("failed to store challenge: %w", err))
	}

	caller, _ := sdk.Instance.GetSenderAddr()
	sdk.Instance.EmitEvent("ChallengeResolved", []string{
		challengeID, challenge.EvidenceID, fmt.Sprintf("%t", upheld), resolutionHash, caller,
	})
	return sdk.Success([]byte(challengeID))
}

func (c *VerificationRegistry) getEvidenceInternal(evidenceID string) (*EvidenceRecord, error) {
	key := common.BuildKey(common.PrefixEvidence, evidenceID)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil {
		return nil, fmt.Errorf("failed to read evidence: %w", err)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("unknown evidence: %s", evidenceID)
	}
	var evidence EvidenceRecord
	if err := json.Unmarshal([]byte(data), &evidence); err != nil {
		return nil, fmt.Errorf("failed to unmarshal evidence: %w", err)
	}
	return &evidence, nil
}

func (c *VerificationRegistry) putEvidence(evidence *EvidenceRecord) error {
	key := common.BuildKey(common.PrefixEvidence, evidence.EvidenceID)
	data, err := common.ToJSON(evidence)
	if err != nil {
		return fmt.Errorf("failed to marshal: %w", err)
	}
	return sdk.Instance.PutStateFromKey(key, string(data))
}

func (c *VerificationRegistry) getValidatorProfileInternal(validator string) (*ValidatorProfile, bool) {
	key := common.BuildKey(common.PrefixValidator, validator)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil || len(data) == 0 {
		return nil, false
	}
	var profile ValidatorProfile
	if err := json.Unmarshal([]byte(data), &profile); err != nil {
		return nil, false
	}
	return &profile, profile.Exists
}

func (c *VerificationRegistry) isQualifiedValidator(profile *ValidatorProfile) bool {
	return profile != nil && profile.Exists && profile.Allowed &&
		len(profile.OperatorGroupHash) == 64 && len(profile.RunnerFingerprintHash) == 64
}

func (c *VerificationRegistry) moduleExists(moduleDigest string) bool {
	key := common.BuildKey(common.PrefixModule, moduleDigest)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil || len(data) == 0 {
		return false
	}
	var rec struct {
		Status uint8 `json:"status"`
	}
	if err := json.Unmarshal([]byte(data), &rec); err != nil {
		return false
	}
	return rec.Status != common.ModuleStatusNone
}

func (c *VerificationRegistry) adjudicationStarted(challengeID string) bool {
	key := common.BuildKey(common.PrefixAdjudication, challengeID)
	data, err := sdk.Instance.GetStateFromKey(key)
	if err != nil || len(data) == 0 {
		return false
	}
	var state struct {
		Started bool `json:"started"`
	}
	if err := json.Unmarshal([]byte(data), &state); err != nil {
		return false
	}
	return state.Started
}

// ---- Utility functions ----

func computeEvidenceID(moduleDigest, proofBundleHash, reportHash, reporter string, evidenceType uint8) string {
	input := fmt.Sprintf("%s%s%s%s%d", moduleDigest, proofBundleHash, reportHash, reporter, evidenceType)
	h := sha256.Sum256([]byte(input))
	return fmt.Sprintf("%x", h[:])
}

func computeChallengeID(evidenceID, challenger, reasonHash string) string {
	input := fmt.Sprintf("%s%s%s", evidenceID, challenger, reasonHash)
	h := sha256.Sum256([]byte(input))
	return fmt.Sprintf("%x", h[:])
}

func invalidHex64(values ...string) bool {
	for _, v := range values {
		if len(v) != 64 {
			return true
		}
		for _, ch := range v {
			if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')) {
				return true
			}
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
	sandbox.Start(new(VerificationRegistry))
}
