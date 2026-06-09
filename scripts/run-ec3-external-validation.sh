#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec3-external-validation}"
NODE_BIN="${NODE_BIN:-node}"
CLI="$ROOT/sdk/src/cli.ts"

MODULE_DIGEST="${MODULE_DIGEST:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"
PROOF_BUNDLE_HASH="${PROOF_BUNDLE_HASH:-cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e}"
VALIDATOR="${VALIDATOR:-0x6666666666666666666666666666666666666666}"
OPERATOR_GROUP_HASH="${OPERATOR_GROUP_HASH:-1111111111111111111111111111111111111111111111111111111111111111}"
RUNNER_FINGERPRINT_HASH="${RUNNER_FINGERPRINT_HASH:-2222222222222222222222222222222222222222222222222222222222222222}"
TOOL_TESTS_HASH="${TOOL_TESTS_HASH:-2b517d681fb728bf05da53e4a79f53005968476affe5cb239cdedaf4a46a53bc}"
RESULT_DIGEST="${RESULT_DIGEST:-cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e}"
CREATED_AT="${CREATED_AT:-2026-05-22T09:18:00Z}"
CHALLENGE_WINDOW_END="${CHALLENGE_WINDOW_END:-1893456000}"

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
  --out "$OUT_DIR/external-validator-artifact.json" > "$OUT_DIR/create-artifact.json"

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

"$NODE_BIN" "$CLI" evidence-summary \
  --reports "$OUT_DIR/evidence-report.json" fixtures/evidence_report.validator.second.valid.json \
  > "$OUT_DIR/evidence-summary.json"

echo "$OUT_DIR"
