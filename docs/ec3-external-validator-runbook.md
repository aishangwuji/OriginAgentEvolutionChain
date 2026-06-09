# EC-3 External Validator Runbook

EC-3 is not complete with fixtures alone. At least one `validator_report` must be produced on an independent machine outside this repository's CI.

## Validator Inputs

Use only public EC-3 material:

- tool proof bundle
- OCI artifact URI with digest
- public test fixture hashes
- validator address
- operator group hash
- runner fingerprint hash

Do not include prompts, local file paths, raw telemetry, raw tool output, facts text, secrets, URL query strings, or full logs in any submitted artifact.

## Minimal Flow

```powershell
npm test
node sdk/src/cli.ts verify-proof fixtures/proof_bundle.tool.valid.json
node sdk/src/cli.ts submit-tool-module --proof-bundle fixtures/proof_bundle.tool.valid.json --storage-uri oci://registry.example/originagent/demo-tool@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --network local --dry-run
node sdk/src/cli.ts submit-validator-report --report fixtures/evidence_report.validator.valid.json --network local --dry-run
node sdk/src/cli.ts evidence-summary --reports fixtures/evidence_report.validator.valid.json fixtures/evidence_report.validator.second.valid.json
```

EC-3.5 also provides a single runner script for independent machines:

```bash
export PATH=/opt/node-v24/bin:$PATH
bash scripts/run-ec3-external-validation.sh
```

The script writes sanitized outputs to `out/ec3-external-validation/`:

```text
external-validator-artifact.json
evidence-report.json
evidence-summary.json
submit-tool-module.json
submit-validator-report.json
```

Override public runner metadata with environment variables when needed:

```bash
VALIDATOR=0x... \
OPERATOR_GROUP_HASH=<64hex> \
RUNNER_FINGERPRINT_HASH=<64hex> \
bash scripts/run-ec3-external-validation.sh
```

## External Validator Artifact

The independent machine should produce a sanitized artifact matching `spec/schemas/external-validator-artifact.schema.json`. EC-3.5 generates and validates this through:

```bash
node sdk/src/cli.ts create-external-validator-artifact ...
node sdk/src/cli.ts validate-external-validator-artifact out/ec3-external-validation/external-validator-artifact.json
node sdk/src/cli.ts create-evidence-report ...
```

The generated evidence report automatically includes `external_validator_artifact_hash`.

The artifact proves only that a separate runner produced a public validation receipt. It is not a privacy leak and it is not mainnet reputation.

## EC-3 Boundary

Validator reports are high-weight only after foundation allowlist and source diversity checks. Reports from the same `operator_group_hash` or `runner_fingerprint_hash` are capped by the SDK summary. Invalidated reports are excluded from summary weight and do not trigger token slash in EC-3.
