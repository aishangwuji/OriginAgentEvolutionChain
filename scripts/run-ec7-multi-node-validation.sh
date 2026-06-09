#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec7-multi-node-validation}"
REMOTE_BASE="${EC7_REMOTE_BASE:-/root/originagent-ec7-live}"
REMOTE_PROJECT="$REMOTE_BASE/OriginAgentEvolutionChain"

EC7_SSH_KEY="${EC7_SSH_KEY:-$HOME/.ssh/originagent_ec3_validator}"
EC7_NODE_USER="${EC7_NODE_USER:-root}"
EC7_COORDINATOR_HOST="${EC7_COORDINATOR_HOST:-47.84.130.213}"
EC7_VALIDATOR2_HOST="${EC7_VALIDATOR2_HOST:-154.40.59.232}"
EC7_COORDINATOR_NAME="${EC7_COORDINATOR_NAME:-oaec-coordinator}"
EC7_VALIDATOR2_NAME="${EC7_VALIDATOR2_NAME:-oaec-validator-2}"

NODE_BIN="${NODE_BIN:-node}"
RPC_URL="${EVOLUTION_CHAIN_RPC_URL:-http://127.0.0.1:8545}"
ANVIL_PORT="${ANVIL_PORT:-8545}"

OWNER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
VALIDATOR1_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
CHALLENGER_ADDRESS="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
OWNER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
VALIDATOR1_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
CHALLENGER_PRIVATE_KEY="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
VALIDATOR2_PRIVATE_KEY="${EC7_VALIDATOR2_PRIVATE_KEY:-0x0000000000000000000000000000000000000000000000000000000000000042}"

MODULE_DIGEST="${MODULE_DIGEST:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
PROOF_BUNDLE_HASH="${PROOF_BUNDLE_HASH:-cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e}"
METADATA_HASH1="${METADATA_HASH1:-7777777777777777777777777777777777777777777777777777777777777777}"
METADATA_HASH2="${METADATA_HASH2:-7878787878787878787878787878787878787878787878787878787878787878}"
OPERATOR_GROUP_HASH1="${OPERATOR_GROUP_HASH1:-1111111111111111111111111111111111111111111111111111111111111111}"
RUNNER_FINGERPRINT_HASH1="${RUNNER_FINGERPRINT_HASH1:-2222222222222222222222222222222222222222222222222222222222222222}"
OPERATOR_GROUP_HASH2="${OPERATOR_GROUP_HASH2:-3333333333333333333333333333333333333333333333333333333333333333}"
RUNNER_FINGERPRINT_HASH2="${RUNNER_FINGERPRINT_HASH2:-4444444444444444444444444444444444444444444444444444444444444444}"
TOOL_TESTS_HASH1="${TOOL_TESTS_HASH1:-2b517d681fb728bf05da53e4a79f53005968476affe5cb239cdedaf4a46a53bc}"
RESULT_DIGEST1="${RESULT_DIGEST1:-cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e}"
TOOL_TESTS_HASH2="${TOOL_TESTS_HASH2:-3b517d681fb728bf05da53e4a79f53005968476affe5cb239cdedaf4a46a53bc}"
RESULT_DIGEST2="${RESULT_DIGEST2:-db18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e}"
CREATED_AT="${CREATED_AT:-2026-05-23T00:00:00Z}"
RESOLVED_AT="${RESOLVED_AT:-2026-05-23T00:20:00Z}"
CHALLENGE_WINDOW_END="${CHALLENGE_WINDOW_END:-1893456000}"
REASON_HASH="${REASON_HASH:-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb}"
RESOLUTION_HASH="${RESOLUTION_HASH:-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc}"

if [[ ! -f "$EC7_SSH_KEY" ]]; then
  echo "EC7_SSH_KEY not found: $EC7_SSH_KEY" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

ssh_args=(
  -i "$EC7_SSH_KEY"
  -o PreferredAuthentications=publickey
  -o PasswordAuthentication=no
  -o StrictHostKeyChecking=accept-new
)

target_for() {
  local host="$1"
  if [[ "$host" == *@* ]]; then
    printf '%s' "$host"
  else
    printf '%s@%s' "$EC7_NODE_USER" "$host"
  fi
}

ssh_node() {
  local host="$1"
  shift
  ssh "${ssh_args[@]}" "$(target_for "$host")" "$@"
}

scp_to_node() {
  local source="$1"
  local host="$2"
  local target="$3"
  scp -i "$EC7_SSH_KEY" -o PreferredAuthentications=publickey -o PasswordAuthentication=no -o StrictHostKeyChecking=accept-new "$source" "$(target_for "$host"):$target"
}

scp_from_node() {
  local host="$1"
  local source="$2"
  local target="$3"
  scp -i "$EC7_SSH_KEY" -o PreferredAuthentications=publickey -o PasswordAuthentication=no -o StrictHostKeyChecking=accept-new "$(target_for "$host"):$source" "$target"
}

bootstrap_node() {
  local role="$1"
  local host="$2"
  local name="$3"
  EC7_SSH_KEY="$EC7_SSH_KEY" \
    EC7_NODE_HOST="$host" \
    EC7_NODE_ROLE="$role" \
    EC7_NODE_NAME="$name" \
    EC7_NODE_USER="$EC7_NODE_USER" \
    OUT_DIR="$OUT_DIR" \
    "$ROOT/scripts/bootstrap-ec7-node.sh"
}

package_repo() {
  local package="$OUT_DIR/OriginAgentEvolutionChain-ec7.tgz"
  tar -czf "$package" \
    --exclude='OriginAgentEvolutionChain/node_modules' \
    --exclude='OriginAgentEvolutionChain/out' \
    --exclude='OriginAgentEvolutionChain/.claude' \
    --exclude='OriginAgentEvolutionChain/contracts/cache' \
    --exclude='OriginAgentEvolutionChain/contracts/out' \
    --exclude='OriginAgentEvolutionChain/contracts/broadcast' \
    -C "$(dirname "$ROOT")" OriginAgentEvolutionChain
  printf '%s' "$package"
}

prepare_node() {
  local role="$1"
  local host="$2"
  local package="$3"
  local log_dir="$OUT_DIR/$role"
  mkdir -p "$log_dir"
  ssh_node "$host" "rm -rf '$REMOTE_BASE'; mkdir -p '$REMOTE_BASE'"
  scp_to_node "$package" "$host" "$REMOTE_BASE/OriginAgentEvolutionChain-ec7.tgz"
  ssh_node "$host" "set -e; cd '$REMOTE_BASE'; tar -xzf OriginAgentEvolutionChain-ec7.tgz; cd OriginAgentEvolutionChain; npm install --no-audit --no-fund; npm test; npm run test:contracts" \
    | tee "$log_dir/remote-validation.log"
}

remote_validator_artifacts() {
  local role="$1"
  local host="$2"
  local validator_address="$3"
  local operator_group_hash="$4"
  local runner_fingerprint_hash="$5"
  local tool_tests_hash="$6"
  local result_digest="$7"

  ssh_node "$host" \
    "EC7_ROLE='$role' EC7_VALIDATOR_ADDRESS='$validator_address' EC7_MODULE_DIGEST='$MODULE_DIGEST' EC7_PROOF_BUNDLE_HASH='$PROOF_BUNDLE_HASH' EC7_OPERATOR_GROUP_HASH='$operator_group_hash' EC7_RUNNER_FINGERPRINT_HASH='$runner_fingerprint_hash' EC7_TOOL_TESTS_HASH='$tool_tests_hash' EC7_RESULT_DIGEST='$result_digest' EC7_CREATED_AT='$CREATED_AT' EC7_CHALLENGE_WINDOW_END='$CHALLENGE_WINDOW_END' EC7_REMOTE_PROJECT='$REMOTE_PROJECT' bash -s" <<'REMOTE'
set -euo pipefail
cd "$EC7_REMOTE_PROJECT"
role_dir="out/ec7-multi-node-validation/$EC7_ROLE"
mkdir -p "$role_dir"

node sdk/src/cli.ts create-external-validator-artifact \
  --module-digest "$EC7_MODULE_DIGEST" \
  --validator "$EC7_VALIDATOR_ADDRESS" \
  --operator-group-hash "$EC7_OPERATOR_GROUP_HASH" \
  --runner-fingerprint-hash "$EC7_RUNNER_FINGERPRINT_HASH" \
  --tool-tests-hash "$EC7_TOOL_TESTS_HASH" \
  --result-digest "$EC7_RESULT_DIGEST" \
  --created-at "$EC7_CREATED_AT" \
  --out "$role_dir/external-validator-artifact.json" > "$role_dir/create-external-validator-artifact.json"

node sdk/src/cli.ts validate-external-validator-artifact "$role_dir/external-validator-artifact.json" \
  > "$role_dir/validate-external-validator-artifact.json"

node sdk/src/cli.ts create-evidence-report \
  --module-digest "$EC7_MODULE_DIGEST" \
  --proof-bundle-hash "$EC7_PROOF_BUNDLE_HASH" \
  --evidence-type validator_report \
  --reporter "$EC7_VALIDATOR_ADDRESS" \
  --operator-group-hash "$EC7_OPERATOR_GROUP_HASH" \
  --runner-fingerprint-hash "$EC7_RUNNER_FINGERPRINT_HASH" \
  --challenge-window-end "$EC7_CHALLENGE_WINDOW_END" \
  --external-validator-artifact "$role_dir/external-validator-artifact.json" \
  --out "$role_dir/evidence-report.json" > "$role_dir/create-evidence-report.json"
REMOTE

  mkdir -p "$OUT_DIR/$role"
  scp_from_node "$host" "$REMOTE_PROJECT/out/ec7-multi-node-validation/$role/external-validator-artifact.json" "$OUT_DIR/$role/external-validator-artifact.json"
  scp_from_node "$host" "$REMOTE_PROJECT/out/ec7-multi-node-validation/$role/evidence-report.json" "$OUT_DIR/$role/evidence-report.json"
}

run_coordinator_chain_flow() {
  local validator2_address="$1"

  ssh_node "$EC7_COORDINATOR_HOST" \
    "EC7_REMOTE_PROJECT='$REMOTE_PROJECT' EC7_RPC_URL='$RPC_URL' EC7_ANVIL_PORT='$ANVIL_PORT' EC7_OWNER_ADDRESS='$OWNER_ADDRESS' EC7_VALIDATOR1_ADDRESS='$VALIDATOR1_ADDRESS' EC7_VALIDATOR2_ADDRESS='$validator2_address' EC7_CHALLENGER_ADDRESS='$CHALLENGER_ADDRESS' EC7_OWNER_PRIVATE_KEY='$OWNER_PRIVATE_KEY' EC7_VALIDATOR1_PRIVATE_KEY='$VALIDATOR1_PRIVATE_KEY' EC7_VALIDATOR2_PRIVATE_KEY='$VALIDATOR2_PRIVATE_KEY' EC7_CHALLENGER_PRIVATE_KEY='$CHALLENGER_PRIVATE_KEY' EC7_MODULE_DIGEST='$MODULE_DIGEST' EC7_METADATA_HASH1='$METADATA_HASH1' EC7_METADATA_HASH2='$METADATA_HASH2' EC7_OPERATOR_GROUP_HASH1='$OPERATOR_GROUP_HASH1' EC7_RUNNER_FINGERPRINT_HASH1='$RUNNER_FINGERPRINT_HASH1' EC7_OPERATOR_GROUP_HASH2='$OPERATOR_GROUP_HASH2' EC7_RUNNER_FINGERPRINT_HASH2='$RUNNER_FINGERPRINT_HASH2' EC7_CREATED_AT='$CREATED_AT' EC7_RESOLVED_AT='$RESOLVED_AT' EC7_REASON_HASH='$REASON_HASH' EC7_RESOLUTION_HASH='$RESOLUTION_HASH' bash -s" <<'REMOTE'
set -euo pipefail

cd "$EC7_REMOTE_PROJECT"
OUT_DIR="$EC7_REMOTE_PROJECT/out/ec7-multi-node-validation"
DEPLOYMENTS_DIR="$OUT_DIR/deployments"
CLI="$EC7_REMOTE_PROJECT/sdk/src/cli.ts"
mkdir -p "$OUT_DIR" "$DEPLOYMENTS_DIR"

run_cli() {
  local private_key="$1"
  shift
  EVOLUTION_CHAIN_RPC_URL="$EC7_RPC_URL" EVOLUTION_CHAIN_PRIVATE_KEY="$private_key" node "$CLI" "$@"
}

wait_for_anvil() {
  for _ in $(seq 1 30); do
    if cast chain-id --rpc-url "$EC7_RPC_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "anvil RPC did not become ready at $EC7_RPC_URL" >&2
  exit 1
}

write_deployment_file() {
  node --input-type=module -e "
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
for (const name of ['IdentityRegistry', 'AgentPassportRegistry', 'ModuleRegistry', 'VerificationRegistry', 'ScoreCommitReveal']) {
  if (!contracts[name]) throw new Error('missing deployed contract address: ' + name);
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
" "$EC7_REMOTE_PROJECT" "$DEPLOYMENTS_DIR" "$EC7_OWNER_ADDRESS"
}

cleanup() {
  if [[ -n "${ANVIL_PID:-}" ]]; then
    kill "$ANVIL_PID" >/dev/null 2>&1 || true
  fi
}

if command -v pkill >/dev/null 2>&1; then
  pkill -f "anvil.*${EC7_ANVIL_PORT}" >/dev/null 2>&1 || true
fi

anvil --host 127.0.0.1 --port "$EC7_ANVIL_PORT" --chain-id 31337 >/dev/null 2>&1 &
ANVIL_PID=$!
trap cleanup EXIT
wait_for_anvil

cast rpc --rpc-url "$EC7_RPC_URL" anvil_setBalance "$EC7_VALIDATOR2_ADDRESS" "0x3635C9ADC5DEA00000" >/dev/null

(
  cd "$EC7_REMOTE_PROJECT/contracts"
  forge script script/Deploy.s.sol:Deploy --rpc-url "$EC7_RPC_URL" --broadcast --private-key "$EC7_OWNER_PRIVATE_KEY" \
    > "$OUT_DIR/deploy.log"
)
write_deployment_file

run_cli "$EC7_VALIDATOR1_PRIVATE_KEY" register-identity \
  --role validator \
  --metadata-hash "$EC7_METADATA_HASH1" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/register-identity.validator-1.json"

run_cli "$EC7_VALIDATOR2_PRIVATE_KEY" register-identity \
  --role validator \
  --metadata-hash "$EC7_METADATA_HASH2" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/register-identity.validator-2.json"

run_cli "$EC7_OWNER_PRIVATE_KEY" submit-tool-module \
  --proof-bundle fixtures/proof_bundle.tool.valid.json \
  --storage-uri "oci://registry.example/originagent/demo-tool@sha256:$EC7_MODULE_DIGEST" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-tool-module.json"

run_cli "$EC7_OWNER_PRIVATE_KEY" set-validator-profile \
  --validator "$EC7_VALIDATOR1_ADDRESS" \
  --operator-group-hash "$EC7_OPERATOR_GROUP_HASH1" \
  --runner-fingerprint-hash "$EC7_RUNNER_FINGERPRINT_HASH1" \
  --allowed true \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/set-validator-profile.validator-1.json"

run_cli "$EC7_OWNER_PRIVATE_KEY" set-validator-profile \
  --validator "$EC7_VALIDATOR2_ADDRESS" \
  --operator-group-hash "$EC7_OPERATOR_GROUP_HASH2" \
  --runner-fingerprint-hash "$EC7_RUNNER_FINGERPRINT_HASH2" \
  --allowed true \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/set-validator-profile.validator-2.json"

run_cli "$EC7_VALIDATOR1_PRIVATE_KEY" submit-validator-report \
  --report "$OUT_DIR/validator-1/evidence-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-validator-report.validator-1.json"

run_cli "$EC7_VALIDATOR2_PRIVATE_KEY" submit-validator-report \
  --report "$OUT_DIR/validator-2/evidence-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-validator-report.validator-2.json"

EVIDENCE1_ID="$(node --input-type=module -e "import { computeEvidenceId, readEvidenceReport } from './sdk/src/evidence.ts'; console.log(computeEvidenceId(readEvidenceReport(process.argv[1])));" "$OUT_DIR/validator-1/evidence-report.json")"
EVIDENCE2_ID="$(node --input-type=module -e "import { computeEvidenceId, readEvidenceReport } from './sdk/src/evidence.ts'; console.log(computeEvidenceId(readEvidenceReport(process.argv[1])));" "$OUT_DIR/validator-2/evidence-report.json")"

node "$CLI" create-challenge-record \
  --evidence-id "$EVIDENCE1_ID" \
  --module-digest "$EC7_MODULE_DIGEST" \
  --reason-hash "$EC7_REASON_HASH" \
  --challenger "$EC7_CHALLENGER_ADDRESS" \
  --created-at "$EC7_CREATED_AT" \
  --status rejected \
  --resolution-hash "$EC7_RESOLUTION_HASH" \
  --resolved-at "$EC7_RESOLVED_AT" \
  --out "$OUT_DIR/challenge-record.json" > "$OUT_DIR/create-challenge-record.json"

CHALLENGE_ID="$(node --input-type=module -e "import { computeChallengeId } from './sdk/src/evidence.ts'; console.log(computeChallengeId(process.argv[1], process.argv[2], process.argv[3]));" "$EVIDENCE1_ID" "$EC7_CHALLENGER_ADDRESS" "$EC7_REASON_HASH")"

run_cli "$EC7_CHALLENGER_PRIVATE_KEY" submit-challenge \
  --evidence-id "$EVIDENCE1_ID" \
  --reason-hash "$EC7_REASON_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-challenge.json"

run_cli "$EC7_OWNER_PRIVATE_KEY" resolve-challenge \
  --challenge-id "$CHALLENGE_ID" \
  --upheld false \
  --resolution-hash "$EC7_RESOLUTION_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/resolve-challenge.json"

EVOLUTION_CHAIN_RPC_URL="$EC7_RPC_URL" node "$CLI" chain-state-check \
  --module-digest "$EC7_MODULE_DIGEST" \
  --evidence-id "$EVIDENCE1_ID" \
  --challenge-id "$CHALLENGE_ID" \
  --reporter "$EC7_VALIDATOR1_ADDRESS" \
  --challenger "$EC7_CHALLENGER_ADDRESS" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" > "$OUT_DIR/chain-state-check.json"

EVOLUTION_CHAIN_RPC_URL="$EC7_RPC_URL" node "$CLI" chain-state-check \
  --evidence-id "$EVIDENCE2_ID" \
  --reporter "$EC7_VALIDATOR2_ADDRESS" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" > "$OUT_DIR/chain-state-check.validator-2.json"

node --input-type=module -e "
import { readFileSync } from 'node:fs';
const primary = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const secondary = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (primary.module?.exists !== true) throw new Error('module was not submitted');
if (primary.evidence?.statusName !== 'active') throw new Error('primary evidence was not active after rejected challenge');
if (secondary.evidence?.statusName !== 'active') throw new Error('secondary evidence was not active');
if (primary.challenge?.statusName !== 'rejected') throw new Error('challenge was not rejected');
if (primary.challenger?.testnetReputation !== -2) throw new Error('challenger reputation mismatch');
" "$OUT_DIR/chain-state-check.json" "$OUT_DIR/chain-state-check.validator-2.json"

EVOLUTION_CHAIN_RPC_URL="$EC7_RPC_URL" node "$CLI" index-events \
  --from-block 0 \
  --to-block latest \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/events.jsonl" > "$OUT_DIR/index-events.json"

node "$CLI" challenge-summary \
  --challenges "$OUT_DIR/challenge-record.json" \
  > "$OUT_DIR/challenge-summary.json"

node "$CLI" evidence-summary \
  --reports "$OUT_DIR/validator-1/evidence-report.json" "$OUT_DIR/validator-2/evidence-report.json" \
  --challenge-summary "$OUT_DIR/challenge-summary.json" \
  > "$OUT_DIR/evidence-summary.json"

EVOLUTION_CHAIN_RPC_URL="$EC7_RPC_URL" node "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --evidence-reports "$OUT_DIR/validator-1/evidence-report.json" "$OUT_DIR/validator-2/evidence-report.json" \
  --challenge-records "$OUT_DIR/challenge-record.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/audit-bundle.json" > "$OUT_DIR/create-audit-bundle.json"

node --input-type=module -e "
import { readFileSync } from 'node:fs';
const evidence = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const bundle = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (evidence.ok !== true) throw new Error('evidence summary errors: ' + evidence.errors.join('; '));
if (evidence.acceptedReports !== 2) throw new Error('acceptedReports mismatch');
if (evidence.highConfidence !== true) throw new Error('highConfidence mismatch');
if (evidence.effectiveValidatorGroups.length !== 2) throw new Error('validator group diversity mismatch');
if (evidence.effectiveRunnerFingerprints.length !== 2) throw new Error('runner fingerprint diversity mismatch');
if (bundle.ok !== true) throw new Error('audit bundle failed: ' + bundle.errors.join('; '));
if (bundle.evidence_linkage.length !== 2) throw new Error('audit bundle evidence linkage mismatch');
if (!bundle.evidence_linkage.every((item) => item.artifact_matched === true)) throw new Error('audit evidence linkage failed');
if (bundle.challenge_linkage[0]?.invalidation_found !== false) throw new Error('rejected challenge should not require invalidation');
" "$OUT_DIR/evidence-summary.json" "$OUT_DIR/audit-bundle.json"

if find "$OUT_DIR" \( -name '*.json' -o -name '*.jsonl' \) -print0 | xargs -0 grep -E '"(raw_prompt|prompt|facts|facts_raw|facts_text|private_telemetry|private_key|password|token|secret)"|[A-Za-z]:\\|/home/|/Users/|https?://[^ ?]+\?' >/dev/null; then
  echo "privacy scan failed for EC-7 validation JSON outputs" >&2
  exit 1
fi

echo "$OUT_DIR"
REMOTE
}

bootstrap_node "coordinator" "$EC7_COORDINATOR_HOST" "$EC7_COORDINATOR_NAME"
bootstrap_node "validator-2" "$EC7_VALIDATOR2_HOST" "$EC7_VALIDATOR2_NAME"

package="$(package_repo)"
prepare_node "coordinator" "$EC7_COORDINATOR_HOST" "$package"
prepare_node "validator-2" "$EC7_VALIDATOR2_HOST" "$package"

validator2_address="$(ssh_node "$EC7_VALIDATOR2_HOST" "cast wallet address --private-key '$VALIDATOR2_PRIVATE_KEY'")"
printf '{"schema_version":"originagent.evolution.ec7_node_address.v1","role":"validator-2","address":"%s"}\n' "$validator2_address" \
  > "$OUT_DIR/validator-2/address.json"

remote_validator_artifacts "validator-1" "$EC7_COORDINATOR_HOST" "$VALIDATOR1_ADDRESS" "$OPERATOR_GROUP_HASH1" "$RUNNER_FINGERPRINT_HASH1" "$TOOL_TESTS_HASH1" "$RESULT_DIGEST1"
remote_validator_artifacts "validator-2" "$EC7_VALIDATOR2_HOST" "$validator2_address" "$OPERATOR_GROUP_HASH2" "$RUNNER_FINGERPRINT_HASH2" "$TOOL_TESTS_HASH2" "$RESULT_DIGEST2"

ssh_node "$EC7_COORDINATOR_HOST" "mkdir -p '$REMOTE_PROJECT/out/ec7-multi-node-validation/validator-2'"
scp_to_node "$OUT_DIR/validator-2/external-validator-artifact.json" "$EC7_COORDINATOR_HOST" "$REMOTE_PROJECT/out/ec7-multi-node-validation/validator-2/external-validator-artifact.json"
scp_to_node "$OUT_DIR/validator-2/evidence-report.json" "$EC7_COORDINATOR_HOST" "$REMOTE_PROJECT/out/ec7-multi-node-validation/validator-2/evidence-report.json"

run_coordinator_chain_flow "$validator2_address"

scp -i "$EC7_SSH_KEY" -o PreferredAuthentications=publickey -o PasswordAuthentication=no -o StrictHostKeyChecking=accept-new \
  -r "$(target_for "$EC7_COORDINATOR_HOST"):$REMOTE_PROJECT/out/ec7-multi-node-validation/"* "$OUT_DIR/"

if find "$OUT_DIR" \( -name '*.json' -o -name '*.jsonl' \) -print0 | xargs -0 grep -E '"(raw_prompt|prompt|facts|facts_raw|facts_text|private_telemetry|private_key|password|token|secret)"|[A-Za-z]:\\|/home/|/Users/|https?://[^ ?]+\?' >/dev/null; then
  echo "privacy scan failed for local EC-7 validation artifacts" >&2
  exit 1
fi

echo "$OUT_DIR"
