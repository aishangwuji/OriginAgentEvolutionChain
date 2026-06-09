#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_ROOT="${CLIENT_ROOT:-$ROOT/../OriginAgentclient}"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec9-memory-vault-restore-flow}"
NODE_BIN="${NODE_BIN:-node}"
CHAIN_CLI="$ROOT/sdk/src/cli.ts"

if [[ -n "${PYTHON_BIN:-}" ]]; then
  :
elif [[ -x "$CLIENT_ROOT/.venv/bin/python" ]]; then
  PYTHON_BIN="$CLIENT_ROOT/.venv/bin/python"
elif [[ -x "$CLIENT_ROOT/.venv/Scripts/python.exe" ]]; then
  PYTHON_BIN="$CLIENT_ROOT/.venv/Scripts/python.exe"
else
  PYTHON_BIN="python"
fi

OWNER_ADDRESS="${OWNER_ADDRESS:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"
AGENT_PUBLIC_KEY="${AGENT_PUBLIC_KEY:-1111111111111111111111111111111111111111111111111111111111111111}"
NEXT_AGENT_PUBLIC_KEY="${NEXT_AGENT_PUBLIC_KEY:-2222222222222222222222222222222222222222222222222222222222222222}"
GENESIS_NONCE="${GENESIS_NONCE:-3333333333333333333333333333333333333333333333333333333333333333}"
MIGRATION_NONCE="${MIGRATION_NONCE:-4444444444444444444444444444444444444444444444444444444444444444}"
METADATA_HASH="${METADATA_HASH:-0000000000000000000000000000000000000000000000000000000000000000}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

json_field() {
  "$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const value = JSON.parse(readFileSync(process.argv[1], 'utf8'));
console.log(value[process.argv[2]]);
" "$1" "$2"
}

run_client_vault() {
  PYTHONPATH="$CLIENT_ROOT" "$PYTHON_BIN" -m OriginAgent.cli.commands evolution-vault "$@"
}

require_command "$NODE_BIN"
require_command npm

mkdir -p "$OUT_DIR"
SOURCE_WORKSPACE="$OUT_DIR/source-workspace"
TARGET_WORKSPACE="$OUT_DIR/target-workspace"
KEY_FILE="$OUT_DIR/memory-vault.key"
VAULT_FILE="$OUT_DIR/memory-vault.json"

rm -rf "$SOURCE_WORKSPACE" "$TARGET_WORKSPACE"
mkdir -p "$SOURCE_WORKSPACE/memory" "$SOURCE_WORKSPACE/.originagent" "$SOURCE_WORKSPACE/sessions"

printf '%s\n' '# Source Soul' > "$SOURCE_WORKSPACE/SOUL.md"
printf '%s\n' '# Source User' > "$SOURCE_WORKSPACE/USER.md"
printf '%s\n' 'memory body' > "$SOURCE_WORKSPACE/memory/MEMORY.md"
printf '%s\n' '{"fact":"encrypted payload only"}' > "$SOURCE_WORKSPACE/memory/facts.jsonl"
printf '%s\n' '{"history":"excluded"}' > "$SOURCE_WORKSPACE/memory/history.jsonl"
printf '%s\n' '{"private_key":"excluded"}' > "$SOURCE_WORKSPACE/.originagent/evolution_identity.json"
printf '%s\n' '{"session":"excluded"}' > "$SOURCE_WORKSPACE/sessions/session.json"

PYTHONPATH="$CLIENT_ROOT" "$PYTHON_BIN" -c "import sys; from pathlib import Path; from OriginAgent.evolution.events import EventType, EvolutionEvent; from OriginAgent.evolution.ledger import EvolutionLedger; EvolutionLedger(Path(sys.argv[1])).append(EvolutionEvent.new(EventType.MODULE_PROPOSED, module_id='ec9-memory-vault'))" "$SOURCE_WORKSPACE"

"$NODE_BIN" --input-type=module -e "import { writeFileSync } from 'node:fs'; import { randomBytes } from 'node:crypto'; writeFileSync(process.argv[1], randomBytes(32).toString('hex') + '\n');" "$KEY_FILE"

AGENT_KEY_HASH="$("$NODE_BIN" --input-type=module -e "import { computeAgentKeyHash } from './sdk/src/passport.ts'; console.log(computeAgentKeyHash(process.argv[1]));" "$AGENT_PUBLIC_KEY")"
NEXT_AGENT_KEY_HASH="$("$NODE_BIN" --input-type=module -e "import { computeAgentKeyHash } from './sdk/src/passport.ts'; console.log(computeAgentKeyHash(process.argv[1]));" "$NEXT_AGENT_PUBLIC_KEY")"

"$NODE_BIN" "$CHAIN_CLI" create-agent-passport-record \
  --owner "$OWNER_ADDRESS" \
  --agent-key-hash "$AGENT_KEY_HASH" \
  --genesis-nonce "$GENESIS_NONCE" \
  --metadata-hash "$METADATA_HASH" \
  --out "$OUT_DIR/agent-passport-record.json" > "$OUT_DIR/create-agent-passport-record.json"

PASSPORT_ID="$(json_field "$OUT_DIR/agent-passport-record.json" passport_id)"

"$NODE_BIN" "$CHAIN_CLI" create-agent-migration-record \
  --passport-id "$PASSPORT_ID" \
  --owner "$OWNER_ADDRESS" \
  --old-agent-key-hash "$AGENT_KEY_HASH" \
  --new-agent-key-hash "$NEXT_AGENT_KEY_HASH" \
  --migration-nonce "$MIGRATION_NONCE" \
  --out "$OUT_DIR/agent-migration-record.json" > "$OUT_DIR/create-agent-migration-record.json"

run_client_vault export \
  --workspace "$SOURCE_WORKSPACE" \
  --passport-id "$PASSPORT_ID" \
  --agent-key-hash "$AGENT_KEY_HASH" \
  --key-file "$KEY_FILE" \
  --out "$VAULT_FILE" > "$OUT_DIR/export-memory-vault.json"

run_client_vault inspect --vault "$VAULT_FILE" > "$OUT_DIR/inspect-memory-vault.json"
run_client_vault verify --vault "$VAULT_FILE" --key-file "$KEY_FILE" > "$OUT_DIR/verify-memory-vault.json"
run_client_vault import --vault "$VAULT_FILE" --key-file "$KEY_FILE" --target-workspace "$TARGET_WORKSPACE" --dry-run > "$OUT_DIR/import-memory-vault-dry-run.json"
run_client_vault import --vault "$VAULT_FILE" --key-file "$KEY_FILE" --target-workspace "$TARGET_WORKSPACE" --apply > "$OUT_DIR/import-memory-vault-apply.json"

"$NODE_BIN" --input-type=module -e "
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const vault = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const target = process.argv[2];
for (const item of vault.metadata.included_files) {
  if (item.path === 'memory/evolution_events.jsonl') continue;
  const data = readFileSync(join(target, item.path));
  const digest = createHash('sha256').update(data).digest('hex');
  if (digest !== item.sha256) throw new Error('restored file digest mismatch: ' + item.path);
}
if (readFileSync(join(target, 'memory', 'evolution_events.jsonl'), 'utf8').includes('memory_vault_imported') !== true) {
  throw new Error('import event was not appended');
}
" "$VAULT_FILE" "$TARGET_WORKSPACE"

"$NODE_BIN" --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
import { loadDeployment } from './sdk/src/contracts.ts';
const deployment = loadDeployment('local');
const passport = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const migration = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const event = (name, index, args) => ({
  schema_version: 'originagent.evolution.event.v1',
  chain_id: deployment.chainId,
  network: deployment.network,
  contract: 'AgentPassportRegistry',
  contract_address: deployment.contracts.AgentPassportRegistry,
  event_name: name,
  block_number: index,
  transaction_hash: '0x' + String(index).padStart(64, '0'),
  log_index: index,
  args,
});
writeFileSync(process.argv[3], [
  event('AgentPassportRegistered', 1, {
    passportId: passport.passport_id,
    owner: passport.owner,
    agentKeyHash: passport.agent_key_hash,
    genesisHash: passport.genesis_hash,
    metadataHash: passport.metadata_hash,
  }),
  event('AgentPassportMigrationRecorded', 2, {
    passportId: migration.passport_id,
    owner: migration.owner,
    oldAgentKeyHash: migration.old_agent_key_hash,
    newAgentKeyHash: migration.new_agent_key_hash,
    migrationHash: migration.migration_hash,
    migrationIndex: 1,
  }),
].map((row) => JSON.stringify(row)).join('\n') + '\n');
" "$OUT_DIR/agent-passport-record.json" "$OUT_DIR/agent-migration-record.json" "$OUT_DIR/events.jsonl"

"$NODE_BIN" "$CHAIN_CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --agent-passports "$OUT_DIR/agent-passport-record.json" \
  --agent-migrations "$OUT_DIR/agent-migration-record.json" \
  --memory-vaults "$VAULT_FILE" \
  --out "$OUT_DIR/audit-bundle.json" > "$OUT_DIR/create-audit-bundle.json"

"$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const bundle = JSON.parse(readFileSync(process.argv[1], 'utf8'));
if (bundle.ok !== true) throw new Error('audit bundle failed: ' + (bundle.errors ?? []).join('; '));
if (bundle.privacy_scan?.ok !== true) throw new Error('audit bundle privacy scan failed');
if (bundle.memory_vault_linkage?.[0]?.passport_linked !== true) throw new Error('memory vault is not linked to passport');
" "$OUT_DIR/audit-bundle.json"

if grep -E '"(raw_prompt|prompt|facts|facts_raw|facts_text|private_telemetry|private_key|key_file)"|[A-Za-z]:\\|/home/|/Users/|https?://[^ ?]+\?' \
  "$VAULT_FILE" "$OUT_DIR/events.jsonl" "$OUT_DIR/audit-bundle.json" >/dev/null; then
  echo "privacy scan failed for EC-9 public JSON/JSONL artifacts" >&2
  exit 1
fi

echo "$OUT_DIR"
