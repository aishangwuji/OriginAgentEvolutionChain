#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EC12_DIR="${EC12_DIR:-$ROOT/out/ec12-adversarial-simulation}"
OUT_DIR="${OUT_DIR:-$ROOT/out/ec13-trust-policy-flow}"
NODE_BIN="${NODE_BIN:-node}"
CLI="$ROOT/sdk/src/cli.ts"

ABUSE_REPORT="$EC12_DIR/abuse-report.json"
EVENTS="$EC12_DIR/events.jsonl"
DEPLOYMENTS_DIR="$EC12_DIR/deployments"
TRUST_REPORT="$OUT_DIR/trust-policy-report.json"
AUDIT_BUNDLE="$OUT_DIR/audit-bundle.json"
VALIDATION_RESULT="$OUT_DIR/trust-policy-validation.json"
SUMMARY="$OUT_DIR/trust-policy-summary.json"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "ERROR: missing required file: $1" >&2
    echo "Run scripts/run-ec12-adversarial-simulation-flow.sh first." >&2
    exit 1
  fi
}

require_command "$NODE_BIN"
require_file "$ABUSE_REPORT"
require_file "$EVENTS"

mkdir -p "$OUT_DIR"

"$NODE_BIN" "$CLI" validate-abuse-report "$ABUSE_REPORT" > "$OUT_DIR/abuse-report-validation.json"
"$NODE_BIN" "$CLI" evaluate-trust-policy \
  --abuse-report "$ABUSE_REPORT" \
  --out "$TRUST_REPORT" > "$OUT_DIR/evaluate-trust-policy.json"
"$NODE_BIN" "$CLI" validate-trust-policy-report "$TRUST_REPORT" \
  --source-abuse-report "$ABUSE_REPORT" > "$VALIDATION_RESULT"

"$NODE_BIN" "$CLI" audit-bundle \
  --events "$EVENTS" \
  --abuse-report "$ABUSE_REPORT" \
  --trust-policy-report "$TRUST_REPORT" \
  --network local \
  --deployments-dir "$DEPLOYMENTS_DIR" \
  --out "$AUDIT_BUNDLE" > "$OUT_DIR/audit-bundle-command.json"

"$NODE_BIN" --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const trust = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const audit = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const validation = JSON.parse(readFileSync(process.argv[3], 'utf8'));
if (!validation.ok) throw new Error('trust policy validation failed');
if (!audit.ok) throw new Error('audit bundle failed: ' + audit.errors.join('; '));
if (!audit.trust_policy_summary) throw new Error('missing trust_policy_summary');
if (audit.trust_policy_summary.report_hash !== trust.report_hash) throw new Error('trust policy summary hash mismatch');
if (!['high', 'critical'].includes(trust.summary.max_risk)) throw new Error('expected high or critical max risk');
const decisions = trust.decisions ?? [];
const hasBlockedOrManual = decisions.some((decision) =>
  Object.values(decision.gates ?? {}).includes('blocked') ||
  Object.values(decision.gates ?? {}).includes('manual_review') ||
  decision.gates?.validator_weight === 'capped' ||
  decision.gates?.artifact_handling === 'quarantined'
);
if (!hasBlockedOrManual) throw new Error('expected at least one gate decision');
const toolDecision = decisions.find((decision) => decision.subject_type === 'unit_kind' && decision.subject_id === 'tool');
if (toolDecision && ['high', 'critical'].includes(toolDecision.risk)) {
  throw new Error('normal tool@1 canonical flow was flagged as high or critical');
}
const summary = {
  ok: true,
  audit_ok: audit.ok,
  max_risk: trust.summary.max_risk,
  total_subjects: trust.summary.total_subjects,
  blocked_count: trust.summary.blocked_count,
  manual_review_count: trust.summary.manual_review_count,
  quarantined_count: trust.summary.quarantined_count,
  trust_policy_report_hash: trust.report_hash,
  audit_trust_policy_report_hash: audit.trust_policy_summary.report_hash
};
writeFileSync(process.argv[4], JSON.stringify(summary, null, 2) + '\n');
" "$TRUST_REPORT" "$AUDIT_BUNDLE" "$VALIDATION_RESULT" "$SUMMARY"

echo "EC-13 trust policy flow passed. Artifacts: $OUT_DIR"
