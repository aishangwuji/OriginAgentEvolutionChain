# EC-10 Reputation Checkpoint Validation Result

Date: 2026-05-23

## Scope

EC-10 adds `AgentReputationRegistry`, Agent Reputation record/report artifacts, checkpoint transactions, chain-state reputation reads, and audit-bundle checkpoint linkage.

EC-10 does not modify `VerificationRegistry.testnetReputation`.

## Local Validation

SDK tests:

```text
npm test
74 passed
```

Contract tests:

```text
npm run test:contracts
not run locally: forge is not installed in the Windows shell
```

Local EC-10 runner:

```text
bash scripts/run-ec10-agent-reputation-flow.sh
not run locally: Windows shell lacks Foundry/anvil/cast
```

## Verified SDK Behavior

```text
Agent Reputation record validates source/delta rules.
Agent Reputation report computes score, positive_count, negative_count, and report_hash.
record/report privacy scan rejects forbidden private fields.
CLI create/validate commands write and validate artifacts.
checkpoint-agent-reputation dry-run emits calldata for AgentReputationRegistry.
old 5-contract deployment files still load.
checkpoint-agent-reputation reports a clear error when AgentReputationRegistry is missing.
ALL_EVENT_ABI decodes AgentReputationCheckpointed.
audit-bundle validates reputation report, challenge source events, and checkpoint event linkage.
audit-bundle rejects missing checkpoint, mismatched report hash, mismatched owner, and mismatched challenge source.
old audit-bundle flows continue to pass without --reputation-reports.
```

## Remote Validation

Remote Ubuntu validation completed on `154.40.59.232`.

Remote SDK tests:

```text
npm test
74 passed
```

Remote contract tests:

```text
npm run test:contracts
31 passed
```

Remote EC-10 runner:

```text
bash scripts/run-ec10-agent-reputation-flow.sh
passed
output: /root/originagent-ec10-remote/OriginAgentEvolutionChain/out/ec10-agent-reputation-flow
```

Remote artifact checks:

```text
audit-bundle.ok=true
privacy_scan.ok=true
reputation_checkpoint_linkage[0].report_hash_matched=true
reputation_checkpoint_linkage[0].source_events_matched=true
reputation_checkpoint_linkage[0].checkpoint_event_found=true
chain-state-check.passport.reputation.score=3
agent-reputation-report.score=3
events.total=10
```

## Output Artifacts

The EC-10 runner writes artifacts under:

```text
out/ec10-agent-reputation-flow/
```

Expected artifacts:

```text
agent-passport-record.json
evidence-upheld.json
evidence-rejected.json
challenge-upheld.json
challenge-rejected.json
agent-reputation-record-upheld.json
agent-reputation-record-rejected.json
agent-reputation-report.json
chain-state-check.json
events.jsonl
audit-bundle.json
```

These artifacts are not committed.
