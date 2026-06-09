#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec10-agent-reputation-flow}"
DEPLOYMENTS_DIR="$OUT_DIR/deployments"
NODE_BIN="${NODE_BIN:-node}"
CLI="$ROOT/sdk/src/cli.ts"
RPC_URL="${EVOLUTION_CHAIN_RPC_URL:-http://127.0.0.1:8545}"
ANVIL_PORT="${ANVIL_PORT:-8545}"

OWNER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
OWNER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

AGENT_PUBLIC_KEY="${AGENT_PUBLIC_KEY:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
GENESIS_NONCE="${GENESIS_NONCE:-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb}"
METADATA_HASH="${METADATA_HASH:-0000000000000000000000000000000000000000000000000000000000000000}"
MODULE_DIGEST="1111111111111111111111111111111111111111111111111111111111111111"
PROOF_BUNDLE_HASH="51aea71091be59887e07694fc704cbb52c87d16cc301ab36dd3ba203ce7f5494"
REASON_UPHELD="9999999999999999999999999999999999999999999999999999999999999999"
REASON_REJECTED="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
RESOLUTION_HASH="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
CHALLENGE_WINDOW_END="${CHALLENGE_WINDOW_END:-1893456000}"

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

compute_evidence_id() {
  "$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
import { computeEvidenceId } from './sdk/src/evidence.ts';
console.log(computeEvidenceId(JSON.parse(readFileSync(process.argv[1], 'utf8'))));
" "$1"
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

"$NODE_BIN" "$CLI" create-agent-passport-record \
  --owner "$OWNER_ADDRESS" \
  --agent-key-hash "$AGENT_KEY_HASH" \
  --genesis-nonce "$GENESIS_NONCE" \
  --metadata-hash "$METADATA_HASH" \
  --out "$OUT_DIR/agent-passport-record.json" > "$OUT_DIR/create-agent-passport-record.json"

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

run_cli "$OWNER_PRIVATE_KEY" submit-module \
  --proof-bundle "$ROOT/fixtures/proof_bundle.valid.json" \
  --storage-uri "oci://registry.example/originagent/demo-skill@sha256:$MODULE_DIGEST" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-module.json"

"$NODE_BIN" "$CLI" create-evidence-report \
  --module-digest "$MODULE_DIGEST" \
  --proof-bundle-hash "$PROOF_BUNDLE_HASH" \
  --evidence-type local_client_report \
  --reporter "$OWNER_ADDRESS" \
  --operator-group-hash "1111111111111111111111111111111111111111111111111111111111111112" \
  --runner-fingerprint-hash "2222222222222222222222222222222222222222222222222222222222222223" \
  --challenge-window-end "$CHALLENGE_WINDOW_END" \
  --out "$OUT_DIR/evidence-upheld.json" > "$OUT_DIR/create-evidence-upheld.json"

"$NODE_BIN" "$CLI" create-evidence-report \
  --module-digest "$MODULE_DIGEST" \
  --proof-bundle-hash "$PROOF_BUNDLE_HASH" \
  --evidence-type local_client_report \
  --reporter "$OWNER_ADDRESS" \
  --operator-group-hash "3333333333333333333333333333333333333333333333333333333333333334" \
  --runner-fingerprint-hash "4444444444444444444444444444444444444444444444444444444444444445" \
  --challenge-window-end "$CHALLENGE_WINDOW_END" \
  --out "$OUT_DIR/evidence-rejected.json" > "$OUT_DIR/create-evidence-rejected.json"

run_cli "$OWNER_PRIVATE_KEY" submit-validator-report \
  --report "$OUT_DIR/evidence-upheld.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-evidence-upheld.json"

run_cli "$OWNER_PRIVATE_KEY" submit-validator-report \
  --report "$OUT_DIR/evidence-rejected.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-evidence-rejected.json"

EVIDENCE_UPHELD_ID="$(compute_evidence_id "$OUT_DIR/evidence-upheld.json")"
EVIDENCE_REJECTED_ID="$(compute_evidence_id "$OUT_DIR/evidence-rejected.json")"

run_cli "$OWNER_PRIVATE_KEY" submit-challenge \
  --evidence-id "$EVIDENCE_UPHELD_ID" \
  --reason-hash "$REASON_UPHELD" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-challenge-upheld.json"

run_cli "$OWNER_PRIVATE_KEY" submit-challenge \
  --evidence-id "$EVIDENCE_REJECTED_ID" \
  --reason-hash "$REASON_REJECTED" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-challenge-rejected.json"

"$NODE_BIN" "$CLI" create-challenge-record \
  --evidence-id "$EVIDENCE_UPHELD_ID" \
  --module-digest "$MODULE_DIGEST" \
  --reason-hash "$REASON_UPHELD" \
  --challenger "$OWNER_ADDRESS" \
  --created-at "2026-05-23T00:00:00Z" \
  --status upheld \
  --reporter "$OWNER_ADDRESS" \
  --resolution-hash "$RESOLUTION_HASH" \
  --out "$OUT_DIR/challenge-upheld.json" > "$OUT_DIR/create-challenge-upheld.json"

"$NODE_BIN" "$CLI" create-challenge-record \
  --evidence-id "$EVIDENCE_REJECTED_ID" \
  --module-digest "$MODULE_DIGEST" \
  --reason-hash "$REASON_REJECTED" \
  --challenger "$OWNER_ADDRESS" \
  --created-at "2026-05-23T00:01:00Z" \
  --status rejected \
  --resolution-hash "$RESOLUTION_HASH" \
  --out "$OUT_DIR/challenge-rejected.json" > "$OUT_DIR/create-challenge-rejected.json"

CHALLENGE_UPHELD_ID="$(json_field "$OUT_DIR/challenge-upheld.json" challenge_id)"
CHALLENGE_REJECTED_ID="$(json_field "$OUT_DIR/challenge-rejected.json" challenge_id)"

run_cli "$OWNER_PRIVATE_KEY" resolve-challenge \
  --challenge-id "$CHALLENGE_UPHELD_ID" \
  --upheld true \
  --resolution-hash "$RESOLUTION_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/resolve-challenge-upheld.json"

run_cli "$OWNER_PRIVATE_KEY" resolve-challenge \
  --challenge-id "$CHALLENGE_REJECTED_ID" \
  --upheld false \
  --resolution-hash "$RESOLUTION_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/resolve-challenge-rejected.json"

"$NODE_BIN" "$CLI" create-agent-reputation-record \
  --passport-id "$PASSPORT_ID" \
  --owner "$OWNER_ADDRESS" \
  --source challenge_upheld \
  --source-id "$CHALLENGE_UPHELD_ID" \
  --subject-address "$OWNER_ADDRESS" \
  --created-at "2026-05-23T00:02:00Z" \
  --out "$OUT_DIR/agent-reputation-record-upheld.json" > "$OUT_DIR/create-agent-reputation-record-upheld.json"

"$NODE_BIN" "$CLI" create-agent-reputation-record \
  --passport-id "$PASSPORT_ID" \
  --owner "$OWNER_ADDRESS" \
  --source challenge_rejected \
  --source-id "$CHALLENGE_REJECTED_ID" \
  --subject-address "$OWNER_ADDRESS" \
  --created-at "2026-05-23T00:03:00Z" \
  --out "$OUT_DIR/agent-reputation-record-rejected.json" > "$OUT_DIR/create-agent-reputation-record-rejected.json"

"$NODE_BIN" "$CLI" create-agent-reputation-report \
  --passport-id "$PASSPORT_ID" \
  --owner "$OWNER_ADDRESS" \
  --records "$OUT_DIR/agent-reputation-record-upheld.json" "$OUT_DIR/agent-reputation-record-rejected.json" \
  --continuity-signals passport_registered \
  --warnings "EC-10 v1 does not prevent multi-passport reputation fragmentation" \
  --out "$OUT_DIR/agent-reputation-report.json" > "$OUT_DIR/create-agent-reputation-report.json"

REPORT_HASH="$(json_field "$OUT_DIR/agent-reputation-report.json" report_hash)"
SCORE="$(json_field "$OUT_DIR/agent-reputation-report.json" score)"
POSITIVE_COUNT="$(json_field "$OUT_DIR/agent-reputation-report.json" positive_count)"
NEGATIVE_COUNT="$(json_field "$OUT_DIR/agent-reputation-report.json" negative_count)"

run_cli "$OWNER_PRIVATE_KEY" checkpoint-agent-reputation \
  --passport-id "$PASSPORT_ID" \
  --score "$SCORE" \
  --positive-count "$POSITIVE_COUNT" \
  --negative-count "$NEGATIVE_COUNT" \
  --report-hash "$REPORT_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/checkpoint-agent-reputation.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" chain-state-check \
  --passport-id "$PASSPORT_ID" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" > "$OUT_DIR/chain-state-check.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" index-events \
  --from-block 0 \
  --to-block latest \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/events.jsonl" > "$OUT_DIR/index-events.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --evidence-reports "$OUT_DIR/evidence-upheld.json" "$OUT_DIR/evidence-rejected.json" \
  --challenge-records "$OUT_DIR/challenge-upheld.json" "$OUT_DIR/challenge-rejected.json" \
  --agent-passports "$OUT_DIR/agent-passport-record.json" \
  --reputation-reports "$OUT_DIR/agent-reputation-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/audit-bundle.json" > "$OUT_DIR/create-audit-bundle.json"

"$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const bundle = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const state = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (bundle.ok !== true) throw new Error('audit bundle failed: ' + (bundle.errors ?? []).join('; '));
if (bundle.privacy_scan?.ok !== true) throw new Error('audit bundle privacy scan failed');
if (bundle.reputation_checkpoint_linkage?.[0]?.report_hash_matched !== true) throw new Error('reputation checkpoint was not linked');
if (state.passport?.reputation?.score !== Number(process.argv[3])) throw new Error('chain-state reputation score mismatch');
" "$OUT_DIR/audit-bundle.json" "$OUT_DIR/chain-state-check.json" "$SCORE"

if find "$OUT_DIR" \( -name '*.json' -o -name '*.jsonl' \) -print0 | xargs -0 grep -E '"(raw_prompt|prompt|facts|facts_raw|facts_text|private_telemetry|private_key|key_file)"|[A-Za-z]:\\|/home/|/Users/|https?://[^ ?]+\?' >/dev/null; then
  echo "privacy scan failed for EC-10 validation JSON outputs" >&2
  exit 1
fi

echo "$OUT_DIR"
