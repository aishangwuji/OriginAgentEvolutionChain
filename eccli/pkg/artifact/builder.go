// Package artifact provides creation and validation of evolution chain artifacts:
// module manifests, acquisition receipts, verification run receipts, and community work claims.
package artifact

import (
	"fmt"
	"regexp"

	"originagent-evolution-chain/eccli/pkg/canonical"
)

// ParsedOciURI holds a parsed OCI artifact reference.
type ParsedOciURI struct {
	URI    string
	Digest string
}

var ociURIRe = regexp.MustCompile(`^oci://[^\s"'<>?]+@sha256:([0-9a-f]{64})$`)

// ParseOciArtifactURI validates and parses an OCI artifact URI.
func ParseOciArtifactURI(uri string) (*ParsedOciURI, error) {
	match := ociURIRe.FindStringSubmatch(uri)
	if match == nil {
		return nil, fmt.Errorf("storageUri must match oci://...@sha256:<64 lowercase hex>")
	}
	return &ParsedOciURI{URI: uri, Digest: match[1]}, nil
}

// AssertOciDigestMatches validates the OCI URI digest equals the artifact digest.
func AssertOciDigestMatches(uri, artifactDigest string) (*ParsedOciURI, error) {
	parsed, err := ParseOciArtifactURI(uri)
	if err != nil {
		return nil, err
	}
	if parsed.Digest != artifactDigest {
		return nil, fmt.Errorf("storageUri digest must match artifact_digest")
	}
	return parsed, nil
}

// ModuleManifest represents a module distribution artifact.
type ModuleManifest struct {
	SchemaVersion     string `json:"schema_version"`
	ModuleID          string `json:"module_id"`
	ModuleName        string `json:"module_name"`
	Version           string `json:"version"`
	StorageURI        string `json:"storage_uri"`
	StorageKind       string `json:"storage_kind"`
	ModuleDigest      string `json:"module_digest"`
	DigestAlgorithm   string `json:"digest_algorithm"`
	ResponsibleAddr   string `json:"responsible_address"`
	CreatedAt         string `json:"created_at"`
	ManifestHash      string `json:"manifest_hash,omitempty"`
}

// NewModuleManifest creates a module manifest and computes its hash.
func NewModuleManifest(moduleID, moduleName, version, storageURI, storageKind, responsibleAddr, createdAt string) (*ModuleManifest, error) {
	moduleDigest := canonical.Sha256Hex(moduleID + "@" + version)

	m := &ModuleManifest{
		SchemaVersion:   "originagent.evolution.module_manifest.v1",
		ModuleID:        moduleID,
		ModuleName:      moduleName,
		Version:         version,
		StorageURI:      storageURI,
		StorageKind:     storageKind,
		ModuleDigest:    moduleDigest,
		DigestAlgorithm: "sha256",
		ResponsibleAddr: responsibleAddr,
		CreatedAt:       createdAt,
	}

	hash, err := canonical.HashJSON(m)
	if err != nil {
		return nil, fmt.Errorf("failed to hash manifest: %w", err)
	}
	m.ManifestHash = hash
	return m, nil
}

// AcquisitionReceipt records that an artifact was downloaded and verified.
type AcquisitionReceipt struct {
	SchemaVersion    string `json:"schema_version"`
	ModuleID         string `json:"module_id"`
	ManifestHash     string `json:"manifest_hash"`
	StorageURI       string `json:"storage_uri"`
	DownloadedDigest string `json:"downloaded_digest"`
	ExpectedDigest   string `json:"expected_digest"`
	HashMatched      bool   `json:"hash_matched"`
	AcquiredBy       string `json:"acquired_by"`
	AcquiredAt       string `json:"acquired_at"`
	CreatedAt        string `json:"created_at"`
	ReceiptHash      string `json:"receipt_hash,omitempty"`
}

// NewAcquisitionReceipt creates an acquisition receipt.
func NewAcquisitionReceipt(moduleID, manifestHash, storageURI, downloadedDigest, expectedDigest, acquiredBy, acquiredAt, createdAt string, hashMatched bool) (*AcquisitionReceipt, error) {
	r := &AcquisitionReceipt{
		SchemaVersion:    "originagent.evolution.module_acquisition_receipt.v1",
		ModuleID:         moduleID,
		ManifestHash:     manifestHash,
		StorageURI:       storageURI,
		DownloadedDigest: downloadedDigest,
		ExpectedDigest:   expectedDigest,
		HashMatched:      hashMatched,
		AcquiredBy:       acquiredBy,
		AcquiredAt:       acquiredAt,
		CreatedAt:        createdAt,
	}
	hash, err := canonical.HashJSON(r)
	if err != nil {
		return nil, fmt.Errorf("failed to hash receipt: %w", err)
	}
	r.ReceiptHash = hash
	return r, nil
}

// VerificationRunReceipt records a sandbox or validator-run execution result.
type VerificationRunReceipt struct {
	SchemaVersion    string `json:"schema_version"`
	ModuleID         string `json:"module_id"`
	ManifestHash     string `json:"manifest_hash"`
	ValidatorAddr    string `json:"validator_address"`
	EnvironmentHash  string `json:"environment_hash"`
	RunResult        string `json:"run_result"`
	LogURI           string `json:"log_uri,omitempty"`
	LogDigest        string `json:"log_digest,omitempty"`
	StartedAt        string `json:"started_at"`
	CompletedAt      string `json:"completed_at"`
	CreatedAt        string `json:"created_at"`
	ReceiptHash      string `json:"receipt_hash,omitempty"`
}

// NewVerificationRunReceipt creates a verification run receipt.
func NewVerificationRunReceipt(moduleID, manifestHash, validatorAddr, envHash, runResult, logURI, logDigest, startedAt, completedAt, createdAt string) (*VerificationRunReceipt, error) {
	r := &VerificationRunReceipt{
		SchemaVersion:   "originagent.evolution.verification_run_receipt.v1",
		ModuleID:        moduleID,
		ManifestHash:    manifestHash,
		ValidatorAddr:   validatorAddr,
		EnvironmentHash: envHash,
		RunResult:       runResult,
		LogURI:          logURI,
		LogDigest:       logDigest,
		StartedAt:       startedAt,
		CompletedAt:     completedAt,
		CreatedAt:       createdAt,
	}
	hash, err := canonical.HashJSON(r)
	if err != nil {
		return nil, fmt.Errorf("failed to hash run receipt: %w", err)
	}
	r.ReceiptHash = hash
	return r, nil
}

// CommunityWorkClaim records a community work proof.
type CommunityWorkClaim struct {
	SchemaVersion     string   `json:"schema_version"`
	ClaimID           string   `json:"claim_id"`
	ResponsibleAddr   string   `json:"responsible_address"`
	WorkKind          string   `json:"work_kind"`
	Summary           string   `json:"summary"`
	ProofURI          string   `json:"proof_uri,omitempty"`
	ProofDigest       string   `json:"proof_digest,omitempty"`
	ArtifactHashes    []string `json:"artifact_hashes,omitempty"`
	CreatedAt         string   `json:"created_at"`
	ClaimHash         string   `json:"claim_hash,omitempty"`
}

// NewCommunityWorkClaim creates a community work claim.
func NewCommunityWorkClaim(claimID, responsibleAddr, workKind, summary, proofURI, proofDigest, createdAt string, artifactHashes []string) (*CommunityWorkClaim, error) {
	if artifactHashes == nil {
		artifactHashes = []string{}
	}
	c := &CommunityWorkClaim{
		SchemaVersion:   "originagent.evolution.community_work_claim.v1",
		ClaimID:         claimID,
		ResponsibleAddr: responsibleAddr,
		WorkKind:        workKind,
		Summary:         summary,
		ProofURI:        proofURI,
		ProofDigest:     proofDigest,
		ArtifactHashes:  artifactHashes,
		CreatedAt:       createdAt,
	}
	hash, err := canonical.HashJSON(c)
	if err != nil {
		return nil, fmt.Errorf("failed to hash work claim: %w", err)
	}
	c.ClaimHash = hash
	return c, nil
}
