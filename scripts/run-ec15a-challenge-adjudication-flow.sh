#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec15a-challenge-adjudication-flow}"
DEPLOYMENTS_DIR="$OUT_DIR/deployments"
NODE_BIN="${NODE_BIN:-node}"
CLI="$ROOT/sdk/src/cli.ts"
RPC_URL="${EVOLUTION_CHAIN_RPC_URL:-http://127.0.0.1:8545}"
ANVIL_PORT="${ANVIL_PORT:-8545}"

OWNER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
VALIDATOR_1_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
VALIDATOR_2_ADDRESS="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
VALIDATOR_3_ADDRESS="$OWNER_ADDRESS"
CHALLENGER_ADDRESS="$VALIDATOR_2_ADDRESS"

OWNER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
VALIDATOR_1_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
VALIDATOR_2_PRIVATE_KEY="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
VALIDATOR_3_PRIVATE_KEY="$OWNER_PRIVATE_KEY"
CHALLENGER_PRIVATE_KEY="$VALIDATOR_2_PRIVATE_KEY"

MODULE_DIGEST="${MODULE_DIGEST:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
PROOF_BUNDLE_HASH="${PROOF_BUNDLE_HASH:-cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e}"
METADATA_HASH="${METADATA_HASH:-7777777777777777777777777777777777777777777777777777777777777777}"
REASON_HASH="${REASON_HASH:-9999999999999999999999999999999999999999999999999999999999999999}"
RESPONSE_HASH="${RESPONSE_HASH:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab}"
VERDICT_HASH_1="${VERDICT_HASH_1:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaac}"
VERDICT_HASH_2="${VERDICT_HASH_2:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaad}"
VERDICT_HASH_3="${VERDICT_HASH_3:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaae}"
METHOD_HASH_1="${METHOD_HASH_1:-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1}"
METHOD_HASH_2="${METHOD_HASH_2:-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2}"
METHOD_HASH_3="${METHOD_HASH_3:-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb3}"
FINAL_REPORT_HASH="${FINAL_REPORT_HASH:-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc}"
CHALLENGE_WINDOW_END="${CHALLENGE_WINDOW_END:-1893456000}"
CREATED_AT="${CREATED_AT:-2026-05-24T00:00:00.000Z}"
FINALIZED_AT="${FINALIZED_AT:-2026-05-24T00:10:00.000Z}"

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
for (const name of ['IdentityRegistry', 'AgentPassportRegistry', 'AgentReputationRegistry', 'EvolutionUnitKindRegistry', 'ModuleRegistry', 'VerificationRegistry', 'ScoreCommitReveal', 'TestCreditLedger', 'ChallengeAdjudicationRegistry']) {
  if (!contracts[name]) throw new Error('missing deployed contract address: ' + name);
}
mkdirSync(deploymentsDir, { recursive: true });
writeFileSync(join(deploymentsDir, 'local.json'), JSON.stringify({
  chainId: 31337,
  network: 'local',
  contracts,
  deployer,
  deployedAt: new Date().toISOString(),
  contractVersion: 'ec15a.0.0'
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

VERIFICATION_REGISTRY="$("$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const deployment = JSON.parse(readFileSync(process.argv[1], 'utf8'));
console.log(deployment.contracts.VerificationRegistry);
" "$DEPLOYMENTS_DIR/local.json")"
cast rpc evm_increaseTime 3601 --rpc-url "$RPC_URL" >/dev/null
cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null
cast send "$VERIFICATION_REGISTRY" "confirmAdjudicator()" \
  --rpc-url "$RPC_URL" \
  --private-key "$OWNER_PRIVATE_KEY" > "$OUT_DIR/confirm-adjudicator.json"

for entry in \
  "$VALIDATOR_1_PRIVATE_KEY:$VALIDATOR_1_ADDRESS:1111111111111111111111111111111111111111111111111111111111111111:2111111111111111111111111111111111111111111111111111111111111111" \
  "$VALIDATOR_2_PRIVATE_KEY:$VALIDATOR_2_ADDRESS:1222222222222222222222222222222222222222222222222222222222222222:2222222222222222222222222222222222222222222222222222222222222222" \
  "$VALIDATOR_3_PRIVATE_KEY:$VALIDATOR_3_ADDRESS:1333333333333333333333333333333333333333333333333333333333333333:2333333333333333333333333333333333333333333333333333333333333333"; do
  IFS=":" read -r private_key validator operator_group runner_fingerprint <<< "$entry"
  run_cli "$private_key" register-identity \
    --role validator \
    --metadata-hash "$METADATA_HASH" \
    --network local \
    --deployments-dir "$DEPLOYMENTS_DIR" \
    --broadcast > "$OUT_DIR/register-identity-$validator.json"
  run_cli "$OWNER_PRIVATE_KEY" set-validator-profile \
    --validator "$validator" \
    --operator-group-hash "$operator_group" \
    --runner-fingerprint-hash "$runner_fingerprint" \
    --allowed true \
    --network local \
    --deployments-dir "$DEPLOYMENTS_DIR" \
    --broadcast > "$OUT_DIR/set-validator-profile-$validator.json"
done

run_cli "$OWNER_PRIVATE_KEY" submit-tool-module \
  --proof-bundle fixtures/proof_bundle.tool.valid.json \
  --storage-uri "oci://registry.example/originagent/demo-tool@sha256:$MODULE_DIGEST" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-tool-module.json"

"$NODE_BIN" "$CLI" create-external-validator-artifact \
  --module-digest "$MODULE_DIGEST" \
  --validator "$VALIDATOR_1_ADDRESS" \
  --operator-group-hash "1111111111111111111111111111111111111111111111111111111111111111" \
  --runner-fingerprint-hash "2111111111111111111111111111111111111111111111111111111111111111" \
  --tool-tests-hash "2b517d681fb728bf05da53e4a79f53005968476affe5cb239cdedaf4a46a53bc" \
  --result-digest "$PROOF_BUNDLE_HASH" \
  --created-at "$CREATED_AT" \
  --out "$OUT_DIR/external-validator-artifact.json" > "$OUT_DIR/create-external-validator-artifact.json"

"$NODE_BIN" "$CLI" create-evidence-report \
  --module-digest "$MODULE_DIGEST" \
  --proof-bundle-hash "$PROOF_BUNDLE_HASH" \
  --evidence-type validator_report \
  --reporter "$VALIDATOR_1_ADDRESS" \
  --operator-group-hash "1111111111111111111111111111111111111111111111111111111111111111" \
  --runner-fingerprint-hash "2111111111111111111111111111111111111111111111111111111111111111" \
  --challenge-window-end "$CHALLENGE_WINDOW_END" \
  --external-validator-artifact "$OUT_DIR/external-validator-artifact.json" \
  --out "$OUT_DIR/evidence-report.json" > "$OUT_DIR/create-evidence-report.json"

run_cli "$VALIDATOR_1_PRIVATE_KEY" submit-validator-report \
  --report "$OUT_DIR/evidence-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-validator-report.json"

EVIDENCE_ID="$("$NODE_BIN" --input-type=module -e "import { computeEvidenceId, readEvidenceReport } from './sdk/src/evidence.ts'; console.log(computeEvidenceId(readEvidenceReport(process.argv[1])));" "$OUT_DIR/evidence-report.json")"
CHALLENGE_ID="$("$NODE_BIN" --input-type=module -e "import { computeChallengeId } from './sdk/src/evidence.ts'; console.log(computeChallengeId(process.argv[1], process.argv[2], process.argv[3]));" "$EVIDENCE_ID" "$CHALLENGER_ADDRESS" "$REASON_HASH")"

"$NODE_BIN" "$CLI" create-challenge-record \
  --evidence-id "$EVIDENCE_ID" \
  --module-digest "$MODULE_DIGEST" \
  --reason-hash "$REASON_HASH" \
  --challenger "$CHALLENGER_ADDRESS" \
  --reporter "$VALIDATOR_1_ADDRESS" \
  --created-at "$CREATED_AT" \
  --status upheld \
  --resolution-hash "$FINAL_REPORT_HASH" \
  --resolved-at "$FINALIZED_AT" \
  --out "$OUT_DIR/challenge-record.json" > "$OUT_DIR/create-challenge-record.json"

run_cli "$CHALLENGER_PRIVATE_KEY" submit-challenge \
  --evidence-id "$EVIDENCE_ID" \
  --reason-hash "$REASON_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-challenge.json"

"$NODE_BIN" "$CLI" create-challenge-response \
  --challenge-id "$CHALLENGE_ID" \
  --evidence-id "$EVIDENCE_ID" \
  --respondent "$VALIDATOR_1_ADDRESS" \
  --response-hash "$RESPONSE_HASH" \
  --created-at "$CREATED_AT" \
  --out "$OUT_DIR/challenge-response.json" > "$OUT_DIR/create-challenge-response.json"

run_cli "$VALIDATOR_1_PRIVATE_KEY" submit-challenge-response \
  --response "$OUT_DIR/challenge-response.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-challenge-response.json"

"$NODE_BIN" "$CLI" create-validator-verdict \
  --challenge-id "$CHALLENGE_ID" \
  --validator "$VALIDATOR_1_ADDRESS" \
  --claimed-upheld true \
  --verdict-hash "$VERDICT_HASH_1" \
  --method-hash "$METHOD_HASH_1" \
  --created-at "$CREATED_AT" \
  --out "$OUT_DIR/validator-verdict-1.json" > "$OUT_DIR/create-validator-verdict-1.json"
"$NODE_BIN" "$CLI" create-validator-verdict \
  --challenge-id "$CHALLENGE_ID" \
  --validator "$VALIDATOR_2_ADDRESS" \
  --claimed-upheld true \
  --verdict-hash "$VERDICT_HASH_2" \
  --method-hash "$METHOD_HASH_2" \
  --created-at "$CREATED_AT" \
  --out "$OUT_DIR/validator-verdict-2.json" > "$OUT_DIR/create-validator-verdict-2.json"
"$NODE_BIN" "$CLI" create-validator-verdict \
  --challenge-id "$CHALLENGE_ID" \
  --validator "$VALIDATOR_3_ADDRESS" \
  --claimed-upheld true \
  --verdict-hash "$VERDICT_HASH_3" \
  --method-hash "$METHOD_HASH_3" \
  --created-at "$CREATED_AT" \
  --out "$OUT_DIR/validator-verdict-3.json" > "$OUT_DIR/create-validator-verdict-3.json"

run_cli "$VALIDATOR_1_PRIVATE_KEY" submit-validator-verdict \
  --verdict "$OUT_DIR/validator-verdict-1.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-validator-verdict-1.json"
run_cli "$VALIDATOR_2_PRIVATE_KEY" submit-validator-verdict \
  --verdict "$OUT_DIR/validator-verdict-2.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-validator-verdict-2.json"
run_cli "$VALIDATOR_3_PRIVATE_KEY" submit-validator-verdict \
  --verdict "$OUT_DIR/validator-verdict-3.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-validator-verdict-3.json"

"$NODE_BIN" "$CLI" create-adjudication-report \
  --challenge-id "$CHALLENGE_ID" \
  --claimed-upheld true \
  --final-report-hash "$FINAL_REPORT_HASH" \
  --quorum 3 \
  --effective-verdict-count 3 \
  --response-hashes "$RESPONSE_HASH" \
  --verdict-hashes "$VERDICT_HASH_1" "$VERDICT_HASH_2" "$VERDICT_HASH_3" \
  --finalized-at "$FINALIZED_AT" \
  --out "$OUT_DIR/adjudication-report.json" > "$OUT_DIR/create-adjudication-report.json"

run_cli "$OWNER_PRIVATE_KEY" finalize-challenge-adjudication \
  --report "$OUT_DIR/adjudication-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/finalize-challenge-adjudication.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" chain-state-check \
  --module-digest "$MODULE_DIGEST" \
  --evidence-id "$EVIDENCE_ID" \
  --challenge-id "$CHALLENGE_ID" \
  --reporter "$VALIDATOR_1_ADDRESS" \
  --challenger "$CHALLENGER_ADDRESS" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" > "$OUT_DIR/chain-state-check.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" index-events \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/events.jsonl" > "$OUT_DIR/index-events.json"

"$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --evidence-reports "$OUT_DIR/evidence-report.json" \
  --challenge-records "$OUT_DIR/challenge-record.json" \
  --adjudication-reports "$OUT_DIR/adjudication-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/audit-bundle.json" > "$OUT_DIR/audit-bundle-command.json"

"$NODE_BIN" --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const state = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const audit = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const report = JSON.parse(readFileSync(process.argv[3], 'utf8'));
if (state.evidence?.statusName !== 'invalidated') throw new Error('evidence was not invalidated');
if (state.challenge?.statusName !== 'upheld') throw new Error('challenge was not upheld');
if (state.challenge?.adjudication?.available !== true) throw new Error('adjudication state unavailable');
if (state.challenge.adjudication.finalized !== true) throw new Error('adjudication was not finalized');
if (state.challenge.adjudication.effectiveVerdictCount !== 3) throw new Error('effective verdict count mismatch');
if (audit.ok !== true) throw new Error('audit bundle failed: ' + audit.errors.join('; '));
if (audit.adjudication_linkage?.[0]?.finalize_event_found !== true) throw new Error('missing finalize linkage');
if (audit.adjudication_linkage?.[0]?.verdict_events_matched !== true) throw new Error('missing verdict linkage');
writeFileSync(process.argv[4], JSON.stringify({
  ok: true,
  audit_ok: audit.ok,
  challenge_id: report.challenge_id,
  final_report_hash: report.final_report_hash,
  effective_verdict_count: state.challenge.adjudication.effectiveVerdictCount,
  evidence_status: state.evidence.statusName,
  challenge_status: state.challenge.statusName
}, null, 2) + '\n');
" "$OUT_DIR/chain-state-check.json" "$OUT_DIR/audit-bundle.json" "$OUT_DIR/adjudication-report.json" "$OUT_DIR/ec15a-summary.json"

echo "EC-15A challenge adjudication flow passed. Artifacts: $OUT_DIR"
