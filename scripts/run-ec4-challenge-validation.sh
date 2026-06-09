#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec4-challenge-validation}"
NODE_BIN="${NODE_BIN:-node}"
CLI="$ROOT/sdk/src/cli.ts"

MODULE_DIGEST="${MODULE_DIGEST:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
PROOF_BUNDLE_HASH="${PROOF_BUNDLE_HASH:-cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e}"
VALIDATOR="${VALIDATOR:-0x6666666666666666666666666666666666666666}"
CHALLENGER="${CHALLENGER:-0x8888888888888888888888888888888888888888}"
OPERATOR_GROUP_HASH="${OPERATOR_GROUP_HASH:-1111111111111111111111111111111111111111111111111111111111111111}"
RUNNER_FINGERPRINT_HASH="${RUNNER_FINGERPRINT_HASH:-2222222222222222222222222222222222222222222222222222222222222222}"
TOOL_TESTS_HASH="${TOOL_TESTS_HASH:-2b517d681fb728bf05da53e4a79f53005968476affe5cb239cdedaf4a46a53bc}"
RESULT_DIGEST="${RESULT_DIGEST:-cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e}"
CREATED_AT="${CREATED_AT:-2026-05-23T00:00:00Z}"
RESOLVED_AT="${RESOLVED_AT:-2026-05-23T00:10:00Z}"
CHALLENGE_WINDOW_END="${CHALLENGE_WINDOW_END:-1893456000}"
REASON_HASH="${REASON_HASH:-9999999999999999999999999999999999999999999999999999999999999999}"
RESOLUTION_HASH="${RESOLUTION_HASH:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"

mkdir -p "$OUT_DIR"

cd "$ROOT"
npm test

"$NODE_BIN" "$CLI" verify-proof fixtures/proof_bundle.tool.valid.json > "$OUT_DIR/verify-proof.json"
"$NODE_BIN" "$CLI" submit-tool-module \
  --proof-bundle fixtures/proof_bundle.tool.valid.json \
  --storage-uri "oci://registry.example/originagent/demo-tool@sha256:$MODULE_DIGEST" \
  --network local \
  --dry-run > "$OUT_DIR/submit-tool-module.json"

"$NODE_BIN" "$CLI" create-external-validator-artifact \
  --module-digest "$MODULE_DIGEST" \
  --validator "$VALIDATOR" \
  --operator-group-hash "$OPERATOR_GROUP_HASH" \
  --runner-fingerprint-hash "$RUNNER_FINGERPRINT_HASH" \
  --tool-tests-hash "$TOOL_TESTS_HASH" \
  --result-digest "$RESULT_DIGEST" \
  --created-at "$CREATED_AT" \
  --out "$OUT_DIR/external-validator-artifact.json" > /dev/null

"$NODE_BIN" "$CLI" validate-external-validator-artifact "$OUT_DIR/external-validator-artifact.json" \
  > "$OUT_DIR/validate-artifact.json"

"$NODE_BIN" "$CLI" create-evidence-report \
  --module-digest "$MODULE_DIGEST" \
  --proof-bundle-hash "$PROOF_BUNDLE_HASH" \
  --evidence-type validator_report \
  --reporter "$VALIDATOR" \
  --operator-group-hash "$OPERATOR_GROUP_HASH" \
  --runner-fingerprint-hash "$RUNNER_FINGERPRINT_HASH" \
  --challenge-window-end "$CHALLENGE_WINDOW_END" \
  --external-validator-artifact "$OUT_DIR/external-validator-artifact.json" \
  --out "$OUT_DIR/evidence-report.json" > "$OUT_DIR/create-evidence-report.json"

"$NODE_BIN" "$CLI" submit-validator-report \
  --report "$OUT_DIR/evidence-report.json" \
  --network local \
  --dry-run > "$OUT_DIR/submit-validator-report.json"

EVIDENCE_ID="$("$NODE_BIN" --input-type=module -e "import { computeEvidenceId, readEvidenceReport } from './sdk/src/evidence.ts'; console.log(computeEvidenceId(readEvidenceReport(process.argv[1])));" "$OUT_DIR/evidence-report.json")"

"$NODE_BIN" "$CLI" create-challenge-record \
  --evidence-id "$EVIDENCE_ID" \
  --module-digest "$MODULE_DIGEST" \
  --reason-hash "$REASON_HASH" \
  --challenger "$CHALLENGER" \
  --reporter "$VALIDATOR" \
  --created-at "$CREATED_AT" \
  --status upheld \
  --resolution-hash "$RESOLUTION_HASH" \
  --resolved-at "$RESOLVED_AT" \
  --out "$OUT_DIR/challenge-record.json" > "$OUT_DIR/create-challenge-record.json"

CHALLENGE_ID="$("$NODE_BIN" --input-type=module -e "import { readChallengeRecord } from './sdk/src/evidence.ts'; console.log(readChallengeRecord(process.argv[1]).challenge_id);" "$OUT_DIR/challenge-record.json")"

"$NODE_BIN" "$CLI" submit-challenge \
  --evidence-id "$EVIDENCE_ID" \
  --reason-hash "$REASON_HASH" \
  --network local \
  --dry-run > "$OUT_DIR/submit-challenge.json"

"$NODE_BIN" "$CLI" resolve-challenge \
  --challenge-id "$CHALLENGE_ID" \
  --upheld true \
  --resolution-hash "$RESOLUTION_HASH" \
  --network local \
  --dry-run > "$OUT_DIR/resolve-challenge.json"

"$NODE_BIN" "$CLI" challenge-summary \
  --challenges "$OUT_DIR/challenge-record.json" \
  > "$OUT_DIR/challenge-summary.json"

"$NODE_BIN" "$CLI" evidence-summary \
  --reports "$OUT_DIR/evidence-report.json" fixtures/evidence_report.validator.second.valid.json \
  --challenge-summary "$OUT_DIR/challenge-summary.json" \
  > "$OUT_DIR/evidence-summary.json"

if grep -R -E 'raw_prompt|prompt|facts|private_telemetry|[A-Za-z]:\\|/home/|/Users/|https?://[^ ?]+\?' "$OUT_DIR"; then
  echo "privacy scan failed for EC-4 validation outputs" >&2
  exit 1
fi

echo "$OUT_DIR"
