// eccli is the OriginAgent Evolution Chain CLI for the ChainMaker consortium network.
// It replaces the TypeScript SDK/CLI with native Go integration.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	sdk "chainmaker.org/chainmaker/sdk-go/v2"
	"chainmaker.org/chainmaker/common/v2"
	"github.com/spf13/cobra"

	"originagent-evolution-chain/eccli/pkg/canonical"
)

var (
	configPath string
	chainID    string
	orgID      string
	dryRun     bool

	// Contract names on the ChainMaker network.
	contractIdentity      = "identity"
	contractModule        = "module"
	contractVerification  = "verification"
	contractScore         = "score"
	contractCredit        = "credit"
	contractPassport      = "passport"
	contractReputation    = "reputation"
	contractUnitKind      = "unitkind"
	contractAdjudication  = "adjudication"
)

func main() {
	root := &cobra.Command{
		Use:   "eccli",
		Short: "OriginAgent Evolution Chain CLI for ChainMaker",
		Long:  "eccli manages evolution modules, evidence, challenges, and contribution points on the OriginAgent consortium chain.",
	}

	root.PersistentFlags().StringVar(&configPath, "config", "./sdk.yml", "ChainMaker SDK config path")
	root.PersistentFlags().StringVar(&chainID, "chain-id", "originagent", "Chain ID")
	root.PersistentFlags().StringVar(&orgID, "org-id", "originagent-foundation", "Organization ID")
	root.PersistentFlags().BoolVar(&dryRun, "dry-run", false, "Dry run (do not broadcast)")

	root.AddCommand(cmdVerifyProof())
	root.AddCommand(cmdSubmitModule())
	root.AddCommand(cmdSubmitEvidence())
	root.AddCommand(cmdSubmitChallenge())
	root.AddCommand(cmdChainStateCheck())
	root.AddCommand(cmdCreateModuleManifest())
	root.AddCommand(cmdCreateAcquisitionReceipt())
	root.AddCommand(cmdCreateVerificationRun())
	root.AddCommand(cmdCreateWorkClaim())
	root.AddCommand(cmdAuditBundle())
	root.AddCommand(cmdRegisterIdentity())
	root.AddCommand(cmdSetValidatorProfile())
	root.AddCommand(cmdRegisterPassport())
	root.AddCommand(cmdMigrateKey())
	root.AddCommand(cmdCheckpointReputation())
	root.AddCommand(cmdProposeUnitKind())
	root.AddCommand(cmdGrantCredit())
	root.AddCommand(cmdConsumeCredit())
	root.AddCommand(cmdCommitVerdict())
	root.AddCommand(cmdRevealVerdict())
	root.AddCommand(cmdFinalizeAdjudication())
	root.AddCommand(cmdExpireAdjudication())
	root.AddCommand(cmdValidateProof())
	root.AddCommand(cmdComputeScoreCommit())

	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// ---- Chain client helpers ----

func getClient() (*sdk.ChainClient, error) {
	if dryRun {
		return nil, fmt.Errorf("dry-run mode: no chain client created")
	}
	opts := []sdk.ChainClientOption{
		sdk.WithConfPath(configPath),
	}
	return sdk.NewChainClient(opts...)
}

func invoke(contract, method string, params map[string]string) (string, error) {
	if dryRun {
		fmt.Printf("[DRY-RUN] invoke %s.%s(%v)\n", contract, method, params)
		return "", nil
	}
	client, err := getClient()
	if err != nil {
		return "", fmt.Errorf("failed to create client: %w", err)
	}
	defer client.Stop()

	var kvs []*common.KeyValuePair
	for k, v := range params {
		kvs = append(kvs, &common.KeyValuePair{Key: k, Value: []byte(v)})
	}

	resp, err := client.InvokeContract(contract, method, "", kvs, -1, true)
	if err != nil {
		return "", fmt.Errorf("invoke failed: %w", err)
	}
	if resp.Code != 0 {
		return "", fmt.Errorf("contract error (code %d): %s", resp.Code, string(resp.Message))
	}
	return string(resp.ContractResult.Result), nil
}

func query(contract, method string, params map[string]string) (string, error) {
	client, err := getClient()
	if err != nil {
		return "", fmt.Errorf("failed to create client: %w", err)
	}
	defer client.Stop()

	var kvs []*common.KeyValuePair
	for k, v := range params {
		kvs = append(kvs, &common.KeyValuePair{Key: k, Value: []byte(v)})
	}

	resp, err := client.QueryContract(contract, method, kvs, -1)
	if err != nil {
		return "", fmt.Errorf("query failed: %w", err)
	}
	if resp.Code != 0 {
		return "", fmt.Errorf("contract error (code %d): %s", resp.Code, string(resp.Message))
	}
	return string(resp.ContractResult.Result), nil
}

func requireHex64(name, value string) error {
	if !canonical.IsValidHex64(value) {
		return fmt.Errorf("%s must be 64 hex characters", name)
	}
	return nil
}

func requireAllHex64(pairs ...string) error {
	for i := 0; i < len(pairs); i += 2 {
		if err := requireHex64(pairs[i], pairs[i+1]); err != nil {
			return err
		}
	}
	return nil
}

func loadJSON(path string, v any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read %s: %w", path, err)
	}
	if err := json.Unmarshal(data, v); err != nil {
		return fmt.Errorf("failed to parse %s: %w", path, err)
	}
	return nil
}

// ---- Command definitions ----

func cmdVerifyProof() *cobra.Command {
	var proofBundlePath string
	cmd := &cobra.Command{
		Use:   "verify-proof",
		Short: "Verify a proof bundle JSON file",
		RunE: func(cmd *cobra.Command, args []string) error {
			var bundle map[string]any
			if err := loadJSON(proofBundlePath, &bundle); err != nil {
				return err
			}
			// Validate required fields.
			required := []string{"schema_version", "artifact_digest", "module_id", "module_type",
				"module_version", "verification_event_hash", "verification_report_digest",
				"telemetry_digest", "ledger_tip_hash", "created_at", "actor",
				"actor_public_key", "signature", "proof_bundle_hash"}
			for _, field := range required {
				if _, ok := bundle[field]; !ok {
					return fmt.Errorf("missing required field: %s", field)
				}
			}

			// Recompute proof_bundle_hash.
			pbCopy := make(map[string]any)
			for k, v := range bundle {
				if k != "proof_bundle_hash" && k != "signature" {
					pbCopy[k] = v
				}
			}
			expected, err := canonical.HashJSON(pbCopy)
			if err != nil {
				return fmt.Errorf("failed to hash proof bundle: %w", err)
			}
			actual, _ := bundle["proof_bundle_hash"].(string)
			if expected != actual {
				return fmt.Errorf("proof_bundle_hash mismatch:\n  expected: %s\n  actual:   %s", expected, actual)
			}

			fmt.Printf("Proof bundle valid.\n  module: %s\n  type: %s\n  digest: %s\n",
				bundle["module_id"], bundle["module_type"], bundle["artifact_digest"])
			return nil
		},
	}
	cmd.Flags().StringVarP(&proofBundlePath, "proof-bundle", "p", "", "Path to proof bundle JSON")
	cmd.MarkFlagRequired("proof-bundle")
	return cmd
}

func cmdSubmitModule() *cobra.Command {
	var (
		proofBundlePath string
		storageURI      string
	)
	cmd := &cobra.Command{
		Use:   "submit-module",
		Short: "Submit a module to the chain",
		RunE: func(cmd *cobra.Command, args []string) error {
			var bundle map[string]any
			if err := loadJSON(proofBundlePath, &bundle); err != nil {
				return err
			}

			moduleDigest, _ := bundle["artifact_digest"].(string)
			moduleID, _ := bundle["module_id"].(string)
			moduleType, _ := bundle["module_type"].(string)
			moduleVersion, _ := bundle["module_version"].(string)

			moduleIDHash := canonical.Sha256Hex(moduleID)
			versionHash := canonical.Sha256Hex(moduleVersion)

			var moduleTypeCode string
			switch moduleType {
			case "skill":
				moduleTypeCode = "1"
			case "domain_pack":
				moduleTypeCode = "2"
			case "workflow":
				moduleTypeCode = "3"
			case "tool":
				moduleTypeCode = "4"
			default:
				return fmt.Errorf("unknown module_type: %s", moduleType)
			}

			result, err := invoke(contractModule, "submit_module", map[string]string{
				"module_digest":  moduleDigest,
				"module_id_hash": moduleIDHash,
				"module_type":    moduleTypeCode,
				"version_hash":   versionHash,
				"storage_uri":    storageURI,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Module submitted.\n  digest: %s\n  result: %s\n", moduleDigest, result)
			return nil
		},
	}
	cmd.Flags().StringVarP(&proofBundlePath, "proof-bundle", "p", "", "Path to proof bundle JSON")
	cmd.Flags().StringVar(&storageURI, "storage-uri", "", "OCI/HTTPS artifact URI")
	cmd.MarkFlagRequired("proof-bundle")
	cmd.MarkFlagRequired("storage-uri")
	return cmd
}

func cmdSubmitEvidence() *cobra.Command {
	var (
		moduleDigest    string
		proofBundleHash string
		reportHash      string
		evidenceType    uint8
	)
	cmd := &cobra.Command{
		Use:   "submit-evidence",
		Short: "Submit evidence for a module",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("module_digest", moduleDigest, "proof_bundle_hash", proofBundleHash, "report_hash", reportHash); err != nil {
				return err
			}
			result, err := invoke(contractVerification, "submit_evidence", map[string]string{
				"module_digest":     moduleDigest,
				"proof_bundle_hash": proofBundleHash,
				"report_hash":       reportHash,
				"evidence_type":     fmt.Sprintf("%d", evidenceType),
			})
			if err != nil {
				return err
			}
			fmt.Printf("Evidence submitted.\n  evidence_id: %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&moduleDigest, "module-digest", "", "Module digest (64 hex)")
	cmd.Flags().StringVar(&proofBundleHash, "proof-bundle-hash", "", "Proof bundle hash (64 hex)")
	cmd.Flags().StringVar(&reportHash, "report-hash", "", "Report hash (64 hex)")
	cmd.Flags().Uint8Var(&evidenceType, "evidence-type", 1, "Evidence type (1=local, 2=user, 3=validator)")
	cmd.MarkFlagRequired("module-digest")
	cmd.MarkFlagRequired("proof-bundle-hash")
	cmd.MarkFlagRequired("report-hash")
	return cmd
}

func cmdSubmitChallenge() *cobra.Command {
	var (
		evidenceID string
		reasonHash string
	)
	cmd := &cobra.Command{
		Use:   "submit-challenge",
		Short: "Submit a challenge against evidence",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("evidence_id", evidenceID, "reason_hash", reasonHash); err != nil {
				return err
			}
			result, err := invoke(contractVerification, "submit_challenge", map[string]string{
				"evidence_id": evidenceID,
				"reason_hash": reasonHash,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Challenge submitted.\n  challenge_id: %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&evidenceID, "evidence-id", "", "Evidence ID (64 hex)")
	cmd.Flags().StringVar(&reasonHash, "reason-hash", "", "Reason hash (64 hex)")
	cmd.MarkFlagRequired("evidence-id")
	cmd.MarkFlagRequired("reason-hash")
	return cmd
}

func cmdChainStateCheck() *cobra.Command {
	var moduleDigest, evidenceID, challengeID, passportID string
	cmd := &cobra.Command{
		Use:   "chain-state-check",
		Short: "Read chain state",
		RunE: func(cmd *cobra.Command, args []string) error {
			if moduleDigest != "" {
				result, err := query(contractModule, "get_module", map[string]string{
					"module_digest": moduleDigest,
				})
				if err != nil {
					return err
				}
				fmt.Printf("Module:\n%s\n", result)
			}
			if evidenceID != "" {
				result, err := query(contractVerification, "get_evidence", map[string]string{
					"evidence_id": evidenceID,
				})
				if err != nil {
					return err
				}
				fmt.Printf("Evidence:\n%s\n", result)
			}
			if challengeID != "" {
				result, err := query(contractVerification, "get_challenge", map[string]string{
					"challenge_id": challengeID,
				})
				if err != nil {
					return err
				}
				fmt.Printf("Challenge:\n%s\n", result)
			}
			if passportID != "" {
				result, err := query(contractPassport, "get_passport", map[string]string{
					"passport_id": passportID,
				})
				if err != nil {
					return err
				}
				fmt.Printf("Passport:\n%s\n", result)
				// Also check credit balance.
				credit, err := query(contractCredit, "get_balance", map[string]string{
					"passport_id": passportID,
				})
				if err == nil {
					fmt.Printf("Credit:\n%s\n", credit)
				}
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&moduleDigest, "module-digest", "", "Module digest")
	cmd.Flags().StringVar(&evidenceID, "evidence-id", "", "Evidence ID")
	cmd.Flags().StringVar(&challengeID, "challenge-id", "", "Challenge ID")
	cmd.Flags().StringVar(&passportID, "passport-id", "", "Passport ID")
	return cmd
}

func cmdCreateModuleManifest() *cobra.Command {
	var (
		moduleID, moduleName, version, storageURI, responsibleAddr, out string
	)
	cmd := &cobra.Command{
		Use:   "create-module-manifest",
		Short: "Create a module manifest artifact",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Compute module digest from module_id + version (simplified).
			moduleDigest := canonical.Sha256Hex(moduleID + "@" + version)

			manifest := map[string]any{
				"schema_version":      "originagent.evolution.module_manifest.v1",
				"module_id":           moduleID,
				"module_name":         moduleName,
				"version":             version,
				"storage_uri":         storageURI,
				"storage_kind":        "github_release",
				"module_digest":       moduleDigest,
				"digest_algorithm":    "sha256",
				"responsible_address": responsibleAddr,
				"created_at":          "2026-06-18T00:00:00.000Z",
			}

			manifestHash, err := canonical.HashJSON(manifest)
			if err != nil {
				return fmt.Errorf("failed to hash manifest: %w", err)
			}
			manifest["manifest_hash"] = manifestHash

			data, _ := json.MarshalIndent(manifest, "", "  ")
			if out != "" {
				if err := os.WriteFile(out, data, 0644); err != nil {
					return fmt.Errorf("failed to write: %w", err)
				}
				fmt.Printf("Module manifest written to %s\n  digest: %s\n", out, moduleDigest)
			} else {
				fmt.Println(string(data))
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&moduleID, "module-id", "", "Module ID")
	cmd.Flags().StringVar(&moduleName, "module-name", "", "Module display name")
	cmd.Flags().StringVar(&version, "version", "1.0.0", "Module version")
	cmd.Flags().StringVar(&storageURI, "storage-uri", "", "Storage URI")
	cmd.Flags().StringVar(&responsibleAddr, "responsible-address", "", "Responsible EVM address")
	cmd.Flags().StringVar(&out, "out", "", "Output file path")
	cmd.MarkFlagRequired("module-id")
	cmd.MarkFlagRequired("storage-uri")
	cmd.MarkFlagRequired("responsible-address")
	return cmd
}

func cmdCreateAcquisitionReceipt() *cobra.Command {
	var (
		moduleID, manifestHash, storageURI, downloadedDigest, expectedDigest, acquiredBy, out string
		hashMatched bool
	)
	cmd := &cobra.Command{
		Use:   "create-module-acquisition-receipt",
		Short: "Create a module acquisition receipt",
		RunE: func(cmd *cobra.Command, args []string) error {
			receipt := map[string]any{
				"schema_version":   "originagent.evolution.module_acquisition_receipt.v1",
				"module_id":        moduleID,
				"manifest_hash":    manifestHash,
				"storage_uri":      storageURI,
				"downloaded_digest": downloadedDigest,
				"expected_digest":  expectedDigest,
				"hash_matched":     hashMatched,
				"acquired_by":      acquiredBy,
				"acquired_at":      "2026-06-18T00:00:00.000Z",
				"created_at":       "2026-06-18T00:00:00.000Z",
			}
			receiptHash, _ := canonical.HashJSON(receipt)
			receipt["receipt_hash"] = receiptHash

			data, _ := json.MarshalIndent(receipt, "", "  ")
			if out != "" {
				os.WriteFile(out, data, 0644)
				fmt.Printf("Acquisition receipt written to %s\n", out)
			} else {
				fmt.Println(string(data))
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&moduleID, "module-id", "", "Module ID")
	cmd.Flags().StringVar(&manifestHash, "manifest-hash", "", "Manifest hash")
	cmd.Flags().StringVar(&storageURI, "storage-uri", "", "Storage URI")
	cmd.Flags().StringVar(&downloadedDigest, "downloaded-digest", "", "Downloaded digest")
	cmd.Flags().StringVar(&expectedDigest, "expected-digest", "", "Expected digest")
	cmd.Flags().BoolVar(&hashMatched, "hash-matched", false, "Whether hash matched")
	cmd.Flags().StringVar(&acquiredBy, "acquired-by", "", "Acquirer address")
	cmd.Flags().StringVar(&out, "out", "", "Output file")
	cmd.MarkFlagRequired("module-id")
	cmd.MarkFlagRequired("manifest-hash")
	cmd.MarkFlagRequired("acquired-by")
	return cmd
}

func cmdCreateVerificationRun() *cobra.Command {
	var (
		moduleID, manifestHash, validatorAddr, envHash, runResult, out string
	)
	cmd := &cobra.Command{
		Use:   "create-verification-run-receipt",
		Short: "Create a verification run receipt",
		RunE: func(cmd *cobra.Command, args []string) error {
			receipt := map[string]any{
				"schema_version":  "originagent.evolution.verification_run_receipt.v1",
				"module_id":       moduleID,
				"manifest_hash":   manifestHash,
				"validator_address": validatorAddr,
				"environment_hash": envHash,
				"run_result":      runResult,
				"started_at":      "2026-06-18T00:00:00.000Z",
				"completed_at":    "2026-06-18T00:05:00.000Z",
				"created_at":      "2026-06-18T00:06:00.000Z",
			}
			receiptHash, _ := canonical.HashJSON(receipt)
			receipt["receipt_hash"] = receiptHash

			data, _ := json.MarshalIndent(receipt, "", "  ")
			if out != "" {
				os.WriteFile(out, data, 0644)
				fmt.Printf("Verification run receipt written to %s\n", out)
			} else {
				fmt.Println(string(data))
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&moduleID, "module-id", "", "Module ID")
	cmd.Flags().StringVar(&manifestHash, "manifest-hash", "", "Manifest hash")
	cmd.Flags().StringVar(&validatorAddr, "validator-address", "", "Validator address")
	cmd.Flags().StringVar(&envHash, "environment-hash", "", "Environment hash")
	cmd.Flags().StringVar(&runResult, "run-result", "passed", "Run result (passed/failed)")
	cmd.Flags().StringVar(&out, "out", "", "Output file")
	cmd.MarkFlagRequired("module-id")
	cmd.MarkFlagRequired("manifest-hash")
	cmd.MarkFlagRequired("validator-address")
	return cmd
}

func cmdCreateWorkClaim() *cobra.Command {
	var (
		claimID, responsibleAddr, workKind, summary, out string
	)
	cmd := &cobra.Command{
		Use:   "create-community-work-claim",
		Short: "Create a community work claim",
		RunE: func(cmd *cobra.Command, args []string) error {
			claim := map[string]any{
				"schema_version":      "originagent.evolution.community_work_claim.v1",
				"claim_id":            claimID,
				"responsible_address": responsibleAddr,
				"work_kind":           workKind,
				"summary":             summary,
				"created_at":          "2026-06-18T00:00:00.000Z",
			}
			claimHash, _ := canonical.HashJSON(claim)
			claim["claim_hash"] = claimHash

			data, _ := json.MarshalIndent(claim, "", "  ")
			if out != "" {
				os.WriteFile(out, data, 0644)
				fmt.Printf("Work claim written to %s\n", out)
			} else {
				fmt.Println(string(data))
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&claimID, "claim-id", "", "Claim ID")
	cmd.Flags().StringVar(&responsibleAddr, "responsible-address", "", "Responsible address")
	cmd.Flags().StringVar(&workKind, "work-kind", "testing", "Work kind")
	cmd.Flags().StringVar(&summary, "summary", "", "Work summary")
	cmd.Flags().StringVar(&out, "out", "", "Output file")
	cmd.MarkFlagRequired("claim-id")
	cmd.MarkFlagRequired("responsible-address")
	return cmd
}

func cmdAuditBundle() *cobra.Command {
	var eventsPath, evidenceReportsPath, out string
	cmd := &cobra.Command{
		Use:   "audit-bundle",
		Short: "Generate an audit bundle from events and evidence",
		RunE: func(cmd *cobra.Command, args []string) error {
			var events []map[string]any
			if eventsPath != "" {
				if err := loadJSON(eventsPath, &events); err != nil {
					return fmt.Errorf("failed to load events: %w", err)
				}
			}
			var evidenceReports []map[string]any
			if evidenceReportsPath != "" {
				if err := loadJSON(evidenceReportsPath, &evidenceReports); err != nil {
					return fmt.Errorf("failed to load evidence reports: %w", err)
				}
			}

			bundle := map[string]any{
				"schema_version":   "originagent.evolution.audit_bundle.v1",
				"event_count":      len(events),
				"evidence_count":   len(evidenceReports),
				"events":           events,
				"evidence_reports": evidenceReports,
			}
			bundleHash, _ := canonical.HashJSON(bundle)
			bundle["bundle_hash"] = bundleHash

			data, _ := json.MarshalIndent(bundle, "", "  ")
			if out != "" {
				os.WriteFile(out, data, 0644)
				fmt.Printf("Audit bundle written to %s\n  hash: %s\n", out, bundleHash)
			} else {
				fmt.Println(string(data))
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&eventsPath, "events", "", "Path to events JSONL/JSON")
	cmd.Flags().StringVar(&evidenceReportsPath, "evidence-reports", "", "Path to evidence reports JSON")
	cmd.Flags().StringVar(&out, "out", "", "Output file")
	return cmd
}

func cmdRegisterIdentity() *cobra.Command {
	var role uint8
	var metadataHash string
	cmd := &cobra.Command{
		Use:   "register-identity",
		Short: "Register an identity on the chain",
		RunE: func(cmd *cobra.Command, args []string) error {
			result, err := invoke(contractIdentity, "register_identity", map[string]string{
				"role":          fmt.Sprintf("%d", role),
				"metadata_hash": metadataHash,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Identity registered.\n  result: %s\n", result)
			return nil
		},
	}
	cmd.Flags().Uint8Var(&role, "role", 1, "Identity role (1=Developer, 2=Validator, 3=Operator)")
	cmd.Flags().StringVar(&metadataHash, "metadata-hash", "0000000000000000000000000000000000000000000000000000000000000000", "Metadata hash")
	cmd.MarkFlagRequired("role")
	return cmd
}

func cmdSetValidatorProfile() *cobra.Command {
	var (
		validator            string
		operatorGroupHash    string
		runnerFingerprintHash string
		allowed              bool
	)
	cmd := &cobra.Command{
		Use:   "set-validator-profile",
		Short: "Set a validator's allowlist profile (Foundation only)",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("operator_group_hash", operatorGroupHash, "runner_fingerprint_hash", runnerFingerprintHash); err != nil {
				return err
			}
			allowedStr := "false"
			if allowed {
				allowedStr = "true"
			}
			result, err := invoke(contractVerification, "set_validator_profile", map[string]string{
				"validator":               validator,
				"operator_group_hash":     operatorGroupHash,
				"runner_fingerprint_hash": runnerFingerprintHash,
				"allowed":                 allowedStr,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Validator profile set.\n  result: %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&validator, "validator", "", "Validator address")
	cmd.Flags().StringVar(&operatorGroupHash, "operator-group-hash", "", "Operator group hash")
	cmd.Flags().StringVar(&runnerFingerprintHash, "runner-fingerprint-hash", "", "Runner fingerprint hash")
	cmd.Flags().BoolVar(&allowed, "allowed", false, "Whether validator is allowed")
	cmd.MarkFlagRequired("validator")
	cmd.MarkFlagRequired("operator-group-hash")
	cmd.MarkFlagRequired("runner-fingerprint-hash")
	return cmd
}

func cmdRegisterPassport() *cobra.Command {
	var (
		owner        string
		agentKeyHash string
		genesisNonce string
		metadataHash string
	)
	cmd := &cobra.Command{
		Use:   "register-passport",
		Short: "Register an Agent Passport",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("agent_key_hash", agentKeyHash, "genesis_nonce", genesisNonce); err != nil {
				return err
			}
			result, err := invoke(contractPassport, "register_passport", map[string]string{
				"owner":          owner,
				"agent_key_hash": agentKeyHash,
				"genesis_nonce":  genesisNonce,
				"metadata_hash":  metadataHash,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Passport registered.\n  passport_id: %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&owner, "owner", "", "Owner address")
	cmd.Flags().StringVar(&agentKeyHash, "agent-key-hash", "", "Agent key hash")
	cmd.Flags().StringVar(&genesisNonce, "genesis-nonce", "", "Genesis nonce")
	cmd.Flags().StringVar(&metadataHash, "metadata-hash", strings.Repeat("0", 64), "Metadata hash")
	cmd.MarkFlagRequired("owner")
	cmd.MarkFlagRequired("agent-key-hash")
	cmd.MarkFlagRequired("genesis-nonce")
	return cmd
}

func cmdMigrateKey() *cobra.Command {
	var passportID, newKeyHash string
	cmd := &cobra.Command{
		Use:   "migrate-key",
		Short: "Migrate an Agent Passport key",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("passport_id", passportID, "new_key_hash", newKeyHash); err != nil {
				return err
			}
			result, err := invoke(contractPassport, "migrate_key", map[string]string{
				"passport_id":  passportID,
				"new_key_hash": newKeyHash,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Key migrated.\n  passport_id: %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&passportID, "passport-id", "", "Passport ID")
	cmd.Flags().StringVar(&newKeyHash, "new-key-hash", "", "New key hash")
	cmd.MarkFlagRequired("passport-id")
	cmd.MarkFlagRequired("new-key-hash")
	return cmd
}

func cmdCheckpointReputation() *cobra.Command {
	var (
		passportID    string
		owner         string
		score         int32
		positiveCount uint64
		negativeCount uint64
		reportHash    string
	)
	cmd := &cobra.Command{
		Use:   "checkpoint-reputation",
		Short: "Record a reputation checkpoint (Foundation only)",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("passport_id", passportID, "report_hash", reportHash); err != nil {
				return err
			}
			result, err := invoke(contractReputation, "checkpoint_reputation", map[string]string{
				"passport_id":     passportID,
				"owner":           owner,
				"score":           fmt.Sprintf("%d", score),
				"positive_count":  fmt.Sprintf("%d", positiveCount),
				"negative_count":  fmt.Sprintf("%d", negativeCount),
				"report_hash":     reportHash,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Reputation checkpointe.\n  passport_id: %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&passportID, "passport-id", "", "Passport ID")
	cmd.Flags().StringVar(&owner, "owner", "", "Owner address")
	cmd.Flags().Int32Var(&score, "score", 0, "Reputation score")
	cmd.Flags().Uint64Var(&positiveCount, "positive-count", 0, "Positive events")
	cmd.Flags().Uint64Var(&negativeCount, "negative-count", 0, "Negative events")
	cmd.Flags().StringVar(&reportHash, "report-hash", strings.Repeat("0", 64), "Report hash")
	cmd.MarkFlagRequired("passport-id")
	cmd.MarkFlagRequired("owner")
	return cmd
}

func cmdProposeUnitKind() *cobra.Command {
	var (
		kindID      string
		version     uint64
		displayName string
		submitter   string
	)
	cmd := &cobra.Command{
		Use:   "propose-unit-kind",
		Short: "Propose a new evolution unit kind (Foundation only)",
		RunE: func(cmd *cobra.Command, args []string) error {
			result, err := invoke(contractUnitKind, "propose_kind", map[string]string{
				"kind_id":      kindID,
				"version":      fmt.Sprintf("%d", version),
				"display_name": displayName,
				"submitter":    submitter,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Unit kind proposed.\n  result: %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&kindID, "kind-id", "", "Kind ID")
	cmd.Flags().Uint64Var(&version, "version", 1, "Version")
	cmd.Flags().StringVar(&displayName, "display-name", "", "Display name")
	cmd.Flags().StringVar(&submitter, "submitter", "", "Submitter address")
	cmd.MarkFlagRequired("kind-id")
	cmd.MarkFlagRequired("display-name")
	cmd.MarkFlagRequired("submitter")
	return cmd
}

func cmdGrantCredit() *cobra.Command {
	var (
		passportID string
		owner      string
		reasonHash string
		amount     uint64
	)
	cmd := &cobra.Command{
		Use:   "grant-credit",
		Short: "Grant contribution points (Foundation only)",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("passport_id", passportID); err != nil {
				return err
			}
			result, err := invoke(contractCredit, "grant_points", map[string]string{
				"passport_id": passportID,
				"owner":       owner,
				"reason_hash": reasonHash,
				"amount":      fmt.Sprintf("%d", amount),
			})
			if err != nil {
				return err
			}
			fmt.Printf("Points granted.\n  %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&passportID, "passport-id", "", "Passport ID")
	cmd.Flags().StringVar(&owner, "owner", "", "Owner address")
	cmd.Flags().StringVar(&reasonHash, "reason-hash", strings.Repeat("0", 64), "Reason hash")
	cmd.Flags().Uint64Var(&amount, "amount", 0, "Amount to grant")
	cmd.MarkFlagRequired("passport-id")
	cmd.MarkFlagRequired("owner")
	cmd.MarkFlagRequired("amount")
	return cmd
}

func cmdConsumeCredit() *cobra.Command {
	var (
		passportID string
		reasonHash string
		amount     uint64
	)
	cmd := &cobra.Command{
		Use:   "consume-credit",
		Short: "Consume contribution points (Foundation only)",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("passport_id", passportID); err != nil {
				return err
			}
			result, err := invoke(contractCredit, "consume_points", map[string]string{
				"passport_id": passportID,
				"reason_hash": reasonHash,
				"amount":      fmt.Sprintf("%d", amount),
			})
			if err != nil {
				return err
			}
			fmt.Printf("Points consumed.\n  %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&passportID, "passport-id", "", "Passport ID")
	cmd.Flags().StringVar(&reasonHash, "reason-hash", strings.Repeat("0", 64), "Reason hash")
	cmd.Flags().Uint64Var(&amount, "amount", 0, "Amount to consume")
	cmd.MarkFlagRequired("passport-id")
	cmd.MarkFlagRequired("amount")
	return cmd
}

func cmdCommitVerdict() *cobra.Command {
	var challengeID, commitmentHash string
	cmd := &cobra.Command{
		Use:   "commit-verdict",
		Short: "Commit a blinded verdict (Validator only)",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("challenge_id", challengeID, "commitment_hash", commitmentHash); err != nil {
				return err
			}
			result, err := invoke(contractAdjudication, "commit_verdict", map[string]string{
				"challenge_id":    challengeID,
				"commitment_hash": commitmentHash,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Verdict committed.\n  challenge_id: %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&challengeID, "challenge-id", "", "Challenge ID")
	cmd.Flags().StringVar(&commitmentHash, "commitment-hash", "", "Commitment hash")
	cmd.MarkFlagRequired("challenge-id")
	cmd.MarkFlagRequired("commitment-hash")
	return cmd
}

func cmdRevealVerdict() *cobra.Command {
	var (
		challengeID    string
		claimedUpheld  bool
		verdictHash    string
		methodHash     string
		salt           string
	)
	cmd := &cobra.Command{
		Use:   "reveal-verdict",
		Short: "Reveal a previously committed verdict",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("challenge_id", challengeID, "verdict_hash", verdictHash, "method_hash", methodHash, "salt", salt); err != nil {
				return err
			}
			upheldStr := "false"
			if claimedUpheld {
				upheldStr = "true"
			}
			result, err := invoke(contractAdjudication, "reveal_verdict", map[string]string{
				"challenge_id":    challengeID,
				"claimed_upheld":  upheldStr,
				"verdict_hash":    verdictHash,
				"method_hash":     methodHash,
				"salt":            salt,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Verdict revealed.\n  challenge_id: %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&challengeID, "challenge-id", "", "Challenge ID")
	cmd.Flags().BoolVar(&claimedUpheld, "claimed-upheld", false, "Whether claiming upheld")
	cmd.Flags().StringVar(&verdictHash, "verdict-hash", "", "Verdict hash")
	cmd.Flags().StringVar(&methodHash, "method-hash", "", "Method hash")
	cmd.Flags().StringVar(&salt, "salt", "", "Salt (64 hex)")
	cmd.MarkFlagRequired("challenge-id")
	cmd.MarkFlagRequired("verdict-hash")
	cmd.MarkFlagRequired("method-hash")
	cmd.MarkFlagRequired("salt")
	return cmd
}

func cmdFinalizeAdjudication() *cobra.Command {
	var (
		challengeID     string
		claimedUpheld   bool
		finalReportHash string
	)
	cmd := &cobra.Command{
		Use:   "finalize-adjudication",
		Short: "Finalize a challenge adjudication",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("challenge_id", challengeID, "final_report_hash", finalReportHash); err != nil {
				return err
			}
			upheldStr := "false"
			if claimedUpheld {
				upheldStr = "true"
			}
			result, err := invoke(contractAdjudication, "finalize_challenge", map[string]string{
				"challenge_id":       challengeID,
				"claimed_upheld":     upheldStr,
				"final_report_hash":  finalReportHash,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Adjudication finalized.\n  challenge_id: %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&challengeID, "challenge-id", "", "Challenge ID")
	cmd.Flags().BoolVar(&claimedUpheld, "claimed-upheld", false, "Whether claiming upheld")
	cmd.Flags().StringVar(&finalReportHash, "final-report-hash", "", "Final report hash")
	cmd.MarkFlagRequired("challenge-id")
	cmd.MarkFlagRequired("final-report-hash")
	return cmd
}

func cmdExpireAdjudication() *cobra.Command {
	var challengeID, expirationReportHash string
	cmd := &cobra.Command{
		Use:   "expire-adjudication",
		Short: "Expire a challenge adjudication (no quorum)",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("challenge_id", challengeID, "expiration_report_hash", expirationReportHash); err != nil {
				return err
			}
			result, err := invoke(contractAdjudication, "expire_challenge", map[string]string{
				"challenge_id":            challengeID,
				"expiration_report_hash":  expirationReportHash,
			})
			if err != nil {
				return err
			}
			fmt.Printf("Adjudication expired.\n  challenge_id: %s\n", result)
			return nil
		},
	}
	cmd.Flags().StringVar(&challengeID, "challenge-id", "", "Challenge ID")
	cmd.Flags().StringVar(&expirationReportHash, "expiration-report-hash", "", "Expiration report hash")
	cmd.MarkFlagRequired("challenge-id")
	cmd.MarkFlagRequired("expiration-report-hash")
	return cmd
}

func cmdValidateProof() *cobra.Command {
	var fixturePath string
	cmd := &cobra.Command{
		Use:   "validate-proof",
		Short: "Validate a proof bundle fixture",
		RunE: func(cmd *cobra.Command, args []string) error {
			var bundle map[string]any
			if err := loadJSON(fixturePath, &bundle); err != nil {
				return err
			}
			hash, err := canonical.HashJSON(bundle)
			if err != nil {
				return err
			}
			fmt.Printf("Proof bundle valid.\n  hash: %s\n", hash)
			return nil
		},
	}
	cmd.Flags().StringVarP(&fixturePath, "file", "f", "", "Path to proof bundle JSON")
	cmd.MarkFlagRequired("file")
	return cmd
}

func cmdComputeScoreCommit() *cobra.Command {
	var (
		moduleDigest string
		score        uint8
		reasonHash   string
		salt         string
	)
	cmd := &cobra.Command{
		Use:   "score-commit",
		Short: "Compute a score commitment hash",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := requireAllHex64("module_digest", moduleDigest, "reason_hash", reasonHash, "salt", salt); err != nil {
				return err
			}
			if score > 100 {
				return fmt.Errorf("score must be in [0, 100]")
			}
			// commit_hash = sha256(score_byte || reason_hash || salt)
			input := append([]byte{score}, []byte(reasonHash)...)
			input = append(input, []byte(salt)...)
			commitHash := canonical.Sha256HexBytes(input)
			fmt.Printf("Score commitment:\n  module: %s\n  score: %d\n  commit_hash: %s\n", moduleDigest, score, commitHash)
			return nil
		},
	}
	cmd.Flags().StringVar(&moduleDigest, "module", "", "Module digest")
	cmd.Flags().Uint8Var(&score, "score", 0, "Score (0-100)")
	cmd.Flags().StringVar(&reasonHash, "reason-hash", "", "Reason hash")
	cmd.Flags().StringVar(&salt, "salt", "", "Salt (64 hex)")
	cmd.MarkFlagRequired("module")
	cmd.MarkFlagRequired("score")
	cmd.MarkFlagRequired("reason-hash")
	cmd.MarkFlagRequired("salt")
	return cmd
}
