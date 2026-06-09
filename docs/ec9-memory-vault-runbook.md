# EC-9 Encrypted Memory Vault Runbook

Date: 2026-05-23

## Purpose

EC-9 adds an offline encrypted memory vault for cross-machine Agent restore. It uses EC-8 Agent Passport as a public identity anchor, but does not add contracts and does not put memory on-chain.

The vault is a client-side artifact:

- public metadata links to `passport_id` and `agent_key_hash`
- AES-256-GCM ciphertext contains the allowlisted memory payload
- the key file is never embedded in the vault
- chain-side `audit-bundle --memory-vaults` validates public integrity and Passport linkage only

## Vault Model

The top-level vault schema is `originagent.evolution.memory_vault.v1`.

The encrypted payload schema is `originagent.evolution.memory_vault_payload.v1`.

Digest formulas:

```text
payload_plaintext = canonical_json({schema_version, files, source_ledger_terminal_hash})
payload_digest = sha256(payload_plaintext)
encrypted_payload = AESGCM(key).encrypt(nonce, payload_plaintext, canonical_json(metadata_without_encrypted_payload_digest))
encrypted_payload_digest = sha256(encrypted_payload)
metadata_digest = sha256(canonical_json(metadata))
vault_digest = sha256("originagent.ec9.vault.v1" || metadata_digest || encrypted_payload_digest)
```

`source_ledger_terminal_hash` comes from `EvolutionLedger.verify_chain().terminal_event_hash`, not from hashing the last JSONL line.

## Allowlist

EC-9 exports only:

```text
SOUL.md
USER.md
memory/MEMORY.md
memory/facts.jsonl
memory/evolution_events.jsonl
```

It excludes `history.jsonl`, sessions, provider config, API keys, tokens, and `.originagent/evolution_identity.json`.

## Client CLI

Run from `OriginAgentclient`:

```bash
PYTHONPATH=. .venv/bin/python -m OriginAgent.cli.commands evolution-vault export \
  --workspace /path/to/source-workspace \
  --passport-id 0x... \
  --agent-key-hash 0x... \
  --key-file /path/to/memory-vault.key \
  --out /path/to/memory-vault.json

PYTHONPATH=. .venv/bin/python -m OriginAgent.cli.commands evolution-vault inspect \
  --vault /path/to/memory-vault.json

PYTHONPATH=. .venv/bin/python -m OriginAgent.cli.commands evolution-vault verify \
  --vault /path/to/memory-vault.json \
  --key-file /path/to/memory-vault.key

PYTHONPATH=. .venv/bin/python -m OriginAgent.cli.commands evolution-vault import \
  --vault /path/to/memory-vault.json \
  --key-file /path/to/memory-vault.key \
  --target-workspace /path/to/target-workspace

PYTHONPATH=. .venv/bin/python -m OriginAgent.cli.commands evolution-vault import \
  --vault /path/to/memory-vault.json \
  --key-file /path/to/memory-vault.key \
  --target-workspace /path/to/target-workspace \
  --apply
```

Import defaults to dry-run. `--apply` writes files. If target files already exist, import fails unless `--replace` is provided. `--replace` overwrites only paths included in the vault and does not delete other target files.

## Chain Audit

Run from `OriginAgentEvolutionChain`:

```bash
node sdk/src/cli.ts audit-bundle \
  --events out/ec9-memory-vault-restore-flow/events.jsonl \
  --agent-passports out/ec9-memory-vault-restore-flow/agent-passport-record.json \
  --agent-migrations out/ec9-memory-vault-restore-flow/agent-migration-record.json \
  --memory-vaults out/ec9-memory-vault-restore-flow/memory-vault.json \
  --out out/ec9-memory-vault-restore-flow/audit-bundle.json
```

Expected checks:

```text
audit-bundle.ok=true
privacy_scan.ok=true
memory_vault_linkage[0].artifact_valid=true
memory_vault_linkage[0].passport_linked=true
```

The chain audit does not decrypt the vault and cannot validate payload plaintext. It validates public digest consistency, public privacy rules, and Passport/migration artifact linkage.

## Runner

```bash
CLIENT_ROOT=/path/to/OriginAgentclient bash scripts/run-ec9-memory-vault-restore-flow.sh
```

The runner creates a minimal source workspace, exports a vault, verifies it, dry-runs restore, applies restore, checks restored file digests, synthesizes Passport events, and builds an audit bundle.

After import, `memory/evolution_events.jsonl` is expected to differ from its exported file digest because the client appends `memory_vault_imported`. The runner checks non-ledger file digests and verifies the ledger contains the import event.

## Security Boundary

The key file must move through a separate secure channel chosen by the user, such as SSH/SCP or manual offline transfer. EC-9 does not distribute keys, store keys in vault artifacts, or derive encryption keys from the public Passport ID.

EC-9 does not migrate the Agent Ed25519 private key. After restore, the Agent should initialize a new local identity and the owner wallet can later record an EC-8 Passport migration.
