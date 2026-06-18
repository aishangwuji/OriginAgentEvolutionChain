// Package validate provides validation for proof bundles, evidence reports,
// and challenge records against the protocol schemas.
package validate

import (
	"encoding/json"
	"fmt"
	"os"

	"originagent-evolution-chain/eccli/pkg/canonical"
)

// ProofBundle validates a proof bundle JSON and recomputes its hash.
func ProofBundle(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read proof bundle: %w", err)
	}

	var bundle map[string]any
	if err := json.Unmarshal(data, &bundle); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	required := []string{
		"schema_version", "artifact_digest", "module_id", "module_type",
		"module_version", "verification_event_hash", "verification_report_digest",
		"telemetry_digest", "ledger_tip_hash", "created_at", "actor",
		"actor_public_key", "signature", "proof_bundle_hash",
	}
	for _, field := range required {
		if _, ok := bundle[field]; !ok {
			return nil, fmt.Errorf("missing required field: %s", field)
		}
	}

	// Recompute proof_bundle_hash (exclude self and signature).
	pbCopy := make(map[string]any)
	for k, v := range bundle {
		if k != "proof_bundle_hash" && k != "signature" {
			pbCopy[k] = v
		}
	}
	expected, err := canonical.HashJSON(pbCopy)
	if err != nil {
		return nil, fmt.Errorf("failed to hash: %w", err)
	}

	actual, _ := bundle["proof_bundle_hash"].(string)
	if expected != actual {
		return nil, fmt.Errorf("proof_bundle_hash mismatch: expected %s, got %s", expected, actual)
	}

	return bundle, nil
}

// EvidenceReport validates basic evidence report structure.
func EvidenceReport(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read evidence report: %w", err)
	}
	var report map[string]any
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
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

// ChallengeRecord validates basic challenge record structure.
func ChallengeRecord(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read challenge record: %w", err)
	}
	var record map[string]any
	if err := json.Unmarshal(data, &record); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
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

// ModuleManifest validates a module manifest artifact.
func ModuleManifest(path string) (map[string]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read manifest: %w", err)
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	schema, _ := m["schema_version"].(string)
	if schema != "originagent.evolution.module_manifest.v1" {
		return nil, fmt.Errorf("expected schema_version originagent.evolution.module_manifest.v1, got %s", schema)
	}
	return m, nil
}
