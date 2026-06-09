# EC-11 Unit Kind Registry Validation Result

Date: 2026-05-23

## Scope

EC-11 adds `EvolutionUnitKindRegistry`, unit kind proposal/review artifacts, unit kind transactions, chain-state unit kind reads, event indexing, and audit-bundle linkage.

EC-11 does not modify `ModuleRegistry` enum or legacy module submission flow.

## Local Validation

SDK tests:

```text
npm test
80 passed
```

Solidity compile smoke:

```text
npx --yes solc --bin contracts/src/IdentityRegistry.sol contracts/src/AgentPassportRegistry.sol contracts/src/AgentReputationRegistry.sol contracts/src/EvolutionUnitKindRegistry.sol contracts/src/ModuleRegistry.sol contracts/src/VerificationRegistry.sol contracts/src/ScoreCommitReveal.sol
passed
```

Contract tests:

```text
npm run test:contracts
not run locally: forge is not installed in the Windows shell
```

## Verified SDK Behavior

```text
Unit kind proposal validates required fields and stable proposal_hash.
Unit kind review validates required fields and stable review_hash.
kind_id must match ^[a-z][a-z0-9_]*$ and be at most 64 characters.
proposal/review privacy scan rejects forbidden private fields and sensitive strings.
CLI create/validate commands write and validate proposal/review artifacts.
propose-unit-kind dry-run emits calldata for EvolutionUnitKindRegistry.
set-unit-kind-review and set-unit-kind-status dry-run owner-only calls.
old EC-5 to EC-10 deployment files still load when EvolutionUnitKindRegistry is absent.
propose-unit-kind reports a clear error when EvolutionUnitKindRegistry is missing.
ALL_EVENT_ABI decodes EvolutionUnitKindProposed, EvolutionUnitKindReviewSet, and EvolutionUnitKindStatusChanged.
audit-bundle validates proposal event, review event, and status event linkage.
audit-bundle rejects missing review, missing status event, and mismatched proposal hash/status.
old audit-bundle flows continue to pass without --unit-kind-proposals/--unit-kind-reviews.
```

## Remote Validation

Remote Ubuntu validation completed on `154.40.59.232`.

Remote SDK tests:

```text
npm test
80 passed
```

Remote contract tests:

```text
npm run test:contracts
38 passed
```

Remote EC-11 runner:

```text
bash scripts/run-ec11-unit-kind-registry-flow.sh
passed
output: /root/originagent-ec11-remote/OriginAgentEvolutionChain/out/ec11-unit-kind-registry-flow
```

Remote artifact checks:

```text
audit-bundle.ok=true
privacy_scan.ok=true
unit_kind_linkage[0].kind_id=tool
unit_kind_linkage[0].version=1
unit_kind_linkage[0].artifact_valid=true
unit_kind_linkage[0].proposal_event_matched=true
unit_kind_linkage[0].review_event_found=true
unit_kind_linkage[0].status_event_found=true
unit_kind_linkage[0].status=Canonical
chain-state-check.unitKind.statusName=Canonical
chain-state-check.unitKind.exists=true
events.total=3
```

## Output Artifacts

The EC-11 runner writes artifacts under:

```text
out/ec11-unit-kind-registry-flow/
```

Expected artifacts:

```text
unit-kind-proposal.json
unit-kind-review.json
propose-unit-kind.json
set-unit-kind-review.json
set-unit-kind-status.json
chain-state-check.json
events.jsonl
audit-bundle.json
```

These artifacts are not committed.
