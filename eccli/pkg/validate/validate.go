// Package validate provides schema and privacy validation for evolution chain
// artifacts: proof bundles, evidence reports, challenge records, and module
// manifests.
//
// Business Rule: the validation rules mirror the TypeScript SDK
// (sdk/src/proof.ts and sdk/src/evidence.ts) so the Go port and the TypeScript
// SDK accept and reject exactly the same payloads.
package validate

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"originagent-evolution-chain/eccli/pkg/canonical"
)

const proofSchemaVersion = "originagent.evolution.proof_bundle.v1"

// requiredProofFields mirrors REQUIRED_FIELDS in sdk/src/proof.ts.
var requiredProofFields = []string{
	"schema_version",
	"artifact_digest",
	"module_id",
	"module_type",
	"module_version",
	"verification_event_hash",
	"activation_event_hash",
	"verification_report_digest",
	"capability_snapshot_digest",
	"telemetry_digest",
	"state_branch_digest",
	"ledger_tip_hash",
	"created_at",
	"actor",
	"actor_public_key",
	"signature_scheme",
	"signature",
	"proof_bundle_hash",
}

var allowedModuleTypes = map[string]struct{}{
	"skill":       {},
	"domain_pack": {},
	"workflow":    {},
	"tool":        {},
}

// requiredHex64ProofFields must be lowercase 64-character hex digests.
var requiredHex64ProofFields = []string{
	"artifact_digest",
	"verification_event_hash",
	"verification_report_digest",
	"telemetry_digest",
	"ledger_tip_hash",
	"proof_bundle_hash",
}

// optionalHex64ProofFields must be either empty or a lowercase 64-char hex digest.
var optionalHex64ProofFields = []string{
	"activation_event_hash",
	"capability_snapshot_digest",
	"state_branch_digest",
}

// ProofValidationResult is the outcome of validating a proof bundle.
type ProofValidationResult struct {
	OK              bool     `json:"ok"`
	Errors          []string `json:"errors"`
	ComputedHash    string   `json:"computed_hash"`
	ProofBundleHash string   `json:"proof_bundle_hash"`
}

// LoadProofBundle reads and decodes a proof bundle JSON file without validating it.
func LoadProofBundle(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read proof bundle: %w", err)
	}
	var bundle map[string]any
	if err := json.Unmarshal(data, &bundle); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	return bundle, nil
}

// ComputeProofBundleHash hashes a proof bundle while excluding the self hash
// and the signature, matching computeProofBundleHash in sdk/src/proof.ts.
func ComputeProofBundleHash(bundle map[string]any) (string, error) {
	payload := make(map[string]any, len(bundle))
	for k, v := range bundle {
		if k == "proof_bundle_hash" || k == "signature" {
			continue
		}
		payload[k] = v
	}
	return canonical.HashJSON(payload)
}

// ValidateProofBundle validates a decoded proof bundle against the protocol
// rules and the privacy red line. It mirrors validateProofBundle in
// sdk/src/proof.ts, including the unknown-field check and the ordering rule
// that the hash is only compared once all structural checks pass.
func ValidateProofBundle(bundle any) ProofValidationResult {
	result := ProofValidationResult{Errors: []string{}}

	obj, ok := bundle.(map[string]any)
	if !ok {
		result.Errors = append(result.Errors, "proof bundle must be an object")
		return result
	}

	required := make(map[string]struct{}, len(requiredProofFields))
	for _, field := range requiredProofFields {
		required[field] = struct{}{}
		if _, present := obj[field]; !present {
			result.Errors = append(result.Errors, "missing field: "+field)
		}
	}
	for _, key := range sortedKeys(obj) {
		if _, allowed := required[key]; !allowed {
			result.Errors = append(result.Errors, "unknown field: "+key)
		}
	}

	if schemaVersion, _ := obj["schema_version"].(string); schemaVersion != proofSchemaVersion {
		result.Errors = append(result.Errors, "schema_version must be "+proofSchemaVersion)
	}

	for _, field := range requiredHex64ProofFields {
		if !isLowerHex64(obj[field]) {
			result.Errors = append(result.Errors, field+" must be a lowercase 64-character hex digest")
		}
	}
	for _, field := range optionalHex64ProofFields {
		value, isString := obj[field].(string)
		if !isString || (value != "" && !canonical.IsValidHex64(value)) {
			result.Errors = append(result.Errors, field+" must be empty or a lowercase 64-character hex digest")
		}
	}
	if moduleID, isString := obj["module_id"].(string); !isString || moduleID == "" {
		result.Errors = append(result.Errors, "module_id must be a non-empty string")
	}
	if moduleType, isString := obj["module_type"].(string); !isString {
		result.Errors = append(result.Errors, "module_type must be skill, domain_pack, workflow, or tool")
	} else if _, allowed := allowedModuleTypes[moduleType]; !allowed {
		result.Errors = append(result.Errors, "module_type must be skill, domain_pack, workflow, or tool")
	}
	if moduleVersion, isString := obj["module_version"].(string); !isString || moduleVersion == "" {
		result.Errors = append(result.Errors, "module_version must be a non-empty string")
	}
	if scheme, _ := obj["signature_scheme"].(string); scheme != "ed25519" {
		result.Errors = append(result.Errors, "signature_scheme must be ed25519")
	}

	result.Errors = append(result.Errors, CollectPrivacyErrors(obj)...)

	if proofBundleHash, _ := obj["proof_bundle_hash"].(string); proofBundleHash != "" {
		result.ProofBundleHash = proofBundleHash
	}

	if len(result.Errors) == 0 {
		computed, err := ComputeProofBundleHash(obj)
		if err != nil {
			result.Errors = append(result.Errors, "failed to compute proof bundle hash: "+err.Error())
		} else {
			result.ComputedHash = computed
			if computed != result.ProofBundleHash {
				result.Errors = append(result.Errors, "proof_bundle_hash mismatch")
			}
		}
	}

	result.OK = len(result.Errors) == 0
	return result
}

// ProofBundle loads and fully validates a proof bundle file, returning the
// decoded bundle only when every structural, hash, and privacy check passes.
func ProofBundle(path string) (map[string]any, error) {
	bundle, err := LoadProofBundle(path)
	if err != nil {
		return nil, err
	}
	result := ValidateProofBundle(bundle)
	if !result.OK {
		return nil, fmt.Errorf("invalid proof bundle: %s", strings.Join(result.Errors, "; "))
	}
	return bundle, nil
}

// EvidenceReport validates basic evidence report structure and privacy.
func EvidenceReport(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read evidence report: %w", err)
	}
	var report map[string]any
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	if privacyErrors := CollectPrivacyErrors(report); len(privacyErrors) > 0 {
		return nil, fmt.Errorf("evidence report privacy violation: %s", strings.Join(privacyErrors, "; "))
	}

	// report_hash must be present.
	reportHash, ok := report["report_hash"].(string)
	if !ok || len(reportHash) != 64 {
		return nil, fmt.Errorf("evidence report missing valid report_hash (64 hex)")
	}

	// Recompute without report_hash.
	rpCopy := make(map[string]any)
	for k, v := range report {
		if k != "report_hash" {
			rpCopy[k] = v
		}
	}
	expected, err := canonical.HashJSON(rpCopy)
	if err != nil {
		return nil, fmt.Errorf("failed to hash report: %w", err)
	}
	if expected != reportHash {
		return nil, fmt.Errorf("report_hash mismatch: expected %s, got %s", expected, reportHash)
	}

	return report, nil
}

// ChallengeRecord validates basic challenge record structure and privacy.
func ChallengeRecord(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read challenge record: %w", err)
	}
	var record map[string]any
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	if privacyErrors := CollectPrivacyErrors(record); len(privacyErrors) > 0 {
		return nil, fmt.Errorf("challenge record privacy violation: %s", strings.Join(privacyErrors, "; "))
	}

	required := []string{"challenge_id", "evidence_id", "reason_hash", "challenger", "status"}
	for _, field := range required {
		if _, ok := record[field]; !ok {
			return nil, fmt.Errorf("missing required field: %s", field)
		}
	}

	if cid, ok := record["challenge_id"].(string); !ok || len(cid) != 64 {
		return nil, fmt.Errorf("challenge_id must be 64 hex characters")
	}

	return record, nil
}

// ModuleManifest validates a module manifest artifact and its privacy.
func ModuleManifest(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read manifest: %w", err)
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	if privacyErrors := CollectPrivacyErrors(m); len(privacyErrors) > 0 {
		return nil, fmt.Errorf("module manifest privacy violation: %s", strings.Join(privacyErrors, "; "))
	}

	schema, _ := m["schema_version"].(string)
	if schema != "originagent.evolution.module_manifest.v1" {
		return nil, fmt.Errorf("expected schema_version originagent.evolution.module_manifest.v1, got %s", schema)
	}
	return m, nil
}

func isLowerHex64(value any) bool {
	text, isString := value.(string)
	return isString && canonical.IsValidHex64(text)
}
