# EC-11 Evolution Unit Kind Registry Runbook

Date: 2026-05-23

## Purpose

EC-11 adds an open `EvolutionUnitKindRegistry` so the chain does not lock Agent evolution into the legacy `ModuleRegistry.ModuleType` enum.

The registry governs ability type definitions, not concrete marketplace listings. A kind such as `tool@1`, `memory_strategy@1`, or `planner_policy@1` is defined by an off-chain proposal and review artifact, then anchored on-chain by hashes and status events.

EC-11 does not add Test Credit, token economics, DAO governance, staking, or module marketplace settlement.

## Contract Model

`EvolutionUnitKindRegistry` is deployed alongside the existing EC-10 contracts.

Core functions:

```text
proposeKind(kindIdHash, versionHash, schemaHash, proposalHash)
setReviewReport(kindIdHash, versionHash, reviewReportHash)
setKindStatus(kindIdHash, versionHash, status)
```

Rules:

```text
kindVersionKey = keccak256(abi.encode(kindIdHash, versionHash))
kindIdHash = keccak256(utf8(kind_id))
versionHash = keccak256(utf8(version))
```

`proposeKind` is open and creates `Draft`.

`setReviewReport` and `setKindStatus` are owner-only. `None` is not a valid target status.

Statuses:

```text
None
Draft
Experimental
Candidate
Canonical
Deprecated
Rejected
```

Events:

```text
EvolutionUnitKindProposed(kindVersionKey, kindIdHash, versionHash, schemaHash, proposalHash, submitter)
EvolutionUnitKindReviewSet(kindVersionKey, kindIdHash, versionHash, reviewReportHash)
EvolutionUnitKindStatusChanged(kindVersionKey, kindIdHash, versionHash, previousStatus, newStatus)
```

## Artifact Model

Proposal schema:

```text
originagent.evolution.unit_kind_proposal.v1
```

Review schema:

```text
originagent.evolution.unit_kind_review.v1
```

`kind_id` must match:

```text
^[a-z][a-z0-9_]*$
```

and be at most 64 characters.

`proposal_hash` is `hashJson(proposal_without_proposal_hash)`.

`review_hash` is `hashJson(review_without_review_hash)`.

`schema_hash` is the hash of the external schema artifact referenced by `schema_uri`; it is not the same as `proposal_hash`.

Artifacts must not contain prompts, facts, raw telemetry, local paths, URL query strings, private keys, API keys, tokens, or secret-like strings.

## CLI

Create `tool@1` proposal:

```bash
node sdk/src/cli.ts create-unit-kind-proposal \
  --kind-id tool \
  --version 1 \
  --display-name Tool \
  --description "Legacy executable tool unit kind." \
  --runtime-surface tool_call \
  --schema-hash 1111111111111111111111111111111111111111111111111111111111111111 \
  --schema-uri ipfs://unit-kind/tool/v1/schema \
  --permission-model "declared tool permissions only" \
  --verification-profile "validator tool execution replay" \
  --risk-class executable_tool \
  --sandbox-requirement "isolated process without secret access" \
  --install-semantics "install as ModuleType.Tool-compatible unit" \
  --rollback-semantics "remove unit manifest and restore previous activation" \
  --compatibility-rules "tool@1 maps to ModuleType.Tool by EC-11 audit convention" \
  --deprecation-rules "legacy mapping remains auditable after deprecation" \
  --out out/ec11-unit-kind-registry-flow/unit-kind-proposal.json
```

Broadcast proposal:

```bash
node sdk/src/cli.ts propose-unit-kind \
  --proposal out/ec11-unit-kind-registry-flow/unit-kind-proposal.json \
  --network local \
  --dry-run
```

Create review:

```bash
node sdk/src/cli.ts create-unit-kind-review \
  --kind-id tool \
  --version 1 \
  --reviewer 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --recommended-status Canonical \
  --risk-assessment "low risk compatibility kind" \
  --validation-summary-hash 2222222222222222222222222222222222222222222222222222222222222222 \
  --out out/ec11-unit-kind-registry-flow/unit-kind-review.json
```

Owner-only review/status calls:

```bash
node sdk/src/cli.ts set-unit-kind-review --review out/ec11-unit-kind-registry-flow/unit-kind-review.json --network local --dry-run
node sdk/src/cli.ts set-unit-kind-status --kind-id tool --version 1 --status Canonical --network local --dry-run
```

Broadcast requires:

```text
EVOLUTION_CHAIN_RPC_URL
EVOLUTION_CHAIN_PRIVATE_KEY
--broadcast
```

## Chain State

```bash
node sdk/src/cli.ts chain-state-check --unit-kind tool --version 1 --network local
```

Expected shape:

```json
{
  "unitKind": {
    "kindId": "tool",
    "version": "1",
    "available": true,
    "exists": true,
    "statusName": "Canonical"
  }
}
```

If a deployment lacks `EvolutionUnitKindRegistry`, `unitKind.available=false`.

## Audit Bundle

```bash
node sdk/src/cli.ts audit-bundle \
  --events out/ec11-unit-kind-registry-flow/events.jsonl \
  --unit-kind-proposals out/ec11-unit-kind-registry-flow/unit-kind-proposal.json \
  --unit-kind-reviews out/ec11-unit-kind-registry-flow/unit-kind-review.json \
  --out out/ec11-unit-kind-registry-flow/audit-bundle.json
```

Expected checks:

```text
audit-bundle.ok=true
privacy_scan.ok=true
unit_kind_linkage[0].proposal_event_matched=true
unit_kind_linkage[0].review_event_found=true
unit_kind_linkage[0].status_event_found=true
unit_kind_linkage[0].status=Canonical
```

## Legacy Mapping Boundary

EC-11 v1 does not add a contract-level foreign key between `EvolutionUnitKindRegistry` and `ModuleRegistry`.

The mapping is an audit convention:

```text
tool@1 <-> ModuleRegistry.ModuleType.Tool
```

This is intentional for v1. It keeps old EC-5 to EC-10 module submission flows working while letting the protocol define future kinds without upgrading `ModuleRegistry`.

Future EC-12+ work can add optional `kindIdHash/versionHash` fields to concrete evolution unit submissions if a stronger on-chain link is needed.

## Runner

```bash
bash scripts/run-ec11-unit-kind-registry-flow.sh
```

The runner:

```text
runs npm test
starts a fresh Anvil chain
deploys seven contracts
creates and validates tool@1 proposal
broadcasts proposeKind
creates and validates review
sets review hash
sets status to Canonical
reads chain state
indexes events
builds audit bundle
asserts audit and privacy checks
```
