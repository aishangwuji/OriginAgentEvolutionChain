#!/usr/bin/env bash
set -euo pipefail

PATH="/usr/bin:/bin:$PATH"
SCRIPT_DIR="${BASH_SOURCE[0]%/*}"
if [[ "$SCRIPT_DIR" == "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="."
fi
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec16a-module-verification-protocol-flow}"
NODE_BIN="${NODE_BIN:-node}"
CLI="$ROOT/sdk/src/cli.ts"

CREATED_AT="${CREATED_AT:-2026-05-25T00:00:00.000Z}"
RESPONSIBLE_ADDRESS="${RESPONSIBLE_ADDRESS:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"
VALIDATOR_ADDRESS="${VALIDATOR_ADDRESS:-0x70997970C51812dc3A010C7d01b50e0d17dc79C8}"
AGENT_PASSPORT_ID="${AGENT_PASSPORT_ID:-0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
MODULE_ID="${MODULE_ID:-ec16a-demo-module}"
MODULE_NAME="${MODULE_NAME:-EC16A Demo Module}"
MODULE_VERSION="${MODULE_VERSION:-1.0.0}"
STORAGE_URI="${STORAGE_URI:-https://github.com/originagent/demo-modules/releases/download/ec16a/demo-module.tgz}"
SOURCE_REPOSITORY_URI="${SOURCE_REPOSITORY_URI:-https://github.com/originagent/demo-modules}"
PROOF_URI="${PROOF_URI:-https://github.com/originagent/evolution-proofs/releases/download/ec16a/community-work-proof.txt}"
LOG_URI="${LOG_URI:-https://github.com/originagent/evolution-proofs/releases/download/ec16a/verification-run-log.txt}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

assert_out_dir_safe() {
  case "$OUT_DIR" in
    "$ROOT"/out/ec16a-module-verification-protocol-flow*)
      ;;
    *)
      echo "refusing to clean OUT_DIR outside EC-16A flow output: $OUT_DIR" >&2
      exit 1
      ;;
  esac
}

sha256_file() {
  "$NODE_BIN" --input-type=module -e "
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
console.log(createHash('sha256').update(readFileSync(process.argv[1])).digest('hex'));
" "$1"
}

json_get() {
  "$NODE_BIN" --input-type=module -e "
import { readFileSync } from 'node:fs';
const value = JSON.parse(readFileSync(process.argv[1], 'utf8'))[process.argv[2]];
if (value === undefined) throw new Error('missing JSON key: ' + process.argv[2]);
console.log(value);
" "$1" "$2"
}

hash_environment() {
  "$NODE_BIN" --input-type=module -e "
import { hashVerificationEnvironment } from './sdk/src/module-verification.ts';
console.log(hashVerificationEnvironment({
  node_version: '24.x',
  os: 'linux',
  runner_version: 'ec16a-runner-v1',
  sandbox_image_digest: '1111111111111111111111111111111111111111111111111111111111111111'
}));
"
}

assert_audit_ok() {
  "$NODE_BIN" --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const audit = JSON.parse(readFileSync(process.argv[1], 'utf8'));
if (audit.ok !== true) throw new Error('expected audit ok=true: ' + audit.errors.join('; '));
const linkages = audit.community_work_linkage ?? [];
if (linkages.length !== 1) throw new Error('expected one community work linkage');
const linkage = linkages[0];
if (linkage.manifest_linked !== true) throw new Error('manifest linkage missing');
if (linkage.acquisition_receipt_linked !== true) throw new Error('acquisition linkage missing');
if (linkage.verification_run_linked !== true) throw new Error('verification run linkage missing');
if (linkage.hash_matched !== true) throw new Error('hash_matched should be true');
if (linkage.proof_bound !== true) throw new Error('proof binding missing');
writeFileSync(process.argv[2], JSON.stringify({
  ok: true,
  audit_ok: audit.ok,
  community_work_linkage_count: linkages.length,
  claim_id: linkage.claim_id,
  responsible_address: linkage.responsible_address,
  work_kind: linkage.work_kind
}, null, 2) + '\n');
" "$1" "$2"
}

assert_audit_failed() {
  "$NODE_BIN" --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const audit = JSON.parse(readFileSync(process.argv[1], 'utf8'));
if (audit.ok !== false) throw new Error('expected audit ok=false');
if (!audit.errors.some((error) => error.includes('hash_matched=false'))) {
  throw new Error('expected hash_matched=false audit error');
}
writeFileSync(process.argv[2], JSON.stringify({
  ok: true,
  audit_ok: audit.ok,
  expected_failure_found: true,
  errors: audit.errors
}, null, 2) + '\n');
" "$1" "$2"
}

require_command "$NODE_BIN"
assert_out_dir_safe

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/fixtures"
cd "$ROOT"

cat > "$OUT_DIR/fixtures/demo-module.txt" <<'EOF'
EC-16A demo module body.
The URI identifies where this artifact could be distributed.
The digest is the authority for install and verification.
EOF

cat > "$OUT_DIR/fixtures/verification-run-log.txt" <<'EOF'
verification_started=true
module_loaded=true
hash_checked=true
result=passed
EOF

cat > "$OUT_DIR/fixtures/community-work-proof.txt" <<'EOF'
Tester downloaded the module fixture, recomputed the digest, executed the sandbox verification run, and linked all artifacts in a community work claim.
EOF

MODULE_DIGEST="$(sha256_file "$OUT_DIR/fixtures/demo-module.txt")"
LOG_DIGEST="$(sha256_file "$OUT_DIR/fixtures/verification-run-log.txt")"
PROOF_DIGEST="$(sha256_file "$OUT_DIR/fixtures/community-work-proof.txt")"
ENVIRONMENT_HASH="$(hash_environment)"

: > "$OUT_DIR/events.jsonl"

"$NODE_BIN" "$CLI" create-module-manifest \
  --module-id "$MODULE_ID" \
  --module-name "$MODULE_NAME" \
  --version "$MODULE_VERSION" \
  --storage-uri "$STORAGE_URI" \
  --storage-kind github_release \
  --module-digest "$MODULE_DIGEST" \
  --digest-algorithm sha256 \
  --responsible-address "$RESPONSIBLE_ADDRESS" \
  --agent-passport-id "$AGENT_PASSPORT_ID" \
  --source-repository-uri "$SOURCE_REPOSITORY_URI" \
  --created-at "$CREATED_AT" \
  --out "$OUT_DIR/module-manifest.json" > "$OUT_DIR/create-module-manifest.json"

"$NODE_BIN" "$CLI" validate-module-manifest "$OUT_DIR/module-manifest.json" > "$OUT_DIR/validate-module-manifest.json"

MANIFEST_HASH="$(json_get "$OUT_DIR/module-manifest.json" manifest_hash)"

"$NODE_BIN" "$CLI" create-module-acquisition-receipt \
  --module-id "$MODULE_ID" \
  --manifest-hash "$MANIFEST_HASH" \
  --storage-uri "$STORAGE_URI" \
  --downloaded-digest "$MODULE_DIGEST" \
  --expected-digest "$MODULE_DIGEST" \
  --hash-matched true \
  --acquired-by "$VALIDATOR_ADDRESS" \
  --acquired-at "$CREATED_AT" \
  --created-at "$CREATED_AT" \
  --out "$OUT_DIR/module-acquisition-receipt.json" > "$OUT_DIR/create-module-acquisition-receipt.json"

"$NODE_BIN" "$CLI" validate-module-acquisition-receipt "$OUT_DIR/module-acquisition-receipt.json" > "$OUT_DIR/validate-module-acquisition-receipt.json"

ACQUISITION_RECEIPT_HASH="$(json_get "$OUT_DIR/module-acquisition-receipt.json" receipt_hash)"

"$NODE_BIN" "$CLI" create-verification-run-receipt \
  --module-id "$MODULE_ID" \
  --manifest-hash "$MANIFEST_HASH" \
  --acquisition-receipt-hash "$ACQUISITION_RECEIPT_HASH" \
  --validator-address "$VALIDATOR_ADDRESS" \
  --environment-hash "$ENVIRONMENT_HASH" \
  --run-result passed \
  --log-uri "$LOG_URI" \
  --log-digest "$LOG_DIGEST" \
  --started-at "$CREATED_AT" \
  --completed-at "2026-05-25T00:05:00.000Z" \
  --created-at "2026-05-25T00:06:00.000Z" \
  --out "$OUT_DIR/verification-run-receipt.json" > "$OUT_DIR/create-verification-run-receipt.json"

"$NODE_BIN" "$CLI" validate-verification-run-receipt "$OUT_DIR/verification-run-receipt.json" > "$OUT_DIR/validate-verification-run-receipt.json"

RUN_RECEIPT_HASH="$(json_get "$OUT_DIR/verification-run-receipt.json" receipt_hash)"

"$NODE_BIN" "$CLI" create-community-work-claim \
  --claim-id ec16a-demo-testing-claim \
  --responsible-address "$RESPONSIBLE_ADDRESS" \
  --agent-passport-id "$AGENT_PASSPORT_ID" \
  --work-kind testing \
  --summary "Downloaded module fixture, verified digest, ran sandbox verification, and linked receipts." \
  --proof-uri "$PROOF_URI" \
  --proof-digest "$PROOF_DIGEST" \
  --artifact-hashes "$MANIFEST_HASH" "$ACQUISITION_RECEIPT_HASH" "$RUN_RECEIPT_HASH" \
  --created-at "2026-05-25T00:07:00.000Z" \
  --out "$OUT_DIR/community-work-claim.json" > "$OUT_DIR/create-community-work-claim.json"

"$NODE_BIN" "$CLI" validate-community-work-claim "$OUT_DIR/community-work-claim.json" > "$OUT_DIR/validate-community-work-claim.json"

"$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --module-manifests "$OUT_DIR/module-manifest.json" \
  --module-acquisition-receipts "$OUT_DIR/module-acquisition-receipt.json" \
  --verification-run-receipts "$OUT_DIR/verification-run-receipt.json" \
  --community-work-claims "$OUT_DIR/community-work-claim.json" \
  --network local \
  --out "$OUT_DIR/audit-bundle.json" > "$OUT_DIR/audit-bundle-command.json"

assert_audit_ok "$OUT_DIR/audit-bundle.json" "$OUT_DIR/ec16a-summary.json"

"$NODE_BIN" "$CLI" create-module-acquisition-receipt \
  --module-id "$MODULE_ID" \
  --manifest-hash "$MANIFEST_HASH" \
  --storage-uri "$STORAGE_URI" \
  --downloaded-digest "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" \
  --expected-digest "$MODULE_DIGEST" \
  --hash-matched false \
  --acquired-by "$VALIDATOR_ADDRESS" \
  --acquired-at "$CREATED_AT" \
  --created-at "$CREATED_AT" \
  --out "$OUT_DIR/bad-module-acquisition-receipt.json" > "$OUT_DIR/create-bad-module-acquisition-receipt.json"

BAD_ACQUISITION_RECEIPT_HASH="$(json_get "$OUT_DIR/bad-module-acquisition-receipt.json" receipt_hash)"

"$NODE_BIN" "$CLI" create-verification-run-receipt \
  --module-id "$MODULE_ID" \
  --manifest-hash "$MANIFEST_HASH" \
  --acquisition-receipt-hash "$BAD_ACQUISITION_RECEIPT_HASH" \
  --validator-address "$VALIDATOR_ADDRESS" \
  --environment-hash "$ENVIRONMENT_HASH" \
  --run-result failed \
  --log-uri "$LOG_URI" \
  --log-digest "$LOG_DIGEST" \
  --started-at "$CREATED_AT" \
  --completed-at "2026-05-25T00:05:00.000Z" \
  --created-at "2026-05-25T00:06:00.000Z" \
  --out "$OUT_DIR/bad-verification-run-receipt.json" > "$OUT_DIR/create-bad-verification-run-receipt.json"

BAD_RUN_RECEIPT_HASH="$(json_get "$OUT_DIR/bad-verification-run-receipt.json" receipt_hash)"

"$NODE_BIN" "$CLI" create-community-work-claim \
  --claim-id ec16a-demo-bad-testing-claim \
  --responsible-address "$RESPONSIBLE_ADDRESS" \
  --work-kind testing \
  --summary "Negative-path claim links a receipt whose downloaded digest did not match." \
  --proof-uri "$PROOF_URI" \
  --proof-digest "$PROOF_DIGEST" \
  --artifact-hashes "$MANIFEST_HASH" "$BAD_ACQUISITION_RECEIPT_HASH" "$BAD_RUN_RECEIPT_HASH" \
  --created-at "2026-05-25T00:08:00.000Z" \
  --out "$OUT_DIR/bad-community-work-claim.json" > "$OUT_DIR/create-bad-community-work-claim.json"

"$NODE_BIN" "$CLI" audit-bundle \
  --events "$OUT_DIR/events.jsonl" \
  --module-manifests "$OUT_DIR/module-manifest.json" \
  --module-acquisition-receipts "$OUT_DIR/bad-module-acquisition-receipt.json" \
  --verification-run-receipts "$OUT_DIR/bad-verification-run-receipt.json" \
  --community-work-claims "$OUT_DIR/bad-community-work-claim.json" \
  --network local \
  --out "$OUT_DIR/bad-audit-bundle.json" > "$OUT_DIR/bad-audit-bundle-command.json"

assert_audit_failed "$OUT_DIR/bad-audit-bundle.json" "$OUT_DIR/ec16a-negative-summary.json"

echo "EC-16A module verification protocol flow passed. Artifacts: $OUT_DIR"
