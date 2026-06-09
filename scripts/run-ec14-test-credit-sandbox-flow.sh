#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EC12_DIR="${EC12_DIR:-$ROOT/out/ec12-adversarial-simulation}"
EC13_DIR="${EC13_DIR:-$ROOT/out/ec13-trust-policy-flow}"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec14-test-credit-sandbox-flow}"
DEPLOYMENTS_DIR="$OUT_DIR/deployments"
NODE_BIN="${NODE_BIN:-node}"
CLI="$ROOT/sdk/src/cli.ts"
RPC_URL="${EVOLUTION_CHAIN_RPC_URL:-http://127.0.0.1:8545}"
ANVIL_PORT="${ANVIL_PORT:-8545}"

OWNER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
OWNER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
CLEAN_OWNER="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
CLEAN_OWNER_PRIVATE_KEY="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"

TRUST_REPORT="$EC13_DIR/trust-policy-report.json"
ABUSE_REPORT="$EC12_DIR/abuse-report.json"
RISKY_PASSPORT_RECORD="$EC12_DIR/agent-passport-1.json"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "ERROR: missing upstream artifact: $1" >&2
    echo "Run scripts/run-ec12-adversarial-simulation-flow.sh and scripts/run-ec13-trust-policy-flow.sh first." >&2
    exit 1
  fi
}

run_cli() {
  local private_key="$1"
  shift
  EVOLUTION_CHAIN_RPC_URL="$RPC_URL" EVOLUTION_CHAIN_PRIVATE_KEY="$private_key" "$NODE_BIN" "$CLI" "$@"
}

json_get() {
  "$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const value = JSON.parse(readFileSync(process.argv[1], 'utf8'))[process.argv[2]];
if (value === undefined) throw new Error('missing JSON key: ' + process.argv[2]);
console.log(value);
" "$1" "$2"
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
  if (tx.contractName && tx.contractAddress) contracts[tx.contractName] = tx.contractAddress;
}
for (const name of ['IdentityRegistry', 'AgentPassportRegistry', 'AgentReputationRegistry', 'EvolutionUnitKindRegistry', 'ModuleRegistry', 'VerificationRegistry', 'ScoreCommitReveal', 'TestCreditLedger']) {
  if (!contracts[name]) throw new Error('missing deployed contract address: ' + name);
}
mkdirSync(deploymentsDir, { recursive: true });
writeFileSync(join(deploymentsDir, 'local.json'), JSON.stringify({
  chainId: 31337,
  network: 'local',
  contracts,
  deployer,
  deployedAt: new Date().toISOString(),
  contractVersion: 'ec14.0.0'
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
require_file "$ABUSE_REPORT"
require_file "$TRUST_REPORT"
require_file "$RISKY_PASSPORT_RECORD"

mkdir -p "$OUT_DIR" "$DEPLOYMENTS_DIR"

cd "$ROOT"
"$NODE_BIN" "$CLI" validate-abuse-report "$ABUSE_REPORT" > "$OUT_DIR/abuse-report-validation.json"
"$NODE_BIN" "$CLI" validate-trust-policy-report "$TRUST_REPORT" \
  --source-abuse-report "$ABUSE_REPORT" > "$OUT_DIR/trust-policy-validation.json"

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

"$NODE_BIN" "$CLI" create-agent-passport-record \
  --owner "$CLEAN_OWNER" \
  --agent-key-hash "0x$(printf '%064x' 201)" \
  --genesis-nonce "0x$(printf '%064x' 202)" \
  --metadata-hash "0x$(printf '%064d' 0)" \
  --out "$OUT_DIR/clean-agent-passport.json" > "$OUT_DIR/create-clean-agent-passport.json"

run_cli "$CLEAN_OWNER_PRIVATE_KEY" register-agent-passport \
  --owner "$CLEAN_OWNER" \
  --agent-key-hash "$(json_get "$OUT_DIR/clean-agent-passport.json" agent_key_hash)" \
  --genesis-hash "$(json_get "$OUT_DIR/clean-agent-passport.json" genesis_hash)" \
  --metadata-hash "$(json_get "$OUT_DIR/clean-agent-passport.json" metadata_hash)" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/register-clean-agent-passport.json"

run_cli "$OWNER_PRIVATE_KEY" register-agent-passport \
  --owner "$(json_get "$RISKY_PASSPORT_RECORD" owner)" \
  --agent-key-hash "$(json_get "$RISKY_PASSPORT_RECORD" agent_key_hash)" \
  --genesis-hash "$(json_get "$RISKY_PASSPORT_RECORD" genesis_hash)" \
  --metadata-hash "$(json_get "$RISKY_PASSPORT_RECORD" metadata_hash)" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/register-risky-agent-passport.json"

"$NODE_BIN" "$CLI" create-test-credit-action \
  --passport-id "$(json_get "$OUT_DIR/clean-agent-passport.json" passport_id)" \
  --owner "$CLEAN_OWNER" \
  --action grant \
  --reason passport_bootstrap \
  --trust-policy-report "$TRUST_REPORT" \
  --created-at "2026-05-23T00:00:00.000Z" \
  --out "$OUT_DIR/test-credit-action-clean-grant.json" > "$OUT_DIR/create-test-credit-action-clean-grant.json"

"$NODE_BIN" "$CLI" create-test-credit-action \
  --passport-id "$(json_get "$OUT_DIR/clean-agent-passport.json" passport_id)" \
  --owner "$CLEAN_OWNER" \
  --action consume \
  --reason audit_request_fee \
  --trust-policy-report "$TRUST_REPORT" \
  --created-at "2026-05-23T00:01:00.000Z" \
  --out "$OUT_DIR/test-credit-action-clean-consume.json" > "$OUT_DIR/create-test-credit-action-clean-consume.json"

"$NODE_BIN" "$CLI" create-test-credit-action \
  --passport-id "$(json_get "$RISKY_PASSPORT_RECORD" passport_id)" \
  --owner "$(json_get "$RISKY_PASSPORT_RECORD" owner)" \
  --action deny \
  --reason blocked_by_trust_policy \
  --trust-policy-report "$TRUST_REPORT" \
  --created-at "2026-05-23T00:02:00.000Z" \
  --out "$OUT_DIR/test-credit-action-risky-deny.json" > "$OUT_DIR/create-test-credit-action-risky-deny.json"

"$NODE_BIN" "$CLI" create-test-credit-report \
  --passport-id "$(json_get "$OUT_DIR/clean-agent-passport.json" passport_id)" \
  --owner "$CLEAN_OWNER" \
  --actions "$OUT_DIR/test-credit-action-clean-grant.json" "$OUT_DIR/test-credit-action-clean-consume.json" \
  --out "$OUT_DIR/test-credit-report-clean.json" > "$OUT_DIR/create-test-credit-report-clean.json"

"$NODE_BIN" "$CLI" create-test-credit-report \
  --passport-id "$(json_get "$RISKY_PASSPORT_RECORD" passport_id)" \
  --owner "$(json_get "$RISKY_PASSPORT_RECORD" owner)" \
  --actions "$OUT_DIR/test-credit-action-risky-deny.json" \
  --out "$OUT_DIR/test-credit-report-risky.json" > "$OUT_DIR/create-test-credit-report-risky.json"

"$NODE_BIN" "$CLI" validate-test-credit-report "$OUT_DIR/test-credit-report-clean.json" \
  --trust-policy-report "$TRUST_REPORT" > "$OUT_DIR/validate-test-credit-report-clean.json"
"$NODE_BIN" "$CLI" validate-test-credit-report "$OUT_DIR/test-credit-report-risky.json" \
  --trust-policy-report "$TRUST_REPORT" > "$OUT_DIR/validate-test-credit-report-risky.json"

run_cli "$OWNER_PRIVATE_KEY" grant-test-credit \
  --action "$OUT_DIR/test-credit-action-clean-grant.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/grant-test-credit-clean.json"

run_cli "$OWNER_PRIVATE_KEY" consume-test-credit \
  --action "$OUT_DIR/test-credit-action-clean-consume.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/consume-test-credit-clean.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" index-events \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/events.jsonl" > "$OUT_DIR/index-events.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" chain-state-check \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --passport-id "$(json_get "$OUT_DIR/clean-agent-passport.json" passport_id)" \
  > "$OUT_DIR/chain-state-check-clean-passport.json"

"$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --trust-policy-report "$TRUST_REPORT" \
  --test-credit-reports "$OUT_DIR/test-credit-report-clean.json" "$OUT_DIR/test-credit-report-risky.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/audit-bundle.json" > "$OUT_DIR/audit-bundle-command.json"

"$NODE_BIN" --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const audit = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const chain = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const cleanReport = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const riskyReport = JSON.parse(readFileSync(process.argv[4], 'utf8'));
if (!audit.ok) throw new Error('audit bundle failed: ' + audit.errors.join('; '));
if (chain.passport?.test_credit?.available !== true) throw new Error('test credit state unavailable');
if (chain.passport.test_credit.balance !== 95) throw new Error('expected clean balance 95');
if (chain.passport.test_credit.granted !== 100 || chain.passport.test_credit.consumed !== 5) {
  throw new Error('unexpected clean granted/consumed values');
}
const linkages = audit.test_credit_linkage ?? [];
if (linkages.filter((link) => link.event_matched).length < 2) throw new Error('missing grant/consume event matches');
if (!linkages.some((link) => link.denied === true && link.event_found === null)) throw new Error('missing deny linkage');
if (cleanReport.balance_delta !== 95) throw new Error('clean report balance_delta mismatch');
if (riskyReport.denied_count !== 1) throw new Error('risky report deny count mismatch');
writeFileSync(process.argv[5], JSON.stringify({
  ok: true,
  audit_ok: audit.ok,
  clean_balance: chain.passport.test_credit.balance,
  clean_granted: chain.passport.test_credit.granted,
  clean_consumed: chain.passport.test_credit.consumed,
  test_credit_linkage_count: linkages.length,
  clean_report_hash: cleanReport.report_hash,
  risky_report_hash: riskyReport.report_hash
}, null, 2) + '\n');
" "$OUT_DIR/audit-bundle.json" "$OUT_DIR/chain-state-check-clean-passport.json" "$OUT_DIR/test-credit-report-clean.json" "$OUT_DIR/test-credit-report-risky.json" "$OUT_DIR/test-credit-summary.json"

echo "EC-14 test credit sandbox flow passed. Artifacts: $OUT_DIR"
