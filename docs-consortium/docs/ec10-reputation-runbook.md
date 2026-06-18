# EC-10 Agent Reputation Checkpoint Runbook

Date: 2026-05-23

## Purpose

EC-10 adds non-transferable Agent Passport reputation checkpoints.

It uses a dual-track model:

- off-chain Agent Reputation records and reports explain why a Passport score changed
- on-chain `AgentReputationRegistry` stores only the latest checkpoint for a `passportId`

EC-10 does not modify `VerificationRegistry.testnetReputation`. Address-level contribution standing remains available for the existing challenge flow.

## Contract Model

`AgentReputationRegistry` is deployed with the existing contracts and binds to `AgentPassportRegistry`.

The checkpoint function is:

```text
checkpointReputation(passportId, score, positiveCount, negativeCount, reportHash)
```

Rules:

- only the registry owner can checkpoint
- `passportId` must exist in `AgentPassportRegistry`
- `reportHash` must be non-zero
- a later checkpoint overwrites the current values and increments `checkpointCount`

Event:

```text
AgentReputationCheckpointed(passportId, score, positiveCount, negativeCount, reportHash, checkpointIndex)
```

`AgentReputationRegistry` is optional in old deployment files. EC-5 to EC-9 deployment artifacts remain readable.

## Artifact Model

Record schema:

```text
originagent.evolution.agent_reputation_record.v1
```

Fields:

```text
passport_id
owner
source
source_id
subject_address
delta
created_at
```

EC-10 v1 sources:

```text
challenge_upheld -> +5
challenge_rejected -> -2
```

Report schema:

```text
originagent.evolution.agent_reputation_report.v1
```

Fields:

```text
passport_id
owner
score
positive_count
negative_count
records
continuity_signals
warnings
report_hash
```

`report_hash` is `hashJson(report_without_report_hash)` using the existing canonical JSON hash behavior.

## CLI

Create a record:

```bash
node sdk/src/cli.ts create-agent-reputation-record \
  --passport-id 0x... \
  --owner 0x... \
  --source challenge_upheld \
  --source-id 0x... \
  --subject-address 0x... \
  --created-at 2026-05-23T00:00:00Z \
  --out out/ec10-agent-reputation-flow/agent-reputation-record-upheld.json
```

Create a report:

```bash
node sdk/src/cli.ts create-agent-reputation-report \
  --passport-id 0x... \
  --owner 0x... \
  --records out/ec10-agent-reputation-flow/agent-reputation-record-upheld.json out/ec10-agent-reputation-flow/agent-reputation-record-rejected.json \
  --continuity-signals passport_registered \
  --out out/ec10-agent-reputation-flow/agent-reputation-report.json
```

Checkpoint the report:

```bash
node sdk/src/cli.ts checkpoint-agent-reputation \
  --passport-id 0x... \
  --score 3 \
  --positive-count 1 \
  --negative-count 1 \
  --report-hash <64-byte lowercase hex report hash> \
  --network local \
  --dry-run
```

Broadcast requires:

```text
EVOLUTION_CHAIN_RPC_URL
EVOLUTION_CHAIN_PRIVATE_KEY
--broadcast
```

## Chain State

`chain-state-check --passport-id` returns the Passport state and a reputation section:

```json
{
  "passport": {
    "exists": true,
    "reputation": {
      "available": true,
      "score": 3,
      "positiveCount": 1,
      "negativeCount": 1,
      "reportHash": "0x...",
      "checkpointCount": 1,
      "exists": true
    }
  }
}
```

If a deployment lacks `AgentReputationRegistry`, `reputation.available=false`.

## Audit Bundle

Add reputation reports to audit bundle:

```bash
node sdk/src/cli.ts audit-bundle \
  --events out/ec10-agent-reputation-flow/events.jsonl \
  --evidence-reports out/ec10-agent-reputation-flow/evidence-upheld.json out/ec10-agent-reputation-flow/evidence-rejected.json \
  --challenge-records out/ec10-agent-reputation-flow/challenge-upheld.json out/ec10-agent-reputation-flow/challenge-rejected.json \
  --agent-passports out/ec10-agent-reputation-flow/agent-passport-record.json \
  --reputation-reports out/ec10-agent-reputation-flow/agent-reputation-report.json \
  --out out/ec10-agent-reputation-flow/audit-bundle.json
```

Expected checks:

```text
audit-bundle.ok=true
privacy_scan.ok=true
reputation_checkpoint_linkage[0].checkpoint_event_found=true
reputation_checkpoint_linkage[0].report_hash_matched=true
reputation_checkpoint_linkage[0].source_events_matched=true
```

## Runner

```bash
bash scripts/run-ec10-agent-reputation-flow.sh
```

The runner:

- runs `npm test`
- starts a fresh Anvil chain
- deploys six contracts
- registers an Agent Passport
- submits a module
- creates two distinct evidence records
- submits two challenges and resolves one upheld and one rejected
- creates reputation records and report
- checkpoints the report on-chain
- reads chain state
- indexes events
- builds an audit bundle
- asserts audit and privacy checks

## Security Boundary

EC-10 v1 does not solve Sybil or multi-passport fragmentation. One owner can have multiple Passports, and the foundation owner is expected to review which Passport receives a reputation record.

The full reputation report JSON must be archived with audit artifacts. The chain stores only the report hash and current checkpoint.

EC-10 does not add Points rewards, staking, Credit Deduction mechanics, DAO governance, public testnet deployment, or natural-person uniqueness.
