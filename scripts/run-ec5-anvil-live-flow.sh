#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec5-anvil-live-flow}"
DEPLOYMENTS_DIR="$OUT_DIR/deployments"
NODE_BIN="${NODE_BIN:-node}"
CLI="$ROOT/sdk/src/cli.ts"
RPC_URL="${EVOLUTION_CHAIN_RPC_URL:-http://127.0.0.1:8545}"
ANVIL_PORT="${ANVIL_PORT:-8545}"

OWNER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
VALIDATOR_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
CHALLENGER_ADDRESS="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
OWNER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
VALIDATOR_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
CHALLENGER_PRIVATE_KEY="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"

MODULE_DIGEST="${MODULE_DIGEST:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
PROOF_BUNDLE_HASH="${PROOF_BUNDLE_HASH:-cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e}"
METADATA_HASH="${METADATA_HASH:-7777777777777777777777777777777777777777777777777777777777777777}"
OPERATOR_GROUP_HASH="${OPERATOR_GROUP_HASH:-1111111111111111111111111111111111111111111111111111111111111111}"
RUNNER_FINGERPRINT_HASH="${RUNNER_FINGERPRINT_HASH:-2222222222222222222222222222222222222222222222222222222222222222}"
TOOL_TESTS_HASH="${TOOL_TESTS_HASH:-2b517d681fb728bf05da53e4a79f53005968476affe5cb239cdedaf4a46a53bc}"
RESULT_DIGEST="${RESULT_DIGEST:-cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e}"
CREATED_AT="${CREATED_AT:-2026-05-23T00:00:00Z}"
RESOLVED_AT="${RESOLVED_AT:-2026-05-23T00:10:00Z}"
CHALLENGE_WINDOW_END="${CHALLENGE_WINDOW_END:-1893456000}"
REASON_HASH="${REASON_HASH:-9999999999999999999999999999999999999999999999999999999999999999}"
RESOLUTION_HASH="${RESOLUTION_HASH:-8888888888888888888888888888888888888888888888888888888888888888}"

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
for (const name of ['IdentityRegistry', 'AgentPassportRegistry', 'ModuleRegistry', 'VerificationRegistry', 'ScoreCommitReveal']) {
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
  contractVersion: 'ec4.0.0'
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

run_cli "$VALIDATOR_PRIVATE_KEY" register-identity \
  --role validator \
  --metadata-hash "$METADATA_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/register-identity.json"

run_cli "$OWNER_PRIVATE_KEY" submit-tool-module \
  --proof-bundle fixtures/proof_bundle.tool.valid.json \
  --storage-uri "oci://registry.example/originagent/demo-tool@sha256:$MODULE_DIGEST" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-tool-module.json"

run_cli "$OWNER_PRIVATE_KEY" set-validator-profile \
  --validator "$VALIDATOR_ADDRESS" \
  --operator-group-hash "$OPERATOR_GROUP_HASH" \
  --runner-fingerprint-hash "$RUNNER_FINGERPRINT_HASH" \
  --allowed true \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/set-validator-profile.json"

"$NODE_BIN" "$CLI" create-external-validator-artifact \
  --module-digest "$MODULE_DIGEST" \
  --validator "$VALIDATOR_ADDRESS" \
  --operator-group-hash "$OPERATOR_GROUP_HASH" \
  --runner-fingerprint-hash "$RUNNER_FINGERPRINT_HASH" \
  --tool-tests-hash "$TOOL_TESTS_HASH" \
  --result-digest "$RESULT_DIGEST" \
  --created-at "$CREATED_AT" \
  --out "$OUT_DIR/external-validator-artifact.json" > "$OUT_DIR/create-external-validator-artifact.json"

"$NODE_BIN" "$CLI" create-evidence-report \
  --module-digest "$MODULE_DIGEST" \
  --proof-bundle-hash "$PROOF_BUNDLE_HASH" \
  --evidence-type validator_report \
  --reporter "$VALIDATOR_ADDRESS" \
  --operator-group-hash "$OPERATOR_GROUP_HASH" \
  --runner-fingerprint-hash "$RUNNER_FINGERPRINT_HASH" \
  --challenge-window-end "$CHALLENGE_WINDOW_END" \
  --external-validator-artifact "$OUT_DIR/external-validator-artifact.json" \
  --out "$OUT_DIR/evidence-report.json" > "$OUT_DIR/create-evidence-report.json"

run_cli "$VALIDATOR_PRIVATE_KEY" submit-validator-report \
  --report "$OUT_DIR/evidence-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-validator-report.json"

EVIDENCE_ID="$("$NODE_BIN" --input-type=module -e "import { computeEvidenceId, readEvidenceReport } from './sdk/src/evidence.ts'; console.log(computeEvidenceId(readEvidenceReport(process.argv[1])));" "$OUT_DIR/evidence-report.json")"

"$NODE_BIN" "$CLI" create-challenge-record \
  --evidence-id "$EVIDENCE_ID" \
  --module-digest "$MODULE_DIGEST" \
  --reason-hash "$REASON_HASH" \
  --challenger "$CHALLENGER_ADDRESS" \
  --reporter "$VALIDATOR_ADDRESS" \
  --created-at "$CREATED_AT" \
  --status upheld \
  --resolution-hash "$RESOLUTION_HASH" \
  --resolved-at "$RESOLVED_AT" \
  --out "$OUT_DIR/challenge-record.json" > "$OUT_DIR/create-challenge-record.json"

CHALLENGE_ID="$("$NODE_BIN" --input-type=module -e "import { computeChallengeId } from './sdk/src/evidence.ts'; console.log(computeChallengeId(process.argv[1], process.argv[2], process.argv[3]));" "$EVIDENCE_ID" "$CHALLENGER_ADDRESS" "$REASON_HASH")"

run_cli "$CHALLENGER_PRIVATE_KEY" submit-challenge \
  --evidence-id "$EVIDENCE_ID" \
  --reason-hash "$REASON_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-challenge.json"

run_cli "$OWNER_PRIVATE_KEY" resolve-challenge \
  --challenge-id "$CHALLENGE_ID" \
  --upheld true \
  --resolution-hash "$RESOLUTION_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/resolve-challenge.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" chain-state-check \
  --module-digest "$MODULE_DIGEST" \
  --evidence-id "$EVIDENCE_ID" \
  --challenge-id "$CHALLENGE_ID" \
  --reporter "$VALIDATOR_ADDRESS" \
  --challenger "$CHALLENGER_ADDRESS" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" > "$OUT_DIR/chain-state-check.json"

"$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const state = JSON.parse(readFileSync(process.argv[1], 'utf8'));
if (state.module?.exists !== true) throw new Error('module was not submitted');
if (state.evidence?.statusName !== 'invalidated') throw new Error('evidence was not invalidated');
if (state.challenge?.statusName !== 'upheld') throw new Error('challenge was not upheld');
if (state.challenger?.testnetReputation !== 5) throw new Error('challenger reputation mismatch');
if (state.reporter?.testnetReputation !== -10) throw new Error('reporter reputation mismatch');
" "$OUT_DIR/chain-state-check.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" index-events \
  --from-block 0 \
  --to-block latest \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/events.jsonl" > "$OUT_DIR/index-events.json"

"$NODE_BIN" "$CLI" challenge-summary \
  --challenges "$OUT_DIR/challenge-record.json" \
  > "$OUT_DIR/challenge-summary.json"

"$NODE_BIN" "$CLI" evidence-summary \
  --reports "$OUT_DIR/evidence-report.json" \
  --challenge-summary "$OUT_DIR/challenge-summary.json" \
  > "$OUT_DIR/evidence-summary.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --evidence-reports "$OUT_DIR/evidence-report.json" \
  --challenge-records "$OUT_DIR/challenge-record.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/audit-bundle.json" > "$OUT_DIR/create-audit-bundle.json"

"$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const bundle = JSON.parse(readFileSync(process.argv[1], 'utf8'));
if (bundle.ok !== true) throw new Error('audit bundle failed: ' + (bundle.errors ?? []).join('; '));
" "$OUT_DIR/audit-bundle.json"

if find "$OUT_DIR" \( -name '*.json' -o -name '*.jsonl' \) -print0 | xargs -0 grep -E '"(raw_prompt|prompt|facts|facts_raw|facts_text|private_telemetry)"|[A-Za-z]:\\|/home/|/Users/|https?://[^ ?]+\?' >/dev/null; then
  echo "privacy scan failed for EC-5 validation JSON outputs" >&2
  exit 1
fi

echo "$OUT_DIR"
