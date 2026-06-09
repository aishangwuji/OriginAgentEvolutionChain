# EC-8 Agent Passport Runbook

Date: 2026-05-23

## Purpose

EC-8 adds `AgentPassportRegistry`, a local-Anvil identity anchor for long-lived Agents. It records public lifecycle facts only:

- the controlling owner address
- the Agent public-key hash
- a reproducible genesis hash
- migration events from one Agent key hash to another

It does not store memory, encrypted memory, private keys, token balances, rewards, or recovery material.

## Protocol Role

`AgentPassport` is an execution identity, not the final community contribution subject.

```text
responsibleAddress = the human, company, developer, validator, or operator wallet that carries responsibility
agentPassportId = the Agent execution passport that may have performed the work
```

Design boundary:

```text
rewards / penalties / admission / sponsorship liability belong first to responsibleAddress
Agent Passport records execution provenance, lifecycle history, migration continuity, and Agent-scoped reputation signals
Agent Passport must not replace Developer / Validator / Operator responsibility
```

Developers and validators are not required to use the OriginAgent client as the only submission path. A module or work claim may come from:

```text
OriginAgent Client
CLI
CI bot
validator runner
sandbox test Agent
```

Unknown upgrade modules should not be installed directly into a validator's production Agent. Future verification protocol work should prefer clean test Agents, validator runners, or sandboxes, with off-chain proof artifacts anchored by hashes.

## Hash Model

`agentKeyHash` is:

```text
sha256(raw 32-byte Ed25519 public key generated on first Agent initialization)
```

`genesisHash` is:

```text
keccak256(abi.encode(owner, agentKeyHash, genesisNonce, metadataHash))
```

`passportId` is:

```text
keccak256(abi.encode(owner, agentKeyHash, genesisHash))
```

`migrationHash` is:

```text
keccak256(abi.encode(passportId, oldAgentKeyHash, newAgentKeyHash, migrationNonce))
```

`genesisNonce` and `migrationNonce` are public random bytes32 values. They prevent accidental collisions; they are not encryption secrets. `metadataHash = bytes32(0)` is allowed and means no public metadata is attached.

## Local Commands

```bash
npm test
bash scripts/run-ec8-agent-passport-live-flow.sh
```

The live runner starts a fresh Anvil chain, deploys all five contracts, registers one Agent Passport, records one migration, reads back state, indexes events, builds an audit bundle, and scans generated JSON/JSONL artifacts for forbidden private fields.

## CLI Examples

```bash
node sdk/src/cli.ts compute-agent-key-hash \
  --public-key 1111111111111111111111111111111111111111111111111111111111111111

node sdk/src/cli.ts create-agent-passport-record \
  --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --agent-key-hash 0x02d449a31fbb267c8f352e9968a79e3e5fc95c1bbeaa502fd6454ebde5a4bedc \
  --genesis-nonce 3333333333333333333333333333333333333333333333333333333333333333 \
  --metadata-hash 0000000000000000000000000000000000000000000000000000000000000000 \
  --out out/ec8-agent-passport-live-flow/agent-passport-record.json

node sdk/src/cli.ts validate-agent-passport-record \
  out/ec8-agent-passport-live-flow/agent-passport-record.json

node sdk/src/cli.ts register-agent-passport \
  --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --agent-key-hash 0x02d449a31fbb267c8f352e9968a79e3e5fc95c1bbeaa502fd6454ebde5a4bedc \
  --genesis-hash 0x728fc6a9faf5c1f9b38e5d3325df0c9f4ec16b89268ab3e63fb09066c36ab50e \
  --metadata-hash 0000000000000000000000000000000000000000000000000000000000000000 \
  --network local
```

Without `--broadcast`, transaction commands remain dry-run. To broadcast, set `EVOLUTION_CHAIN_RPC_URL` and `EVOLUTION_CHAIN_PRIVATE_KEY`; the signer address must match `--owner`.

## Audit Artifacts

The runner writes:

```text
out/ec8-agent-passport-live-flow/agent-passport-record.json
out/ec8-agent-passport-live-flow/agent-migration-record.json
out/ec8-agent-passport-live-flow/chain-state-check.json
out/ec8-agent-passport-live-flow/events.jsonl
out/ec8-agent-passport-live-flow/audit-bundle.json
```

`audit-bundle` checks the Passport record and migration record against indexed events:

```bash
node sdk/src/cli.ts audit-bundle \
  --events out/ec8-agent-passport-live-flow/events.jsonl \
  --agent-passports out/ec8-agent-passport-live-flow/agent-passport-record.json \
  --agent-migrations out/ec8-agent-passport-live-flow/agent-migration-record.json \
  --network local \
  --deployments-dir out/ec8-agent-passport-live-flow/deployments \
  --out out/ec8-agent-passport-live-flow/audit-bundle.json
```

Expected result:

```text
audit-bundle.ok=true
agent_passport_linkage[0].artifact_matched=true
agent_migration_linkage[0].artifact_matched=true
agent_migration_linkage[0].migration_index=1
privacy_scan.ok=true
```

## Boundaries

EC-8 Passport is not an encryption key, token, NFT, ownership marketplace, or natural-person proof. OriginAgent can continue to run without chain access. Recovery, encrypted memory vaults, non-transferable reputation, test credits, and market economics are later phases.

EC-8 does not limit how many Passports one owner can register. This is acceptable while Passports do not automatically create economic weight, but it must not be carried into reward or validator-weight systems unchanged.

Future admission or `AgentPassportRegistry` v2 work should consider:

```text
maxActivePassportsPerFormalSubject = 3
passportStatus = Active / Retired / Revoked
activePassportCount = active Passports controlled by one formal Developer / Validator / Operator
retireAgentPassport = retire an Agent Passport without deleting history
extraAgentQuota = explicitly approved extra Agent capacity
```

The quota should apply to formally admitted subjects, not arbitrary wallet addresses. Historical Passports remain auditable; retired Passports should not keep earning work weight or Test Credit weight.
