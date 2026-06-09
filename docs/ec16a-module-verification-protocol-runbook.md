# EC-16A Module Verification Protocol Runbook

Date: 2026-05-25

## Purpose

EC-16A adds an off-chain protocol for module distribution proof, acquisition proof, verification run proof, and community work proof.

It introduces four SDK artifacts:

```text
module_manifest.v1
module_acquisition_receipt.v1
verification_run_receipt.v1
community_work_claim.v1
```

EC-16A does not modify Solidity contracts. It does not add real rewards, staking, slashing, marketplace settlement, invitation admission, company multisig recovery, TreasuryRouter, or Agent Passport caps.

## Responsibility Boundary

The accountability subject is the EVM address:

```text
responsible_address = person/company/developer/validator/operator address
```

The Agent Passport is optional execution metadata:

```text
agent_passport_id = Agent execution identity, optional
```

`agent_passport_id` cannot replace `responsible_address`. Claims without `responsible_address` are invalid.

Developers and validators are not forced to use the OriginAgent Client in EC-16A. Valid entry points include:

```text
OriginAgent Client
SDK CLI
CI bot
validator runner
sandbox runner
```

Unknown modules should be tested in a sandbox, clean test Agent, or validator runner, not installed directly into a production Agent.

## Artifact Rules

All EC-16A artifacts use `schema_version`, matching the existing SDK artifact style.

Canonical hash rules:

```text
module_manifest.v1 excludes manifest_hash
module_acquisition_receipt.v1 excludes receipt_hash
verification_run_receipt.v1 excludes receipt_hash
community_work_claim.v1 excludes claim_hash
```

URI fields identify where content can be fetched. Digest fields prove what content was fetched.

```text
storage_uri = module distribution location
module_digest = expected module content digest
proof_uri = off-chain work proof location
proof_digest = expected work proof digest
log_uri = verification log location
log_digest = expected verification log digest
```

Validation checks schema, required fields, canonical hash, address format, timestamp shape, digest shape, and privacy scan hygiene. It does not download remote content.

Audit checks linkage and business rules across artifacts. In particular, `hash_matched=false` can be structurally valid, but audit-bundle must return `ok=false` when a linked acquisition receipt did not match its expected digest.

## Module Manifest

Create:

```bash
node sdk/src/cli.ts create-module-manifest \
  --module-id ec16a-demo-module \
  --module-name "EC16A Demo Module" \
  --version 1.0.0 \
  --storage-uri https://github.com/originagent/demo-modules/releases/download/ec16a/demo-module.tgz \
  --storage-kind github_release \
  --module-digest <sha256_hex> \
  --digest-algorithm sha256 \
  --responsible-address 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --agent-passport-id 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --source-repository-uri https://github.com/originagent/demo-modules \
  --created-at 2026-05-25T00:00:00.000Z \
  --out out/ec16a-module-verification-protocol-flow/module-manifest.json
```

Validate:

```bash
node sdk/src/cli.ts validate-module-manifest out/ec16a-module-verification-protocol-flow/module-manifest.json
```

Key fields:

```text
schema_version = originagent.evolution.module_manifest.v1
storage_uri = distribution URI
module_digest = immutable module content digest
digest_algorithm = sha256 or keccak256
responsible_address = accountability address
manifest_hash = canonical artifact hash
```

## Module Acquisition Receipt

Create:

```bash
node sdk/src/cli.ts create-module-acquisition-receipt \
  --module-id ec16a-demo-module \
  --manifest-hash <manifest_hash> \
  --storage-uri https://github.com/originagent/demo-modules/releases/download/ec16a/demo-module.tgz \
  --downloaded-digest <computed_digest> \
  --expected-digest <expected_digest> \
  --hash-matched true \
  --acquired-by 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  --acquired-at 2026-05-25T00:00:00.000Z \
  --created-at 2026-05-25T00:00:00.000Z \
  --out out/ec16a-module-verification-protocol-flow/module-acquisition-receipt.json
```

Validate:

```bash
node sdk/src/cli.ts validate-module-acquisition-receipt out/ec16a-module-verification-protocol-flow/module-acquisition-receipt.json
```

If `hash_matched=false`, the artifact can still validate structurally. The audit-bundle must reject any work claim that relies on that receipt.

## Verification Run Receipt

Create:

```bash
node sdk/src/cli.ts create-verification-run-receipt \
  --module-id ec16a-demo-module \
  --manifest-hash <manifest_hash> \
  --acquisition-receipt-hash <acquisition_receipt_hash> \
  --validator-address 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  --environment-hash <environment_hash> \
  --run-result passed \
  --log-uri https://github.com/originagent/evolution-proofs/releases/download/ec16a/verification-run-log.txt \
  --log-digest <log_digest> \
  --started-at 2026-05-25T00:00:00.000Z \
  --completed-at 2026-05-25T00:05:00.000Z \
  --created-at 2026-05-25T00:06:00.000Z \
  --out out/ec16a-module-verification-protocol-flow/verification-run-receipt.json
```

Validate:

```bash
node sdk/src/cli.ts validate-verification-run-receipt out/ec16a-module-verification-protocol-flow/verification-run-receipt.json
```

`run_result` must be:

```text
passed
failed
inconclusive
```

`completed_at` must be greater than or equal to `started_at`.

Environment hash should be computed from stable environment data only:

```json
{
  "node_version": "24.x",
  "os": "linux",
  "runner_version": "ec16a-runner-v1",
  "sandbox_image_digest": "1111111111111111111111111111111111111111111111111111111111111111"
}
```

Do not include timestamps, usernames, hostnames, local paths, random values, or secrets in the environment hash input.

## Community Work Claim

Create:

```bash
node sdk/src/cli.ts create-community-work-claim \
  --claim-id ec16a-demo-testing-claim \
  --responsible-address 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --agent-passport-id 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --work-kind testing \
  --summary "Downloaded module fixture, verified digest, ran sandbox verification, and linked receipts." \
  --proof-uri https://github.com/originagent/evolution-proofs/releases/download/ec16a/community-work-proof.txt \
  --proof-digest <proof_digest> \
  --artifact-hashes <manifest_hash> <acquisition_receipt_hash> <run_receipt_hash> \
  --created-at 2026-05-25T00:07:00.000Z \
  --out out/ec16a-module-verification-protocol-flow/community-work-claim.json
```

Validate:

```bash
node sdk/src/cli.ts validate-community-work-claim out/ec16a-module-verification-protocol-flow/community-work-claim.json
```

`work_kind` must be:

```text
development
testing
audit
documentation
operation
```

The claim must include:

```text
responsible_address
proof_uri
proof_digest
artifact_hashes
```

Audit-bundle requires the claim to link at least one manifest, one acquisition receipt, and one verification run receipt.

## Audit Bundle

EC-16A audit-bundle usage:

```bash
node sdk/src/cli.ts audit-bundle \
  --events out/ec16a-module-verification-protocol-flow/events.jsonl \
  --module-manifests out/ec16a-module-verification-protocol-flow/module-manifest.json \
  --module-acquisition-receipts out/ec16a-module-verification-protocol-flow/module-acquisition-receipt.json \
  --verification-run-receipts out/ec16a-module-verification-protocol-flow/verification-run-receipt.json \
  --community-work-claims out/ec16a-module-verification-protocol-flow/community-work-claim.json \
  --network local \
  --out out/ec16a-module-verification-protocol-flow/audit-bundle.json
```

`--events` is still required because audit-bundle keeps the existing chain-context shape. EC-16A runner uses an empty `events.jsonl` fixture because this phase is off-chain artifact only.

Audit checks:

```text
all EC-16A artifact hashes validate
privacy scan passes
claim artifact_hashes resolve to supplied artifacts
claim links manifest + acquisition receipt + verification run receipt
linked acquisition receipt hash_matched is true
verification run references supplied manifest and acquisition receipt
proof_uri and proof_digest are present
```

Audit does not:

```text
download modules
download proof files
judge contribution value
compute rewards
compute reputation
settle fees
enforce role admission
```

## Runner

Run:

```bash
bash scripts/run-ec16a-module-verification-protocol-flow.sh
```

On Windows with Git Bash available but WSL unavailable:

```powershell
& 'C:\Program Files\Git\usr\bin\bash.exe' scripts/run-ec16a-module-verification-protocol-flow.sh
```

The runner:

```text
creates a fixture module file
computes sha256 module/log/proof digests
creates module_manifest.v1
creates module_acquisition_receipt.v1 with hash_matched=true
creates verification_run_receipt.v1
creates community_work_claim.v1
runs audit-bundle and asserts ok=true
creates a negative acquisition receipt with hash_matched=false
runs audit-bundle and asserts ok=false
```

Default output:

```text
out/ec16a-module-verification-protocol-flow/
```

Key outputs:

```text
module-manifest.json
module-acquisition-receipt.json
verification-run-receipt.json
community-work-claim.json
audit-bundle.json
bad-audit-bundle.json
ec16a-summary.json
ec16a-negative-summary.json
```

## Validation

Run:

```bash
npm test
npm run test:contracts
bash scripts/run-ec16a-module-verification-protocol-flow.sh
git diff --check
```

If local Foundry is unavailable, `npm run test:contracts` must be validated on a host with Foundry installed.

## Safety Boundary

EC-16A is proof and audit substrate only.

Future work remains deferred:

```text
developer/tester invitation system
company AdminController and disaster recovery
per-formal-subject Agent Passport cap
real rewards
TreasuryRouter
marketplace settlement
staking
slashing
DAO governance
public node mining rewards
airdrop-like points
```
