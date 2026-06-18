// Package audit generates audit bundles by cross-checking chain events
// against evidence reports, challenge records, and other public artifacts.
package audit

import (
	"encoding/json"
	"fmt"
	"os"

	"originagent-evolution-chain/eccli/pkg/canonical"
)

// Bundle represents a complete audit cross-check report.
type Bundle struct {
	SchemaVersion   string           `json:"schema_version"`
	EventCount      int              `json:"event_count"`
	EvidenceCount   int              `json:"evidence_count"`
	ChallengeCount  int              `json:"challenge_count"`
	PassportCount   int              `json:"passport_count,omitempty"`
	Events          []map[string]any `json:"events,omitempty"`
	EvidenceReports []map[string]any `json:"evidence_reports,omitempty"`
	ChallengeRecords []map[string]any `json:"challenge_records,omitempty"`
	Passports       []map[string]any `json:"passports,omitempty"`
	Findings        []AuditFinding   `json:"findings,omitempty"`
	BundleHash      string           `json:"bundle_hash,omitempty"`
}

// AuditFinding represents a single cross-check result.
type AuditFinding struct {
	Level   string `json:"level"` // "ok", "warn", "error"
	Subject string `json:"subject"`
	Message string `json:"message"`
}

// NewBundle creates an audit bundle and computes its hash.
func NewBundle(events, evidenceReports, challengeRecords, passports []map[string]any) (*Bundle, error) {
	b := &Bundle{
		SchemaVersion:    "originagent.evolution.audit_bundle.v1",
		EventCount:       len(events),
		EvidenceCount:    len(evidenceReports),
		ChallengeCount:   len(challengeRecords),
		PassportCount:    len(passports),
		Events:           events,
		EvidenceReports:  evidenceReports,
		ChallengeRecords: challengeRecords,
		Passports:        passports,
	}
	hash, err := canonical.HashJSON(b)
	if err != nil {
		return nil, fmt.Errorf("failed to hash bundle: %w", err)
	}
	b.BundleHash = hash
	return b, nil
}

// CrossCheck performs basic consistency checks between events and reports.
func CrossCheck(bundle *Bundle) []AuditFinding {
	var findings []AuditFinding

	// Build index of module digests from events.
	eventModules := make(map[string]bool)
	for _, ev := range bundle.Events {
		if moduleDigest, ok := ev["moduleDigest"].(string); ok && moduleDigest != "" {
			eventModules[moduleDigest] = true
		}
	}

	// Check evidence reports reference known modules.
	for i, report := range bundle.EvidenceReports {
		moduleDigest, _ := report["module_digest"].(string)
		if moduleDigest == "" {
			findings = append(findings, AuditFinding{
				Level:   "warn",
				Subject: fmt.Sprintf("evidence_report[%d]", i),
				Message: "evidence report missing module_digest",
			})
		} else if !eventModules[moduleDigest] && len(eventModules) > 0 {
			findings = append(findings, AuditFinding{
				Level:   "warn",
				Subject: fmt.Sprintf("evidence_report[%d]", i),
				Message: fmt.Sprintf("module digest %s not found in chain events", moduleDigest[:16]+"..."),
			})
		}
	}

	// Check challenge records reference known evidence.
	evidenceIDs := make(map[string]bool)
	for _, report := range bundle.EvidenceReports {
		if eid, ok := report["evidence_id"].(string); ok {
			evidenceIDs[eid] = true
		}
	}
	for i, ch := range bundle.ChallengeRecords {
		eid, _ := ch["evidence_id"].(string)
		if eid != "" && !evidenceIDs[eid] && len(evidenceIDs) > 0 {
			findings = append(findings, AuditFinding{
				Level:   "warn",
				Subject: fmt.Sprintf("challenge_record[%d]", i),
				Message: fmt.Sprintf("evidence_id %s not found in provided evidence reports", eid[:16]+"..."),
			})
		}
	}

	if len(findings) == 0 {
		findings = append(findings, AuditFinding{
			Level:   "ok",
			Subject: "audit_bundle",
			Message: fmt.Sprintf("cross-check passed: %d events, %d evidence, %d challenges",
				bundle.EventCount, bundle.EvidenceCount, bundle.ChallengeCount),
		})
	}

	return findings
}

// SaveBundle writes an audit bundle to a file.
func SaveBundle(path string, bundle *Bundle) error {
	data, err := json.MarshalIndent(bundle, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}
