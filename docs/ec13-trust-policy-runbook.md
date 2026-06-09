# EC-13 Trust Policy Runbook

Date: 2026-05-23

## Purpose

EC-13 translates EC-12 abuse signals into machine-readable gate recommendations before Test Credit, marketplace incentives, token rewards, staking, slashing, or DAO governance.

It does not add contracts, write chain state, change Passport reputation, or automatically punish participants.

## Trust Policy Report

Schema:

```text
originagent.evolution.trust_policy_report.v1
```

Policy version:

```text
ec13.0.0
```

Risk levels:

```text
critical
high
medium
low
```

Subject types:

```text
passport
address
validator
unit_kind
module_submitter
artifact_set
```

Gate outputs:

```text
test_credit: eligible | manual_review | blocked | not_applicable
module_recommendation: eligible | manual_review | blocked | not_applicable
unit_kind_canonicalization: eligible | manual_review | blocked | not_applicable
validator_weight: normal | capped | zeroed | not_applicable
artifact_handling: accepted | manual_review | quarantined | not_applicable
```

## Policy Rules

EC-12 severities map to EC-13 risk as:

```text
critical -> critical
high -> high
medium -> medium
info -> low
```

For the same subject, EC-13 keeps the highest risk. Three or more medium signals for one subject upgrade that subject to high risk.

Default actions:

```text
critical: block relevant gates, zero validator weight where applicable, quarantine artifact sets
high: block relevant admission gates, cap validator weight
medium: manual review
low: record only
```

The output is advisory. EC-14 may consume these gates, but EC-13 itself does not enforce them.

## CLI

Evaluate policy:

```bash
node sdk/src/cli.ts evaluate-trust-policy \
  --abuse-report out/ec12-adversarial-simulation/abuse-report.json \
  --out out/ec13-trust-policy-flow/trust-policy-report.json
```

Validate policy:

```bash
node sdk/src/cli.ts validate-trust-policy-report \
  out/ec13-trust-policy-flow/trust-policy-report.json \
  --source-abuse-report out/ec12-adversarial-simulation/abuse-report.json
```

Attach summary to audit bundle:

```bash
node sdk/src/cli.ts audit-bundle \
  --events out/ec12-adversarial-simulation/events.jsonl \
  --abuse-report out/ec12-adversarial-simulation/abuse-report.json \
  --trust-policy-report out/ec13-trust-policy-flow/trust-policy-report.json \
  --deployments-dir out/ec12-adversarial-simulation/deployments \
  --out out/ec13-trust-policy-flow/audit-bundle.json
```

The audit bundle stores only `trust_policy_summary`; the full trust policy report remains a separate archived artifact.

## Runner

Run EC-12 first:

```bash
bash scripts/run-ec12-adversarial-simulation-flow.sh
```

Then run EC-13:

```bash
bash scripts/run-ec13-trust-policy-flow.sh
```

The EC-13 runner checks for:

```text
out/ec12-adversarial-simulation/abuse-report.json
out/ec12-adversarial-simulation/events.jsonl
```

If either file is missing, it exits with a clear message telling the operator to run EC-12 first.

Expected EC-13 outputs:

```text
out/ec13-trust-policy-flow/trust-policy-report.json
out/ec13-trust-policy-flow/trust-policy-validation.json
out/ec13-trust-policy-flow/audit-bundle.json
out/ec13-trust-policy-flow/trust-policy-summary.json
```

## Boundaries

EC-13 is a policy interpretation layer. It does not create economic consequences. Test Credit, marketplace ranking, token rewards, staking, slashing, reputation-weighted voting, and DAO governance remain later phases.
