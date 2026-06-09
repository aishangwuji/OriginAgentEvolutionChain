# EC-13 Trust Policy Validation Result

Date: 2026-05-23

## Scope

EC-13 adds a chain-side SDK policy layer that translates EC-12 abuse signals into trust gate recommendations.

It does not add contracts, write chain state, change address-level `testnetReputation`, change Passport reputation checkpoints, or create token/slashing behavior.

## Local Validation

```text
npm test
```

Result:

```text
90 passed
```

Covered checks:

```text
trust policy report hash stability
tampered report hash rejection
source abuse report hash cross-check
category-to-gate mapping
highest-risk aggregation
3+ medium signal escalation to high
medium manual review behavior
critical artifact quarantine behavior
non-empty review reasons
audit-bundle trust_policy_summary attachment
legacy audit-bundle compatibility without EC-13 inputs
privacy scan rejection
```

## Runner Validation

Expected sequence:

```bash
bash scripts/run-ec12-adversarial-simulation-flow.sh
bash scripts/run-ec13-trust-policy-flow.sh
```

Expected EC-13 signal:

```text
trust-policy-report.summary.max_risk is high or critical
trust-policy-summary.json ok=true
audit-bundle.ok=true
audit-bundle.trust_policy_summary.report_hash equals trust-policy-report.report_hash
normal tool@1 canonical flow is not flagged as high or critical
```

## Remote Validation

Remote validation target:

```text
154.40.59.232
```

Required remote commands:

```bash
npm test
npm run test:contracts
bash scripts/run-ec12-adversarial-simulation-flow.sh
bash scripts/run-ec13-trust-policy-flow.sh
```

Result:

```text
npm test: 90 passed
npm run test:contracts: 38 passed
EC-12 runner: passed
EC-13 runner: passed
```

Remote EC-13 summary:

```text
ok=true
audit_ok=true
max_risk=critical
total_subjects=18
blocked_count=10
manual_review_count=6
quarantined_count=3
trust_policy_report_hash=46c965a9952259f1f785a3e3c8bc147d97e785db5db37f01f916b3360f928aca
audit_trust_policy_report_hash=46c965a9952259f1f785a3e3c8bc147d97e785db5db37f01f916b3360f928aca
```

## Boundary Confirmation

EC-13 outputs advisory gates only. It is safe to use as an EC-14 input, but EC-13 itself does not enforce Test Credit eligibility, module listing, validator weighting, or artifact quarantine on-chain.
