# EC-12 Adversarial Simulation Runbook

Date: 2026-05-23

## Purpose

EC-12 adds a controlled abuse lab before Test Credit, marketplace settlement, token rewards, or slashing.

The flow uses one local Anvil chain with multiple wallets, Passport records, validator reports, unit kind proposals, and intentionally bad artifacts. It simulates protocol abuse patterns without attacking public networks or third-party systems.

EC-12 does not add contracts. It analyzes existing EC-5 to EC-11 artifacts and events.

## Abuse Report

Schema:

```text
originagent.evolution.abuse_report.v1
```

Signals use fixed severity values:

```text
critical
high
medium
info
```

Categories:

```text
passport_sybil
reputation_farming
validator_collusion
unit_kind_typosquatting
module_spam
artifact_tampering
privacy_leakage
```

Default thresholds:

```text
same owner passports >= 3: medium
same owner passports >= 5: high
same submitter modules inside 100 blocks >= 5: high
unit kind Levenshtein distance to canonical kind <= 2: high
same operator group or runner fingerprint reused by >= 3 validator addresses: high
```

The abuse report is audit input only. It does not write chain state, slash, reward, or mutate Passport reputation.

## CLI

Analyze artifacts:

```bash
node sdk/src/cli.ts analyze-adversarial-simulation \
  --events out/ec12-adversarial-simulation/events.jsonl \
  --evidence-reports out/ec12-adversarial-simulation/evidence-report-self.json \
  --agent-passports out/ec12-adversarial-simulation/agent-passport-1.json \
  --unit-kind-proposals out/ec12-adversarial-simulation/unit-kind-proposal-tool.json \
  --unit-kind-reviews out/ec12-adversarial-simulation/unit-kind-review-tool.json \
  --out out/ec12-adversarial-simulation/abuse-report.json
```

Validate report:

```bash
node sdk/src/cli.ts validate-abuse-report out/ec12-adversarial-simulation/abuse-report.json
```

Attach to audit bundle:

```bash
node sdk/src/cli.ts audit-bundle \
  --events out/ec12-adversarial-simulation/events.jsonl \
  --agent-passports out/ec12-adversarial-simulation/agent-passport-1.json \
  --unit-kind-proposals out/ec12-adversarial-simulation/unit-kind-proposal-tool.json \
  --unit-kind-reviews out/ec12-adversarial-simulation/unit-kind-review-tool.json \
  --abuse-report out/ec12-adversarial-simulation/abuse-report.json \
  --out out/ec12-adversarial-simulation/audit-bundle.json
```

## Runner

```bash
bash scripts/run-ec12-adversarial-simulation-flow.sh
```

The runner:

```text
deploys the EC-11 seven-contract set
registers multiple Passports for one owner
submits multiple modules from one submitter
creates canonical tool@1 and typo-like to0l proposals
submits a self-challenge evidence path
creates colluding validator reports sharing operator and runner hashes
creates dirty and tampered artifacts under out/ec12-adversarial-simulation/dirty/
indexes events
generates abuse-report.json
generates normal, tampered, and privacy audit artifacts
```

Expected outputs:

```text
out/ec12-adversarial-simulation/events.jsonl
out/ec12-adversarial-simulation/audit-bundle.json
out/ec12-adversarial-simulation/audit-bundle-tampered.json
out/ec12-adversarial-simulation/abuse-report.json
out/ec12-adversarial-simulation/privacy-scan.json
out/ec12-adversarial-simulation/attack-scenarios.json
```

Expected signals:

```text
audit-bundle.ok=true for the normal audit path
audit-bundle-tampered.ok=false for tampered artifacts
privacy-scan.privacy_scan.ok=false for dirty artifacts
abuse-report.high_or_critical_count > 0
passport_sybil, reputation_farming, validator_collusion, unit_kind_typosquatting are present
```

## Boundaries

EC-12 does not scan public networks, attack third-party systems, run malware, add token economics, add staking, add DAO governance, or make abuse signals automatically punitive.

The v1 lab uses one Anvil chain plus many wallets. Extra physical hardware or multiple Ubuntu VMs are not required until long-running multi-node soak tests become necessary.
