#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec8-agent-passport-live-flow}"
DEPLOYMENTS_DIR="$OUT_DIR/deployments"
NODE_BIN="${NODE_BIN:-node}"
CLI="$ROOT/sdk/src/cli.ts"
RPC_URL="${EVOLUTION_CHAIN_RPC_URL:-http://127.0.0.1:8545}"
ANVIL_PORT="${ANVIL_PORT:-8545}"

OWNER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
OWNER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

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

run_cli() {
  local private_key="$1"
  shift
  EVOLUTION_CHAIN_RPC_URL="$RPC_URL" EVOLUTION_CHAIN_PRIVATE_KEY="$private_key" "$NODE_BIN" "$CLI" "$@"
}

wait_for_anvil() {
  for _ in $(seq 1 30); do
    if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "anvil RPC did not become ready at $RPC_URL" >&2
  exit 1
}

json_field() {
  "$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const value = JSON.parse(readFileSync(process.argv[1], 'utf8'));
console.log(value[process.argv[2]]);
" "$1" "$2"
}

write_deployment_file() {
  "$NODE_BIN" --input-type=module -e "
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[1];
const deploymentsDir = process.argv[2];
const deployer = process.argv[3];
const run = JSON.parse(readFileSync(join(root, 'contracts', 'broadcast', 'Deploy.s.sol', '31337', 'run-latest.json'), 'utf8'));
const contracts = {};
for (const tx of run.transactions ?? []) {
  if (tx.contractName && tx.contractAddress) {
    contracts[tx.contractName] = tx.contractAddress;
  }
}
for (const name of ['IdentityRegistry', 'AgentPassportRegistry', 'AgentReputationRegistry', 'ModuleRegistry', 'VerificationRegistry', 'ScoreCommitReveal']) {
  if (!contracts[name]) {
    throw new Error('missing deployed contract address: ' + name);
  }
}
mkdirSync(deploymentsDir, { recursive: true });
writeFileSync(join(deploymentsDir, 'local.json'), JSON.stringify({
  chainId: 31337,
  network: 'local',
  contracts,
  deployer,
  deployedAt: new Date().toISOString(),
  contractVersion: 'ec10.0.0'
}, null, 2) + '\n');
" "$ROOT" "$DEPLOYMENTS_DIR" "$OWNER_ADDRESS"
}

cleanup() {
  if [[ -n "${ANVIL_PID:-}" ]]; then
    kill "$ANVIL_PID" >/dev/null 2>&1 || true
  fi
}

require_command "$NODE_BIN"
require_command npm
require_command forge
require_command anvil
require_command cast

mkdir -p "$OUT_DIR" "$DEPLOYMENTS_DIR"

cd "$ROOT"
npm test

if command -v pkill >/dev/null 2>&1; then
  pkill -f "anvil.*${ANVIL_PORT}" >/dev/null 2>&1 || true
fi

anvil --host 127.0.0.1 --port "$ANVIL_PORT" --chain-id 31337 >/dev/null 2>&1 &
ANVIL_PID=$!
trap cleanup EXIT
wait_for_anvil

(
  cd "$ROOT/contracts"
  forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast --private-key "$OWNER_PRIVATE_KEY" \
    > "$OUT_DIR/deploy.log"
)
write_deployment_file

AGENT_KEY_HASH="$("$NODE_BIN" --input-type=module -e "import { computeAgentKeyHash } from './sdk/src/passport.ts'; console.log(computeAgentKeyHash(process.argv[1]));" "$AGENT_PUBLIC_KEY")"
NEXT_AGENT_KEY_HASH="$("$NODE_BIN" --input-type=module -e "import { computeAgentKeyHash } from './sdk/src/passport.ts'; console.log(computeAgentKeyHash(process.argv[1]));" "$NEXT_AGENT_PUBLIC_KEY")"

"$NODE_BIN" "$CLI" create-agent-passport-record \
  --owner "$OWNER_ADDRESS" \
  --agent-key-hash "$AGENT_KEY_HASH" \
  --genesis-nonce "$GENESIS_NONCE" \
  --metadata-hash "$METADATA_HASH" \
  --out "$OUT_DIR/agent-passport-record.json" > "$OUT_DIR/create-agent-passport-record.json"

"$NODE_BIN" "$CLI" validate-agent-passport-record "$OUT_DIR/agent-passport-record.json" \
  > "$OUT_DIR/validate-agent-passport-record.json"

PASSPORT_ID="$(json_field "$OUT_DIR/agent-passport-record.json" passport_id)"
GENESIS_HASH="$(json_field "$OUT_DIR/agent-passport-record.json" genesis_hash)"

run_cli "$OWNER_PRIVATE_KEY" register-agent-passport \
  --owner "$OWNER_ADDRESS" \
  --agent-key-hash "$AGENT_KEY_HASH" \
  --genesis-hash "$GENESIS_HASH" \
  --metadata-hash "$METADATA_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/register-agent-passport.json"

"$NODE_BIN" "$CLI" create-agent-migration-record \
  --passport-id "$PASSPORT_ID" \
  --owner "$OWNER_ADDRESS" \
  --old-agent-key-hash "$AGENT_KEY_HASH" \
  --new-agent-key-hash "$NEXT_AGENT_KEY_HASH" \
  --migration-nonce "$MIGRATION_NONCE" \
  --out "$OUT_DIR/agent-migration-record.json" > "$OUT_DIR/create-agent-migration-record.json"

"$NODE_BIN" "$CLI" validate-agent-migration-record "$OUT_DIR/agent-migration-record.json" \
  > "$OUT_DIR/validate-agent-migration-record.json"

MIGRATION_HASH="$(json_field "$OUT_DIR/agent-migration-record.json" migration_hash)"

run_cli "$OWNER_PRIVATE_KEY" record-agent-migration \
  --owner "$OWNER_ADDRESS" \
  --passport-id "$PASSPORT_ID" \
  --new-agent-key-hash "$NEXT_AGENT_KEY_HASH" \
  --migration-hash "$MIGRATION_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/record-agent-migration.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" chain-state-check \
  --passport-id "$PASSPORT_ID" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" > "$OUT_DIR/chain-state-check.json"

"$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const state = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const expectedOwner = process.argv[2];
const expectedKey = process.argv[3];
if (state.passport?.exists !== true) throw new Error('passport was not registered');
if (state.passport.owner !== expectedOwner) throw new Error('passport owner mismatch');
if (state.passport.agentKeyHash !== expectedKey) throw new Error('passport current key mismatch');
if (state.passport.migrationCount !== 1) throw new Error('passport migration count mismatch');
" "$OUT_DIR/chain-state-check.json" "$OWNER_ADDRESS" "$NEXT_AGENT_KEY_HASH"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" index-events \
  --from-block 0 \
  --to-block latest \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/events.jsonl" > "$OUT_DIR/index-events.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --agent-passports "$OUT_DIR/agent-passport-record.json" \
  --agent-migrations "$OUT_DIR/agent-migration-record.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/audit-bundle.json" > "$OUT_DIR/create-audit-bundle.json"

"$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const bundle = JSON.parse(readFileSync(process.argv[1], 'utf8'));
if (bundle.ok !== true) throw new Error('audit bundle failed: ' + (bundle.errors ?? []).join('; '));
" "$OUT_DIR/audit-bundle.json"

if find "$OUT_DIR" \( -name '*.json' -o -name '*.jsonl' \) -print0 | xargs -0 grep -E '"(raw_prompt|prompt|facts|facts_raw|facts_text|private_telemetry)"|[A-Za-z]:\\|/home/|/Users/|https?://[^ ?]+\?' >/dev/null; then
  echo "privacy scan failed for EC-8 validation JSON outputs" >&2
  exit 1
fi

echo "$OUT_DIR"
