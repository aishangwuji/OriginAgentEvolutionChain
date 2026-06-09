#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec11-unit-kind-registry-flow}"
DEPLOYMENTS_DIR="$OUT_DIR/deployments"
NODE_BIN="${NODE_BIN:-node}"
CLI="$ROOT/sdk/src/cli.ts"
RPC_URL="${EVOLUTION_CHAIN_RPC_URL:-http://127.0.0.1:8545}"
ANVIL_PORT="${ANVIL_PORT:-8545}"

OWNER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
OWNER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

SCHEMA_HASH="${SCHEMA_HASH:-1111111111111111111111111111111111111111111111111111111111111111}"
VALIDATION_SUMMARY_HASH="${VALIDATION_SUMMARY_HASH:-2222222222222222222222222222222222222222222222222222222222222222}"

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
for (const name of ['IdentityRegistry', 'AgentPassportRegistry', 'AgentReputationRegistry', 'EvolutionUnitKindRegistry', 'ModuleRegistry', 'VerificationRegistry', 'ScoreCommitReveal']) {
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
  contractVersion: 'ec11.0.0'
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

"$NODE_BIN" "$CLI" create-unit-kind-proposal \
  --kind-id tool \
  --version 1 \
  --display-name Tool \
  --description "Legacy executable tool unit kind." \
  --runtime-surface tool_call \
  --schema-hash "$SCHEMA_HASH" \
  --schema-uri ipfs://unit-kind/tool/v1/schema \
  --permission-model "declared tool permissions only" \
  --verification-profile "validator tool execution replay" \
  --risk-class executable_tool \
  --sandbox-requirement "isolated process without secret access" \
  --install-semantics "install as ModuleType.Tool-compatible unit" \
  --rollback-semantics "remove unit manifest and restore previous activation" \
  --compatibility-rules "tool@1 maps to ModuleType.Tool by EC-11 audit convention" \
  --deprecation-rules "legacy mapping remains auditable after deprecation" \
  --out "$OUT_DIR/unit-kind-proposal.json" > "$OUT_DIR/create-unit-kind-proposal.json"

"$NODE_BIN" "$CLI" validate-unit-kind-proposal "$OUT_DIR/unit-kind-proposal.json" > "$OUT_DIR/validate-unit-kind-proposal.json"

run_cli "$OWNER_PRIVATE_KEY" propose-unit-kind \
  --proposal "$OUT_DIR/unit-kind-proposal.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/propose-unit-kind.json"

"$NODE_BIN" "$CLI" create-unit-kind-review \
  --kind-id tool \
  --version 1 \
  --reviewer "$OWNER_ADDRESS" \
  --recommended-status Canonical \
  --risk-assessment "low risk compatibility kind" \
  --validation-summary-hash "$VALIDATION_SUMMARY_HASH" \
  --out "$OUT_DIR/unit-kind-review.json" > "$OUT_DIR/create-unit-kind-review.json"

"$NODE_BIN" "$CLI" validate-unit-kind-review "$OUT_DIR/unit-kind-review.json" > "$OUT_DIR/validate-unit-kind-review.json"

run_cli "$OWNER_PRIVATE_KEY" set-unit-kind-review \
  --review "$OUT_DIR/unit-kind-review.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/set-unit-kind-review.json"

run_cli "$OWNER_PRIVATE_KEY" set-unit-kind-status \
  --kind-id tool \
  --version 1 \
  --status Canonical \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/set-unit-kind-status.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" chain-state-check \
  --unit-kind tool \
  --version 1 \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" > "$OUT_DIR/chain-state-check.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" index-events \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/events.jsonl" > "$OUT_DIR/index-events.json"

"$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --unit-kind-proposals "$OUT_DIR/unit-kind-proposal.json" \
  --unit-kind-reviews "$OUT_DIR/unit-kind-review.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/audit-bundle.json" > "$OUT_DIR/audit-bundle-cli.json"

"$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const bundle = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const state = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (bundle.ok !== true) throw new Error('audit-bundle.ok is not true');
if (bundle.privacy_scan?.ok !== true) throw new Error('privacy_scan.ok is not true');
if (bundle.unit_kind_linkage?.[0]?.proposal_event_matched !== true) throw new Error('unit kind proposal was not linked');
if (bundle.unit_kind_linkage?.[0]?.review_event_found !== true) throw new Error('unit kind review was not linked');
if (bundle.unit_kind_linkage?.[0]?.status_event_found !== true) throw new Error('unit kind status was not linked');
if (state.unitKind?.statusName !== 'Canonical') throw new Error('tool@1 is not Canonical');
" "$OUT_DIR/audit-bundle.json" "$OUT_DIR/chain-state-check.json"

echo "EC-11 unit kind registry flow passed. Artifacts: $OUT_DIR"
