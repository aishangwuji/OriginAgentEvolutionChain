#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec15b-public-adjudication-hardening-flow}"
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
CHALLENGE_WINDOW_END="${CHALLENGE_WINDOW_END:-1893456000}"
CREATED_AT="${CREATED_AT:-2026-05-24T00:00:00.000Z}"

REASON_UPHELD="${REASON_UPHELD:-9999999999999999999999999999999999999999999999999999999999999991}"
REASON_REJECTED="${REASON_REJECTED:-9999999999999999999999999999999999999999999999999999999999999992}"
REASON_EXPIRED="${REASON_EXPIRED:-9999999999999999999999999999999999999999999999999999999999999993}"

RESPONSE_UPHELD="${RESPONSE_UPHELD:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1}"
RESPONSE_REJECTED="${RESPONSE_REJECTED:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2}"
FINAL_UPHELD="${FINAL_UPHELD:-ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc1}"
FINAL_REJECTED="${FINAL_REJECTED:-ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc2}"
EXPIRATION_REPORT_HASH="${EXPIRATION_REPORT_HASH:-ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd3}"

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

advance_time() {
  cast rpc evm_increaseTime "$1" --rpc-url "$RPC_URL" >/dev/null
  cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null
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
  contractVersion: 'ec15b.0.0'
}, null, 2) + '\n');
" "$ROOT" "$DEPLOYMENTS_DIR" "$OWNER_ADDRESS"
}

challenge_id_for() {
  "$NODE_BIN" --input-type=module -e "import { computeChallengeId } from './sdk/src/evidence.ts'; console.log(computeChallengeId(process.argv[1], process.argv[2], process.argv[3]));" "$1" "$CHALLENGER_ADDRESS" "$2"
}

evidence_id_for() {
  "$NODE_BIN" --input-type=module -e "import { computeEvidenceId, readEvidenceReport } from './sdk/src/evidence.ts'; console.log(computeEvidenceId(readEvidenceReport(process.argv[1])));" "$1"
}

read_deadlines() {
  local challenge_id="$1"
  local prefix="$2"
  EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" chain-state-check \
    --challenge-id "$challenge_id" \
    --network local \
    --deployments-dir "$DEPLOYMENTS_DIR" > "$OUT_DIR/$prefix-chain-state-before-terminal.json"
  "$NODE_BIN" --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const state = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const adj = state.challenge?.adjudication;
if (adj?.available !== true) throw new Error('missing adjudication state');
writeFileSync(process.argv[2], JSON.stringify({
  response_by: new Date(adj.responseBy * 1000).toISOString(),
  commit_by: new Date(adj.commitBy * 1000).toISOString(),
  reveal_by: new Date(adj.revealBy * 1000).toISOString(),
  response_by_seconds: adj.responseBy,
  commit_by_seconds: adj.commitBy,
  reveal_by_seconds: adj.revealBy
}, null, 2) + '\n');
" "$OUT_DIR/$prefix-chain-state-before-terminal.json" "$OUT_DIR/$prefix-deadlines.json"
}

create_evidence_and_challenge() {
  local prefix="$1"
  local proof_hash="$2"
  local reason_hash="$3"
  local status="$4"
  local resolution_hash="${5:-}"
  local resolved_at="${6:-}"

  "$NODE_BIN" "$CLI" create-evidence-report \
    --module-digest "$MODULE_DIGEST" \
    --proof-bundle-hash "$proof_hash" \
    --evidence-type foundation_seed_report \
    --reporter "$OWNER_ADDRESS" \
    --operator-group-hash "0000000000000000000000000000000000000000000000000000000000000000" \
    --runner-fingerprint-hash "0000000000000000000000000000000000000000000000000000000000000000" \
    --challenge-window-end "$CHALLENGE_WINDOW_END" \
    --out "$OUT_DIR/$prefix-evidence-report.json" > "$OUT_DIR/$prefix-create-evidence-report.json"

  run_cli "$OWNER_PRIVATE_KEY" submit-validator-report \
    --report "$OUT_DIR/$prefix-evidence-report.json" \
    --network local \
    --deployments-dir "$DEPLOYMENTS_DIR" \
    --broadcast > "$OUT_DIR/$prefix-submit-evidence.json"

  local evidence_id
  evidence_id="$(evidence_id_for "$OUT_DIR/$prefix-evidence-report.json")"
  local challenge_id
  challenge_id="$(challenge_id_for "$evidence_id" "$reason_hash")"

  if [[ "$status" == "submitted" ]]; then
    "$NODE_BIN" "$CLI" create-challenge-record \
      --evidence-id "$evidence_id" \
      --module-digest "$MODULE_DIGEST" \
      --reason-hash "$reason_hash" \
      --challenger "$CHALLENGER_ADDRESS" \
      --reporter "$OWNER_ADDRESS" \
      --created-at "$CREATED_AT" \
      --status submitted \
      --out "$OUT_DIR/$prefix-challenge-record.json" > "$OUT_DIR/$prefix-create-challenge-record.json"
  else
    "$NODE_BIN" "$CLI" create-challenge-record \
      --evidence-id "$evidence_id" \
      --module-digest "$MODULE_DIGEST" \
      --reason-hash "$reason_hash" \
      --challenger "$CHALLENGER_ADDRESS" \
      --reporter "$OWNER_ADDRESS" \
      --created-at "$CREATED_AT" \
      --status "$status" \
      --resolution-hash "$resolution_hash" \
      --resolved-at "$resolved_at" \
      --out "$OUT_DIR/$prefix-challenge-record.json" > "$OUT_DIR/$prefix-create-challenge-record.json"
  fi

  run_cli "$CHALLENGER_PRIVATE_KEY" submit-challenge \
    --evidence-id "$evidence_id" \
    --reason-hash "$reason_hash" \
    --network local \
    --deployments-dir "$DEPLOYMENTS_DIR" \
    --broadcast > "$OUT_DIR/$prefix-submit-challenge.json"

  printf '%s:%s\n' "$evidence_id" "$challenge_id"
}

submit_response() {
  local prefix="$1"
  local evidence_id="$2"
  local challenge_id="$3"
  local response_hash="$4"
  "$NODE_BIN" "$CLI" create-challenge-response \
    --challenge-id "$challenge_id" \
    --evidence-id "$evidence_id" \
    --respondent "$OWNER_ADDRESS" \
    --response-hash "$response_hash" \
    --created-at "$CREATED_AT" \
    --out "$OUT_DIR/$prefix-challenge-response.json" > "$OUT_DIR/$prefix-create-challenge-response.json"
  run_cli "$OWNER_PRIVATE_KEY" submit-challenge-response \
    --response "$OUT_DIR/$prefix-challenge-response.json" \
    --network local \
    --deployments-dir "$DEPLOYMENTS_DIR" \
    --broadcast > "$OUT_DIR/$prefix-submit-challenge-response.json"
}

commit_verdict() {
  local prefix="$1"
  local index="$2"
  local private_key="$3"
  local validator="$4"
  local challenge_id="$5"
  local claimed_upheld="$6"
  local verdict_hash="$7"
  local method_hash="$8"
  local salt="$9"
  run_cli "$private_key" commit-validator-verdict \
    --challenge-id "$challenge_id" \
    --validator "$validator" \
    --claimed-upheld "$claimed_upheld" \
    --verdict-hash "$verdict_hash" \
    --method-hash "$method_hash" \
    --salt "$salt" \
    --created-at "$CREATED_AT" \
    --vault "$OUT_DIR/$prefix-validator-$index-vault.sqlite" \
    --commitment-out "$OUT_DIR/$prefix-commitment-$index.json" \
    --network local \
    --deployments-dir "$DEPLOYMENTS_DIR" \
    --broadcast > "$OUT_DIR/$prefix-commit-validator-verdict-$index.json"
}

reveal_verdict() {
  local prefix="$1"
  local index="$2"
  local private_key="$3"
  local validator="$4"
  local challenge_id="$5"
  run_cli "$private_key" reveal-validator-verdict \
    --challenge-id "$challenge_id" \
    --validator "$validator" \
    --vault "$OUT_DIR/$prefix-validator-$index-vault.sqlite" \
    --reveal-out "$OUT_DIR/$prefix-reveal-$index.json" \
    --network local \
    --deployments-dir "$DEPLOYMENTS_DIR" \
    --broadcast > "$OUT_DIR/$prefix-reveal-validator-verdict-$index.json"
}

create_bond_report() {
  "$NODE_BIN" "$CLI" create-test-credit-action \
    --passport-id "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" \
    --owner "$CHALLENGER_ADDRESS" \
    --action consume \
    --reason challenge_bond_lock \
    --trust-policy-report-hash "1111111111111111111111111111111111111111111111111111111111111111" \
    --created-at "$CREATED_AT" \
    --out "$OUT_DIR/test-credit-action-bond-lock.json" > "$OUT_DIR/create-test-credit-action-bond-lock.json"
  "$NODE_BIN" "$CLI" create-test-credit-action \
    --passport-id "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" \
    --owner "$CHALLENGER_ADDRESS" \
    --action grant \
    --reason challenge_bond_refund \
    --trust-policy-report-hash "1111111111111111111111111111111111111111111111111111111111111111" \
    --created-at "$CREATED_AT" \
    --out "$OUT_DIR/test-credit-action-bond-refund.json" > "$OUT_DIR/create-test-credit-action-bond-refund.json"
  "$NODE_BIN" "$CLI" create-test-credit-report \
    --passport-id "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" \
    --owner "$CHALLENGER_ADDRESS" \
    --actions "$OUT_DIR/test-credit-action-bond-lock.json" "$OUT_DIR/test-credit-action-bond-refund.json" \
    --out "$OUT_DIR/test-credit-report-bond.json" > "$OUT_DIR/create-test-credit-report-bond.json"
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
advance_time 3601
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

create_bond_report

IFS=":" read -r UPHELD_EVIDENCE UPHELD_CHALLENGE <<< "$(create_evidence_and_challenge upheld "$PROOF_BUNDLE_HASH" "$REASON_UPHELD" upheld "$FINAL_UPHELD" "2026-05-24T00:20:00.000Z")"
submit_response upheld "$UPHELD_EVIDENCE" "$UPHELD_CHALLENGE" "$RESPONSE_UPHELD"

commit_verdict upheld 1 "$VALIDATOR_1_PRIVATE_KEY" "$VALIDATOR_1_ADDRESS" "$UPHELD_CHALLENGE" true aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1 111111111111111111111111111111111111111111111111111111111111aaa1
commit_verdict upheld 2 "$VALIDATOR_2_PRIVATE_KEY" "$VALIDATOR_2_ADDRESS" "$UPHELD_CHALLENGE" true aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2 111111111111111111111111111111111111111111111111111111111111aaa2
commit_verdict upheld 3 "$VALIDATOR_3_PRIVATE_KEY" "$VALIDATOR_3_ADDRESS" "$UPHELD_CHALLENGE" true aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb3 111111111111111111111111111111111111111111111111111111111111aaa3
read_deadlines "$UPHELD_CHALLENGE" upheld
advance_time 259201
reveal_verdict upheld 1 "$VALIDATOR_1_PRIVATE_KEY" "$VALIDATOR_1_ADDRESS" "$UPHELD_CHALLENGE"
reveal_verdict upheld 2 "$VALIDATOR_2_PRIVATE_KEY" "$VALIDATOR_2_ADDRESS" "$UPHELD_CHALLENGE"
reveal_verdict upheld 3 "$VALIDATOR_3_PRIVATE_KEY" "$VALIDATOR_3_ADDRESS" "$UPHELD_CHALLENGE"

UPHELD_RESPONSE_BY="$(json_get "$OUT_DIR/upheld-deadlines.json" response_by)"
UPHELD_COMMIT_BY="$(json_get "$OUT_DIR/upheld-deadlines.json" commit_by)"
UPHELD_REVEAL_BY="$(json_get "$OUT_DIR/upheld-deadlines.json" reveal_by)"
"$NODE_BIN" "$CLI" create-adjudication-report \
  --phase finalized \
  --challenge-id "$UPHELD_CHALLENGE" \
  --claimed-upheld true \
  --final-report-hash "$FINAL_UPHELD" \
  --quorum 3 \
  --effective-verdict-count 3 \
  --response-hashes "$RESPONSE_UPHELD" \
  --commitment-hashes "$(json_get "$OUT_DIR/upheld-commitment-1.json" commitment_hash)" "$(json_get "$OUT_DIR/upheld-commitment-2.json" commitment_hash)" "$(json_get "$OUT_DIR/upheld-commitment-3.json" commitment_hash)" \
  --revealed-verdict-hashes "$(json_get "$OUT_DIR/upheld-reveal-1.json" verdict_hash)" "$(json_get "$OUT_DIR/upheld-reveal-2.json" verdict_hash)" "$(json_get "$OUT_DIR/upheld-reveal-3.json" verdict_hash)" \
  --unrevealed-commitment-count 0 \
  --response-by "$UPHELD_RESPONSE_BY" \
  --commit-by "$UPHELD_COMMIT_BY" \
  --reveal-by "$UPHELD_REVEAL_BY" \
  --finalized-at "2026-05-24T00:20:00.000Z" \
  --out "$OUT_DIR/upheld-adjudication-report.json" > "$OUT_DIR/upheld-create-adjudication-report.json"
run_cli "$OWNER_PRIVATE_KEY" finalize-challenge-adjudication \
  --report "$OUT_DIR/upheld-adjudication-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/upheld-finalize-challenge-adjudication.json"

IFS=":" read -r REJECTED_EVIDENCE REJECTED_CHALLENGE <<< "$(create_evidence_and_challenge rejected cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad561 "$REASON_REJECTED" rejected "$FINAL_REJECTED" "2026-05-24T00:30:00.000Z")"
submit_response rejected "$REJECTED_EVIDENCE" "$REJECTED_CHALLENGE" "$RESPONSE_REJECTED"
commit_verdict rejected 1 "$VALIDATOR_1_PRIVATE_KEY" "$VALIDATOR_1_ADDRESS" "$REJECTED_CHALLENGE" false aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab1 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb4 111111111111111111111111111111111111111111111111111111111111aab1
commit_verdict rejected 2 "$VALIDATOR_2_PRIVATE_KEY" "$VALIDATOR_2_ADDRESS" "$REJECTED_CHALLENGE" false aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab2 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb5 111111111111111111111111111111111111111111111111111111111111aab2
commit_verdict rejected 3 "$VALIDATOR_3_PRIVATE_KEY" "$VALIDATOR_3_ADDRESS" "$REJECTED_CHALLENGE" false aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab3 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb6 111111111111111111111111111111111111111111111111111111111111aab3
read_deadlines "$REJECTED_CHALLENGE" rejected
advance_time 259201
reveal_verdict rejected 1 "$VALIDATOR_1_PRIVATE_KEY" "$VALIDATOR_1_ADDRESS" "$REJECTED_CHALLENGE"
reveal_verdict rejected 2 "$VALIDATOR_2_PRIVATE_KEY" "$VALIDATOR_2_ADDRESS" "$REJECTED_CHALLENGE"
reveal_verdict rejected 3 "$VALIDATOR_3_PRIVATE_KEY" "$VALIDATOR_3_ADDRESS" "$REJECTED_CHALLENGE"

REJECTED_RESPONSE_BY="$(json_get "$OUT_DIR/rejected-deadlines.json" response_by)"
REJECTED_COMMIT_BY="$(json_get "$OUT_DIR/rejected-deadlines.json" commit_by)"
REJECTED_REVEAL_BY="$(json_get "$OUT_DIR/rejected-deadlines.json" reveal_by)"
"$NODE_BIN" "$CLI" create-adjudication-report \
  --phase finalized \
  --challenge-id "$REJECTED_CHALLENGE" \
  --claimed-upheld false \
  --final-report-hash "$FINAL_REJECTED" \
  --quorum 3 \
  --effective-verdict-count 3 \
  --response-hashes "$RESPONSE_REJECTED" \
  --commitment-hashes "$(json_get "$OUT_DIR/rejected-commitment-1.json" commitment_hash)" "$(json_get "$OUT_DIR/rejected-commitment-2.json" commitment_hash)" "$(json_get "$OUT_DIR/rejected-commitment-3.json" commitment_hash)" \
  --revealed-verdict-hashes "$(json_get "$OUT_DIR/rejected-reveal-1.json" verdict_hash)" "$(json_get "$OUT_DIR/rejected-reveal-2.json" verdict_hash)" "$(json_get "$OUT_DIR/rejected-reveal-3.json" verdict_hash)" \
  --unrevealed-commitment-count 0 \
  --response-by "$REJECTED_RESPONSE_BY" \
  --commit-by "$REJECTED_COMMIT_BY" \
  --reveal-by "$REJECTED_REVEAL_BY" \
  --finalized-at "2026-05-24T00:30:00.000Z" \
  --out "$OUT_DIR/rejected-adjudication-report.json" > "$OUT_DIR/rejected-create-adjudication-report.json"
run_cli "$OWNER_PRIVATE_KEY" finalize-challenge-adjudication \
  --report "$OUT_DIR/rejected-adjudication-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/rejected-finalize-challenge-adjudication.json"

IFS=":" read -r EXPIRED_EVIDENCE EXPIRED_CHALLENGE <<< "$(create_evidence_and_challenge expired cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad562 "$REASON_EXPIRED" submitted)"
advance_time 86401
commit_verdict expired 1 "$VALIDATOR_1_PRIVATE_KEY" "$VALIDATOR_1_ADDRESS" "$EXPIRED_CHALLENGE" true aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaac1 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb7 111111111111111111111111111111111111111111111111111111111111aac1
read_deadlines "$EXPIRED_CHALLENGE" expired
EXPIRED_RESPONSE_BY="$(json_get "$OUT_DIR/expired-deadlines.json" response_by)"
EXPIRED_COMMIT_BY="$(json_get "$OUT_DIR/expired-deadlines.json" commit_by)"
EXPIRED_REVEAL_BY="$(json_get "$OUT_DIR/expired-deadlines.json" reveal_by)"
advance_time 345601
"$NODE_BIN" "$CLI" create-adjudication-report \
  --phase expired_no_quorum \
  --challenge-id "$EXPIRED_CHALLENGE" \
  --expiration-report-hash "$EXPIRATION_REPORT_HASH" \
  --quorum 3 \
  --effective-verdict-count 0 \
  --commitment-hashes "$(json_get "$OUT_DIR/expired-commitment-1.json" commitment_hash)" \
  --unrevealed-commitment-count 1 \
  --response-by "$EXPIRED_RESPONSE_BY" \
  --commit-by "$EXPIRED_COMMIT_BY" \
  --reveal-by "$EXPIRED_REVEAL_BY" \
  --expired-at "2026-05-24T00:40:00.000Z" \
  --out "$OUT_DIR/expired-adjudication-report.json" > "$OUT_DIR/expired-create-adjudication-report.json"
run_cli "$OWNER_PRIVATE_KEY" expire-challenge-no-quorum \
  --report "$OUT_DIR/expired-adjudication-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/expired-expire-challenge-no-quorum.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" chain-state-check \
  --evidence-id "$UPHELD_EVIDENCE" \
  --challenge-id "$UPHELD_CHALLENGE" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" > "$OUT_DIR/upheld-chain-state-check.json"
EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" chain-state-check \
  --evidence-id "$REJECTED_EVIDENCE" \
  --challenge-id "$REJECTED_CHALLENGE" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" > "$OUT_DIR/rejected-chain-state-check.json"
EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" chain-state-check \
  --evidence-id "$EXPIRED_EVIDENCE" \
  --challenge-id "$EXPIRED_CHALLENGE" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" > "$OUT_DIR/expired-chain-state-check.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" index-events \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/events.jsonl" > "$OUT_DIR/index-events.json"

"$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --evidence-reports "$OUT_DIR/upheld-evidence-report.json" "$OUT_DIR/rejected-evidence-report.json" "$OUT_DIR/expired-evidence-report.json" \
  --challenge-records "$OUT_DIR/upheld-challenge-record.json" "$OUT_DIR/rejected-challenge-record.json" "$OUT_DIR/expired-challenge-record.json" \
  --test-credit-reports "$OUT_DIR/test-credit-report-bond.json" \
  --adjudication-reports "$OUT_DIR/upheld-adjudication-report.json" "$OUT_DIR/rejected-adjudication-report.json" "$OUT_DIR/expired-adjudication-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/audit-bundle.json" > "$OUT_DIR/audit-bundle-command.json"

"$NODE_BIN" --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const upheld = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const rejected = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const expired = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const audit = JSON.parse(readFileSync(process.argv[4], 'utf8'));
if (upheld.evidence?.statusName !== 'invalidated') throw new Error('upheld evidence not invalidated');
if (upheld.challenge?.statusName !== 'upheld') throw new Error('upheld challenge status mismatch');
if (upheld.challenge?.adjudication?.finalized !== true || upheld.challenge.adjudication.outcomeName !== 'upheld') throw new Error('upheld adjudication mismatch');
if (rejected.evidence?.statusName !== 'active') throw new Error('rejected evidence should remain active');
if (rejected.challenge?.statusName !== 'rejected') throw new Error('rejected challenge status mismatch');
if (rejected.challenge?.adjudication?.finalized !== true || rejected.challenge.adjudication.outcomeName !== 'rejected') throw new Error('rejected adjudication mismatch');
if (expired.evidence?.statusName !== 'active') throw new Error('expired evidence should remain active');
if (expired.challenge?.statusName !== 'submitted') throw new Error('expired challenge should remain unresolved in VerificationRegistry');
if (expired.challenge?.adjudication?.expired !== true || expired.challenge.adjudication.outcomeName !== 'expired_no_quorum') throw new Error('expired adjudication mismatch');
if (audit.ok !== true) throw new Error('audit bundle failed: ' + audit.errors.join('; '));
const linkages = audit.adjudication_linkage ?? [];
if (linkages.length !== 3) throw new Error('expected three adjudication linkages');
if (!linkages.some((link) => link.phase === 'expired_no_quorum' && link.expire_event_found === true)) throw new Error('missing expired linkage');
if (linkages.filter((link) => link.finalize_event_found === true).length !== 2) throw new Error('missing finalized linkages');
writeFileSync(process.argv[5], JSON.stringify({
  ok: true,
  audit_ok: audit.ok,
  upheld: upheld.challenge.adjudication,
  rejected: rejected.challenge.adjudication,
  expired: expired.challenge.adjudication,
  adjudication_linkage_count: linkages.length
}, null, 2) + '\n');
" "$OUT_DIR/upheld-chain-state-check.json" "$OUT_DIR/rejected-chain-state-check.json" "$OUT_DIR/expired-chain-state-check.json" "$OUT_DIR/audit-bundle.json" "$OUT_DIR/ec15b-summary.json"

echo "EC-15B public adjudication hardening flow passed. Artifacts: $OUT_DIR"
