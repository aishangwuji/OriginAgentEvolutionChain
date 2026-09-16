package validate

import (
	"path/filepath"
	"strings"
	"testing"
)

func fixturePath(name string) string {
	return filepath.Join("..", "..", "..", "fixtures", name)
}

func hex64(ch string) string {
	return strings.Repeat(ch, 64)
}

func validProofBundle(t *testing.T) map[string]any {
	t.Helper()
	bundle := map[string]any{
		"schema_version":             proofSchemaVersion,
		"artifact_digest":            hex64("1"),
		"module_id":                  "demo-skill",
		"module_type":                "skill",
		"module_version":             "1.0.0",
		"verification_event_hash":    hex64("2"),
		"activation_event_hash":      "",
		"verification_report_digest": hex64("3"),
		"capability_snapshot_digest": "",
		"telemetry_digest":           hex64("4"),
		"state_branch_digest":        "",
		"ledger_tip_hash":            hex64("5"),
		"created_at":                 "2026-05-22T00:00:00+00:00",
		"actor":                      "tester",
		"actor_public_key":           "",
		"signature_scheme":           "ed25519",
		"signature":                  "",
	}
	hash, err := ComputeProofBundleHash(bundle)
	if err != nil {
		t.Fatalf("compute hash: %v", err)
	}
	bundle["proof_bundle_hash"] = hash
	return bundle
}

func TestValidateProofBundleValid(t *testing.T) {
	bundle := validProofBundle(t)
	result := ValidateProofBundle(bundle)
	if !result.OK {
		t.Fatalf("expected valid, got errors: %v", result.Errors)
	}
	if result.ComputedHash != result.ProofBundleHash {
		t.Fatalf("computed hash %s != proof_bundle_hash %s", result.ComputedHash, result.ProofBundleHash)
	}
}

func TestValidateProofBundleHashMismatch(t *testing.T) {
	bundle := validProofBundle(t)
	bundle["proof_bundle_hash"] = hex64("9")
	result := ValidateProofBundle(bundle)
	if result.OK {
		t.Fatal("expected hash mismatch to fail")
	}
	if !containsSubstring(result.Errors, "proof_bundle_hash mismatch") {
		t.Fatalf("expected mismatch error, got: %v", result.Errors)
	}
}

func TestValidateProofBundleMissingField(t *testing.T) {
	bundle := validProofBundle(t)
	delete(bundle, "module_type")
	result := ValidateProofBundle(bundle)
	if result.OK {
		t.Fatal("expected missing field to fail")
	}
	if !containsSubstring(result.Errors, "missing field: module_type") {
		t.Fatalf("expected missing field error, got: %v", result.Errors)
	}
}

func TestValidateProofBundleUnknownField(t *testing.T) {
	bundle := validProofBundle(t)
	bundle["unexpected"] = "value"
	result := ValidateProofBundle(bundle)
	if result.OK {
		t.Fatal("expected unknown field to fail")
	}
	if !containsSubstring(result.Errors, "unknown field: unexpected") {
		t.Fatalf("expected unknown field error, got: %v", result.Errors)
	}
}

func TestValidateProofBundleSchemaVersion(t *testing.T) {
	bundle := validProofBundle(t)
	bundle["schema_version"] = "originagent.evolution.proof_bundle.v2"
	result := ValidateProofBundle(bundle)
	if result.OK {
		t.Fatal("expected schema version to fail")
	}
	if !containsSubstring(result.Errors, "schema_version must be") {
		t.Fatalf("expected schema version error, got: %v", result.Errors)
	}
}

func TestValidateProofBundleModuleType(t *testing.T) {
	bundle := validProofBundle(t)
	bundle["module_type"] = "not_a_type"
	result := ValidateProofBundle(bundle)
	if result.OK {
		t.Fatal("expected invalid module_type to fail")
	}
	if !containsSubstring(result.Errors, "module_type must be") {
		t.Fatalf("expected module_type error, got: %v", result.Errors)
	}
}

func TestValidateProofBundleUppercaseDigestRejected(t *testing.T) {
	bundle := validProofBundle(t)
	bundle["artifact_digest"] = strings.Repeat("A", 64)
	result := ValidateProofBundle(bundle)
	if result.OK {
		t.Fatal("expected uppercase digest to fail")
	}
	if !containsSubstring(result.Errors, "artifact_digest must be a lowercase 64-character hex digest") {
		t.Fatalf("expected hex error, got: %v", result.Errors)
	}
}

func TestValidateProofBundlePrivacyViolations(t *testing.T) {
	bundle := validProofBundle(t)
	bundle["raw_prompt"] = "summarize private data"
	bundle["note"] = `C:\Users\tester\secret.txt`
	bundle["callback"] = "https://example.invalid/path?token=abc"
	bundle["secret"] = "api_key=abc123"
	bundle["home"] = "/home/tester/.ssh/id_rsa"

	result := ValidateProofBundle(bundle)
	if result.OK {
		t.Fatal("expected privacy violations to fail")
	}
	for _, want := range []string{
		"forbidden private field: $.raw_prompt",
		"local absolute path detected at $.note",
		"URL query string detected at $.callback",
		"secret-like string detected at $.secret",
		"local absolute path detected at $.home",
	} {
		if !containsSubstring(result.Errors, want) {
			t.Fatalf("expected %q in errors, got: %v", want, result.Errors)
		}
	}
}

func TestValidateProofBundlePrivacyInsideArray(t *testing.T) {
	bundle := validProofBundle(t)
	bundle["evidence"] = []any{
		map[string]any{"prompt": "private prompt"},
	}
	result := ValidateProofBundle(bundle)
	if result.OK {
		t.Fatal("expected nested privacy violation to fail")
	}
	if !containsSubstring(result.Errors, "forbidden private field: $.evidence[0].prompt") {
		t.Fatalf("expected nested field path, got: %v", result.Errors)
	}
}

func TestValidFixturePasses(t *testing.T) {
	bundle, err := LoadProofBundle(fixturePath("proof_bundle.valid.json"))
	if err != nil {
		t.Fatalf("load fixture: %v", err)
	}
	result := ValidateProofBundle(bundle)
	if !result.OK {
		t.Fatalf("expected valid fixture to pass, got: %v", result.Errors)
	}
}

func TestPrivacyFixtureRejectedAsChallengeRecord(t *testing.T) {
	_, err := ChallengeRecord(fixturePath("challenge_record.privacy.invalid.json"))
	if err == nil {
		t.Fatal("expected privacy fixture to be rejected")
	}
	for _, want := range []string{
		"forbidden private field",
		"local absolute path",
		"URL query string",
		"secret-like string",
	} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("expected %q in error, got: %v", want, err)
		}
	}
}

func TestCollectPrivacyErrorsPlainURLNotFlaggedAsLocalPath(t *testing.T) {
	errs := CollectPrivacyErrors(map[string]any{"source": "https://example.com/path/without/query"})
	if containsSubstring(errs, "local absolute path") {
		t.Fatalf("plain URL must not be treated as a local path, got: %v", errs)
	}
}

func TestCollectPrivacyErrorsBoundaryWindowsPath(t *testing.T) {
	for _, value := range []string{
		`C:\Users\tester\secret.txt`,
		`see C:\Users\tester\secret.txt`,
		`path=C:\Users\tester\secret.txt`,
	} {
		errs := CollectPrivacyErrors(map[string]any{"note": value})
		if !containsSubstring(errs, "local absolute path detected at $.note") {
			t.Fatalf("expected local path error for %q, got: %v", value, errs)
		}
	}
}

func TestValidateProofBundleForbiddenKeyCaseInsensitive(t *testing.T) {
	bundle := validProofBundle(t)
	bundle["Prompt"] = "private prompt"
	result := ValidateProofBundle(bundle)
	if !containsSubstring(result.Errors, "forbidden private field: $.Prompt") {
		t.Fatalf("expected case-insensitive forbidden key detection, got: %v", result.Errors)
	}
}

func TestValidateProofBundleNonObject(t *testing.T) {
	for _, value := range []any{"a string", []any{1, 2}, nil} {
		result := ValidateProofBundle(value)
		if result.OK || !containsSubstring(result.Errors, "proof bundle must be an object") {
			t.Fatalf("expected object error for %T, got: %v", value, result.Errors)
		}
	}
}

func TestValidateProofBundleEmptyRequiredStrings(t *testing.T) {
	bundle := validProofBundle(t)
	bundle["module_id"] = ""
	bundle["module_version"] = ""
	result := ValidateProofBundle(bundle)
	if !containsSubstring(result.Errors, "module_id must be a non-empty string") {
		t.Fatalf("expected module_id error, got: %v", result.Errors)
	}
	if !containsSubstring(result.Errors, "module_version must be a non-empty string") {
		t.Fatalf("expected module_version error, got: %v", result.Errors)
	}
}

func TestValidateProofBundleSignatureScheme(t *testing.T) {
	bundle := validProofBundle(t)
	bundle["signature_scheme"] = "secp256k1"
	result := ValidateProofBundle(bundle)
	if !containsSubstring(result.Errors, "signature_scheme must be ed25519") {
		t.Fatalf("expected signature_scheme error, got: %v", result.Errors)
	}
}

func TestValidateProofBundleOptionalDigestNonEmptyInvalid(t *testing.T) {
	bundle := validProofBundle(t)
	bundle["activation_event_hash"] = "not-hex"
	result := ValidateProofBundle(bundle)
	if !containsSubstring(result.Errors, "activation_event_hash must be empty or a lowercase 64-character hex digest") {
		t.Fatalf("expected optional digest error, got: %v", result.Errors)
	}
}

func TestValidateProofBundleHashNotComparedWhenOtherErrorsExist(t *testing.T) {
	bundle := validProofBundle(t)
	delete(bundle, "module_type")
	bundle["proof_bundle_hash"] = hex64("9")
	result := ValidateProofBundle(bundle)
	if containsSubstring(result.Errors, "proof_bundle_hash mismatch") {
		t.Fatalf("hash must not be compared when structural errors exist, got: %v", result.Errors)
	}
	if result.ComputedHash != "" {
		t.Fatalf("computed hash must stay empty on structural errors, got: %s", result.ComputedHash)
	}
	if result.OK {
		t.Fatal("expected invalid result")
	}
}

func containsSubstring(values []string, substr string) bool {
	for _, v := range values {
		if strings.Contains(v, substr) {
			return true
		}
	}
	return false
}
