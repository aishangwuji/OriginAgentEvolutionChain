# OriginAgent Evolution Chain Protocol

EC-1 uses canonical JSON and SHA-256 for off-chain proof hashing. Canonical JSON is UTF-8 JSON with lexicographically sorted object keys, no insignificant whitespace, and arrays kept in original order.

## Proof Bundle Hash

`proof_bundle_hash = sha256(canonical_json(proof_bundle_without_proof_bundle_hash_and_signature))`

The input is an exported OriginAgent Phase 1 proof bundle. The signature field is excluded so local unsigned and future signed bundles share the same content hash.

## Module Submission

The SDK derives chain submission fields from a verified proof bundle:

- `moduleDigest`: `0x` + `artifact_digest`
- `moduleIdHash`: SHA-256 of `module_id`
- `moduleType`: one of `skill`, `domain_pack`, `workflow`, `tool`
- `versionHash`: SHA-256 of `module_version`
- `manifestHash`: SHA-256 of `{artifact_digest,module_id,module_type,module_version}` until OriginAgent exports a full manifest hash
- `proofBundleHash`: `0x` + `proof_bundle_hash`
- `storageUri`: OCI-style artifact reference supplied by the operator

EC-2 accepts only `oci://...@sha256:<64 lowercase hex>` storage URIs. The URI digest must equal the proof bundle `artifact_digest`.

`signatureHash` and `sbomHash` are reserved for a later Cosign/SBOM stage. EC-2 documents them but does not require or verify real artifact signatures.

## Score Commit/Reveal

EC-1 fixes the blinded score hash to avoid SDK/contract ambiguity:

`commit_hash = sha256(uint8(score) || bytes32(reason_hash) || bytes32(salt))`

`score` must be an integer in `[0, 100]`. `reason_hash` is a public hash of the scorer's explanation. `salt` must be a fresh 32-byte value.

## Privacy Rule

Chain submission payloads must not contain raw prompts, file content, raw facts, full tracebacks, local absolute paths, URL query strings, raw tool outputs, hidden reasoning, or private telemetry.

## EC-3 Tool Evidence

EC-3 only promotes `module_type = "tool"` through `submit-tool-module`. Other proof bundle module types can still use older EC-2 dry-run commands, but they are outside the EC-3 validation MVP.

Evidence reports use `report_hash = sha256(canonical_json(evidence_report_without_report_hash))`. Evidence is testnet-only by default and must not be treated as transferable mainnet reputation.

Supported evidence types and offline summary weights:

- `local_client_report`: 10
- `user_signed_receipt`: 30
- `validator_report`: 60
- `unqualified_validator_report`: 0
- `foundation_seed_report`: 40

High confidence requires total score `>= 80` plus at least two qualified validator reports with different `operator_group_hash` values and different `runner_fingerprint_hash` values. Multiple reports from the same operator group or runner fingerprint are capped in the SDK summary and must not linearly increase confidence.

`validator_report` must include `external_validator_artifact_hash`. The artifact is an external-machine validation receipt containing only public digests and runner/operator hashes. It must not include prompts, local paths, raw telemetry, tool output, file contents, facts text, secrets, or URL query strings.

`VerificationRegistry.submitReport(...)` remains available as an EC-2 compatibility entrypoint and records low-weight local client evidence. EC-3 callers should prefer `submitEvidence(...)`.

## EC-4 Challenge and Testnet Reputation

EC-4 adds challenge adjudication for active evidence. It is testnet-only audit state and does not create token rewards, slashable stake, or mainnet reputation.

The chain and SDK use identical identifiers:

- `evidence_id = keccak256(abi.encode(bytes32 moduleDigest, bytes32 proofBundleHash, bytes32 reportHash, address reporter, uint8 evidenceType))`
- `challenge_id = keccak256(abi.encode(bytes32 evidenceId, address challenger, bytes32 reasonHash))`

Any address may submit a challenge against active evidence. The foundation owner is the only resolver in EC-4. A successful challenge invalidates the evidence. Testnet reputation deltas are:

- upheld challenge: challenger `+5`, challenged reporter `-10`
- rejected challenge: challenger `-2`
- self-challenge is allowed and applies both deltas; upheld self-challenge is net `-5`

Challenge records use schema version `originagent.evolution.challenge_record.v1`. Challenge summaries use `originagent.evolution.challenge_summary.v1` and expose only public hashes, addresses, statuses, invalidated evidence IDs, rejected challenge IDs, and testnet reputation deltas.

`evidence-summary --challenge-summary` excludes challenge-invalidated evidence and blocks reports from reporters whose testnet reputation is `<= -10`. Source diversity and runner diversity rules remain unchanged.
