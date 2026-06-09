#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec12-adversarial-simulation}"
DIRTY_DIR="$OUT_DIR/dirty"
DEPLOYMENTS_DIR="$OUT_DIR/deployments"
NODE_BIN="${NODE_BIN:-node}"
CLI="$ROOT/sdk/src/cli.ts"
RPC_URL="${EVOLUTION_CHAIN_RPC_URL:-http://127.0.0.1:8545}"
ANVIL_PORT="${ANVIL_PORT:-8545}"

OWNER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
OWNER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
SECOND_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
SECOND_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

SCHEMA_HASH="${SCHEMA_HASH:-1111111111111111111111111111111111111111111111111111111111111111}"
VALIDATION_SUMMARY_HASH="${VALIDATION_SUMMARY_HASH:-2222222222222222222222222222222222222222222222222222222222222222}"
COLLUSION_GROUP_HASH="${COLLUSION_GROUP_HASH:-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb}"
COLLUSION_RUNNER_HASH="${COLLUSION_RUNNER_HASH:-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc}"
REASON_HASH="${REASON_HASH:-8888888888888888888888888888888888888888888888888888888888888888}"
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
  if (tx.contractName && tx.contractAddress) {
    contracts[tx.contractName] = tx.contractAddress;
  }
}
for (const name of ['IdentityRegistry', 'AgentPassportRegistry', 'AgentReputationRegistry', 'EvolutionUnitKindRegistry', 'ModuleRegistry', 'VerificationRegistry', 'ScoreCommitReveal', 'TestCreditLedger']) {
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
  contractVersion: 'ec14.0.0'
}, null, 2) + '\n');
" "$ROOT" "$DEPLOYMENTS_DIR" "$OWNER_ADDRESS"
}

write_spam_proof_bundle() {
  local index="$1"
  local out="$2"
  "$NODE_BIN" --input-type=module -e "
import { writeFileSync } from 'node:fs';
import { computeProofBundleHash } from './sdk/src/proof.ts';
const index = Number(process.argv[1]);
const out = process.argv[2];
const digit = String(index);
const bundle = {
  schema_version: 'originagent.evolution.proof_bundle.v1',
  artifact_digest: digit.repeat(64),
  module_id: 'spam-tool-' + index,
  module_type: 'tool',
  module_version: '1.0.' + index,
  verification_event_hash: 'a'.repeat(64),
  activation_event_hash: '',
  verification_report_digest: 'b'.repeat(64),
  capability_snapshot_digest: '',
  telemetry_digest: 'c'.repeat(64),
  state_branch_digest: '',
  ledger_tip_hash: 'd'.repeat(64),
  created_at: '2026-05-23T00:00:00+00:00',
  actor: 'ec12-runner',
  actor_public_key: '',
  signature_scheme: 'ed25519',
  signature: '',
  proof_bundle_hash: ''
};
bundle.proof_bundle_hash = computeProofBundleHash(bundle);
writeFileSync(out, JSON.stringify(bundle, null, 2) + '\n');
" "$index" "$out"
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

mkdir -p "$OUT_DIR" "$DIRTY_DIR" "$DEPLOYMENTS_DIR"

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

for index in 1 2 3 4 5; do
  printf -v agent_key_hash "%064x" "$index"
  printf -v genesis_nonce "%064x" "$((index + 10))"
  "$NODE_BIN" "$CLI" create-agent-passport-record \
    --owner "$OWNER_ADDRESS" \
    --agent-key-hash "0x$agent_key_hash" \
    --genesis-nonce "0x$genesis_nonce" \
    --metadata-hash "0x$(printf '%064d' 0)" \
    --out "$OUT_DIR/agent-passport-$index.json" > "$OUT_DIR/create-agent-passport-$index.json"
  run_cli "$OWNER_PRIVATE_KEY" register-agent-passport \
    --owner "$OWNER_ADDRESS" \
    --agent-key-hash "$(json_get "$OUT_DIR/agent-passport-$index.json" agent_key_hash)" \
    --genesis-hash "$(json_get "$OUT_DIR/agent-passport-$index.json" genesis_hash)" \
    --metadata-hash "$(json_get "$OUT_DIR/agent-passport-$index.json" metadata_hash)" \
    --network local \
    --deployments-dir "$DEPLOYMENTS_DIR" \
    --broadcast > "$OUT_DIR/register-agent-passport-$index.json"
done

for index in 1 2 3 4 5; do
  proof_path="$OUT_DIR/spam-proof-$index.json"
  write_spam_proof_bundle "$index" "$proof_path"
  digest="$(json_get "$proof_path" artifact_digest)"
  run_cli "$OWNER_PRIVATE_KEY" submit-tool-module \
    --proof-bundle "$proof_path" \
    --storage-uri "oci://registry.example/originagent/spam-tool-$index@sha256:$digest" \
    --network local \
    --deployments-dir "$DEPLOYMENTS_DIR" \
    --broadcast > "$OUT_DIR/submit-spam-module-$index.json"
done

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
  --out "$OUT_DIR/unit-kind-proposal-tool.json" > "$OUT_DIR/create-unit-kind-proposal-tool.json"

run_cli "$OWNER_PRIVATE_KEY" propose-unit-kind \
  --proposal "$OUT_DIR/unit-kind-proposal-tool.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/propose-unit-kind-tool.json"

"$NODE_BIN" "$CLI" create-unit-kind-review \
  --kind-id tool \
  --version 1 \
  --reviewer "$OWNER_ADDRESS" \
  --recommended-status Canonical \
  --risk-assessment "low risk compatibility kind" \
  --validation-summary-hash "$VALIDATION_SUMMARY_HASH" \
  --out "$OUT_DIR/unit-kind-review-tool.json" > "$OUT_DIR/create-unit-kind-review-tool.json"

run_cli "$OWNER_PRIVATE_KEY" set-unit-kind-review \
  --review "$OUT_DIR/unit-kind-review-tool.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/set-unit-kind-review-tool.json"

run_cli "$OWNER_PRIVATE_KEY" set-unit-kind-status \
  --kind-id tool \
  --version 1 \
  --status Canonical \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/set-unit-kind-status-tool.json"

"$NODE_BIN" "$CLI" create-unit-kind-proposal \
  --kind-id to0l \
  --version 1 \
  --display-name To0l \
  --description "Typo-like tool proposal used for EC-12 simulation." \
  --runtime-surface tool_call \
  --schema-hash "$SCHEMA_HASH" \
  --schema-uri ipfs://unit-kind/to0l/v1/schema \
  --permission-model "declared permissions only" \
  --verification-profile "validator replay" \
  --risk-class executable_tool \
  --sandbox-requirement "isolated process" \
  --install-semantics "install manifest" \
  --rollback-semantics "remove manifest" \
  --compatibility-rules "resembles tool and should stay non-canonical" \
  --deprecation-rules "archive proposal after review" \
  --out "$OUT_DIR/unit-kind-proposal-to0l.json" > "$OUT_DIR/create-unit-kind-proposal-to0l.json"

self_module_digest="$(json_get "$OUT_DIR/spam-proof-1.json" artifact_digest)"
self_proof_hash="$(json_get "$OUT_DIR/spam-proof-1.json" proof_bundle_hash)"
"$NODE_BIN" "$CLI" create-evidence-report \
  --module-digest "$self_module_digest" \
  --proof-bundle-hash "$self_proof_hash" \
  --evidence-type local_client_report \
  --reporter "$SECOND_ADDRESS" \
  --operator-group-hash "$COLLUSION_GROUP_HASH" \
  --runner-fingerprint-hash "$COLLUSION_RUNNER_HASH" \
  --challenge-window-end "$CHALLENGE_WINDOW_END" \
  --out "$OUT_DIR/evidence-report-self.json" > "$OUT_DIR/create-evidence-report-self.json"

run_cli "$SECOND_PRIVATE_KEY" submit-validator-report \
  --report "$OUT_DIR/evidence-report-self.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-evidence-self.json"

self_evidence_id="$("$NODE_BIN" --input-type=module -e "
import { readEvidenceReport, computeEvidenceId } from './sdk/src/evidence.ts';
console.log(computeEvidenceId(readEvidenceReport(process.argv[1])));
" "$OUT_DIR/evidence-report-self.json")"

run_cli "$SECOND_PRIVATE_KEY" submit-challenge \
  --evidence-id "$self_evidence_id" \
  --reason-hash "$REASON_HASH" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --broadcast > "$OUT_DIR/submit-self-challenge.json"

for index in 1 2 3; do
  validator="0x$(printf "%040x" "$((index + 20))")"
  "$NODE_BIN" "$CLI" create-external-validator-artifact \
    --module-digest "$self_module_digest" \
    --validator "$validator" \
    --operator-group-hash "$COLLUSION_GROUP_HASH" \
    --runner-fingerprint-hash "$COLLUSION_RUNNER_HASH" \
    --tool-tests-hash "$(printf '%064x' "$((index + 30))")" \
    --result-digest "$(printf '%064x' "$((index + 40))")" \
    --created-at "2026-05-23T00:00:00.000Z" \
    --out "$OUT_DIR/external-validator-artifact-$index.json" > "$OUT_DIR/create-external-validator-artifact-$index.json"
  "$NODE_BIN" "$CLI" create-evidence-report \
    --module-digest "$self_module_digest" \
    --proof-bundle-hash "$self_proof_hash" \
    --evidence-type validator_report \
    --reporter "$validator" \
    --operator-group-hash "$COLLUSION_GROUP_HASH" \
    --runner-fingerprint-hash "$COLLUSION_RUNNER_HASH" \
    --challenge-window-end "$CHALLENGE_WINDOW_END" \
    --external-validator-artifact "$OUT_DIR/external-validator-artifact-$index.json" \
    --out "$OUT_DIR/evidence-report-colluding-validator-$index.json" > "$OUT_DIR/create-evidence-report-colluding-validator-$index.json"
done

"$NODE_BIN" --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const proposal = JSON.parse(readFileSync(process.argv[1], 'utf8'));
writeFileSync(process.argv[2], JSON.stringify({ ...proposal, proposal_hash: '0'.repeat(64) }, null, 2) + '\n');
writeFileSync(process.argv[3], JSON.stringify({ ...proposal, prompt: 'private prompt must be rejected' }, null, 2) + '\n');
const dirtyEvidence = JSON.parse(readFileSync(process.argv[4], 'utf8'));
writeFileSync(process.argv[5], JSON.stringify({ ...dirtyEvidence, raw_telemetry: 'api_key=ec12-secret' }, null, 2) + '\n');
" "$OUT_DIR/unit-kind-proposal-tool.json" "$DIRTY_DIR/tampered-unit-kind-proposal.json" "$DIRTY_DIR/private-unit-kind-proposal.json" "$OUT_DIR/evidence-report-self.json" "$DIRTY_DIR/private-evidence-report.json"

EVOLUTION_CHAIN_RPC_URL="$RPC_URL" "$NODE_BIN" "$CLI" index-events \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/events.jsonl" > "$OUT_DIR/index-events.json"

"$NODE_BIN" "$CLI" analyze-adversarial-simulation \
  --events "$OUT_DIR/events.jsonl" \
  --evidence-reports "$OUT_DIR/evidence-report-self.json" "$OUT_DIR/evidence-report-colluding-validator-1.json" "$OUT_DIR/evidence-report-colluding-validator-2.json" "$OUT_DIR/evidence-report-colluding-validator-3.json" "$DIRTY_DIR/private-evidence-report.json" \
  --agent-passports "$OUT_DIR/agent-passport-1.json" "$OUT_DIR/agent-passport-2.json" "$OUT_DIR/agent-passport-3.json" "$OUT_DIR/agent-passport-4.json" "$OUT_DIR/agent-passport-5.json" \
  --unit-kind-proposals "$OUT_DIR/unit-kind-proposal-tool.json" "$OUT_DIR/unit-kind-proposal-to0l.json" "$DIRTY_DIR/tampered-unit-kind-proposal.json" \
  --unit-kind-reviews "$OUT_DIR/unit-kind-review-tool.json" \
  --generated-at "2026-05-23T00:00:00.000Z" \
  --out "$OUT_DIR/abuse-report.json" > "$OUT_DIR/analyze-adversarial-simulation.json"

"$NODE_BIN" "$CLI" validate-abuse-report "$OUT_DIR/abuse-report.json" > "$OUT_DIR/validate-abuse-report.json"

"$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --agent-passports "$OUT_DIR/agent-passport-1.json" "$OUT_DIR/agent-passport-2.json" "$OUT_DIR/agent-passport-3.json" "$OUT_DIR/agent-passport-4.json" "$OUT_DIR/agent-passport-5.json" \
  --unit-kind-proposals "$OUT_DIR/unit-kind-proposal-tool.json" \
  --unit-kind-reviews "$OUT_DIR/unit-kind-review-tool.json" \
  --abuse-report "$OUT_DIR/abuse-report.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/audit-bundle.json" > "$OUT_DIR/audit-bundle-cli.json"

set +e
"$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --unit-kind-proposals "$DIRTY_DIR/tampered-unit-kind-proposal.json" \
  --unit-kind-reviews "$OUT_DIR/unit-kind-review-tool.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/audit-bundle-tampered.json" > "$OUT_DIR/audit-bundle-tampered-cli.json"
tampered_status=$?

"$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --unit-kind-proposals "$DIRTY_DIR/private-unit-kind-proposal.json" \
  --unit-kind-reviews "$OUT_DIR/unit-kind-review-tool.json" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$OUT_DIR/privacy-scan.json" > "$OUT_DIR/privacy-scan-cli.json"
privacy_status=$?
set -e

"$NODE_BIN" --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const out = process.argv[1];
const bundle = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const tampered = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const privacy = JSON.parse(readFileSync(process.argv[4], 'utf8'));
const abuse = JSON.parse(readFileSync(process.argv[5], 'utf8'));
if (bundle.ok !== true) throw new Error('normal audit-bundle.ok is not true');
if (bundle.privacy_scan?.ok !== true) throw new Error('normal privacy_scan.ok is not true');
if (tampered.ok !== false) throw new Error('tampered audit-bundle.ok is not false');
if (privacy.privacy_scan?.ok !== false) throw new Error('dirty privacy_scan.ok is not false');
const categories = new Set((abuse.signals ?? []).map((signal) => signal.category));
for (const category of ['passport_sybil', 'reputation_farming', 'validator_collusion', 'unit_kind_typosquatting']) {
  if (!categories.has(category)) throw new Error('missing abuse category: ' + category);
}
writeFileSync(out, JSON.stringify({
  schema_version: 'originagent.evolution.attack_scenarios.v1',
  scenarios: [...categories].sort(),
  normal_audit_ok: bundle.ok,
  tampered_audit_ok: tampered.ok,
  dirty_privacy_scan_ok: privacy.privacy_scan?.ok,
  high_or_critical_count: abuse.high_or_critical_count,
  tampered_cli_exit: Number(process.argv[6]),
  privacy_cli_exit: Number(process.argv[7])
}, null, 2) + '\n');
" "$OUT_DIR/attack-scenarios.json" "$OUT_DIR/audit-bundle.json" "$OUT_DIR/audit-bundle-tampered.json" "$OUT_DIR/privacy-scan.json" "$OUT_DIR/abuse-report.json" "$tampered_status" "$privacy_status"

echo "EC-12 adversarial simulation flow passed. Artifacts: $OUT_DIR"
