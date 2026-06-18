# EC-3 External Validation Result

Date: 2026-05-22

Validator runner:

- Host: `47.84.130.213`
- OS: CentOS Linux 8, kernel `4.18.0-240.10.1.el8_3.x86_64`
- CPU: 2 cores
- Memory: 431 MiB
- Node: `v24.11.1`
- npm: `11.6.2`

Commands executed on the external host:

```text
npm test
node sdk/src/cli.ts verify-proof fixtures/proof_bundle.tool.valid.json
node sdk/src/cli.ts submit-tool-module --proof-bundle fixtures/proof_bundle.tool.valid.json --storage-uri oci://registry.example/originagent/demo-tool@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --network local --dry-run
node sdk/src/cli.ts submit-validator-report --report fixtures/evidence_report.validator.valid.json --network local --dry-run
node sdk/src/cli.ts evidence-summary --reports fixtures/evidence_report.validator.valid.json fixtures/evidence_report.validator.second.valid.json
```

EC-3.5 runner command executed on the external host:

```text
bash scripts/run-ec3-external-validation.sh
```

Observed result:

```text
npm test: 32 passed
verify-proof: ok=true
submit-tool-module: dryRun=true, method=submitModule
submit-validator-report: dryRun=true, method=submitEvidence
evidence-summary: ok=true, score=120, highConfidence=true, testnetOnly=true
validate-external-validator-artifact: ok=true
```

Sanitized external validator artifact:

- File: `docs/external_validator_artifact.ec3.json`
- Canonical JSON hash: `804eab24742c919393b14b5f2638c09818361caf0200d24ecdd4b2f05eaeb491`
- File SHA-256: `dfd1844427755537d1e9840e997b21bc058a8c8b8707b3f892236281464d9b11`

This artifact contains only public digests and runner/operator hashes. It does not contain prompts, local paths, raw telemetry, raw tool outputs, file contents, facts text, secrets, or URL query strings.

Boundary:

EC-3 evidence remains sandbox-only and does not migrate to future real-Points reputation by default.
