# EC-14 Contribution Points Sandbox Runbook

Date: 2026-05-23

## Purpose

EC-14 adds a non-transferable Contribution Points sandbox ledger before marketplace settlement, real Points, staking, Credit Deduction, or DAO governance.

Contribution Points is bound to `passportId`. It is not ERC20 and has no transfer, approve, allowance, withdraw, or secondary-market behavior.

## Contract

`ContributionPointsLedger` stores:

```text
granted
consumed
balance
operationCount
exists
```

Owner-only methods:

```text
grantCredit(passportId, amount, actionHash, trustPolicyReportHash)
consumeCredit(passportId, amount, actionHash, trustPolicyReportHash)
```

Both methods require:

```text
existing Agent Passport
amount > 0
non-zero actionHash
non-zero trustPolicyReportHash
unused actionHash
consume amount <= balance
```

`grantCredit` and `consumeCredit` share the same `usedActionHashes` pool. Every grant and consume action needs a unique action hash.

## Security Boundary

The contract does not enforce EC-13 trust gates. It only enforces owner-only writes and ledger integrity.

The foundation owner is trusted to follow EC-13 trust policy recommendations. The SDK and runner enforce trust gates before broadcast, but a direct owner transaction remains contract-authoritative.

## Contribution Points Artifacts

Action schema:

```text
originagent.evolution.test_credit_action.v1
```

Report schema:

```text
originagent.evolution.test_credit_report.v1
```

Fixed amounts:

```text
passport_bootstrap = 100
validator_report_grant = 25
module_submission_grant = 10
audit_request_fee = 5
challenge_bond = 10
blocked_by_trust_policy = 0
```

Allowed action semantics:

```text
grant: passport_bootstrap, validator_report_grant, module_submission_grant
consume: audit_request_fee, challenge_bond
deny: blocked_by_trust_policy
```

Grant and consume require `gate=eligible`. `manual_review` and `blocked` subjects produce a `deny` action and no on-chain transaction.

## CLI

Create an action:

```bash
node sdk/src/cli.ts create-test-credit-action \
  --passport-id <passport_id> \
  --owner <owner> \
  --action grant \
  --reason passport_bootstrap \
  --trust-policy-report out/ec13-trust-policy-flow/trust-policy-report.json \
  --created-at 2026-05-23T00:00:00.000Z \
  --out out/ec14-test-credit-sandbox-flow/test-credit-action-clean-grant.json
```

Create a report:

```bash
node sdk/src/cli.ts create-test-credit-report \
  --passport-id <passport_id> \
  --owner <owner> \
  --actions out/ec14-test-credit-sandbox-flow/test-credit-action-clean-grant.json \
  --out out/ec14-test-credit-sandbox-flow/test-credit-report-clean.json
```

Validate with EC-13 policy:

```bash
node sdk/src/cli.ts validate-test-credit-report \
  out/ec14-test-credit-sandbox-flow/test-credit-report-clean.json \
  --trust-policy-report out/ec13-trust-policy-flow/trust-policy-report.json
```

Dry-run or broadcast:

```bash
node sdk/src/cli.ts grant-test-credit \
  --action out/ec14-test-credit-sandbox-flow/test-credit-action-clean-grant.json \
  --network local

node sdk/src/cli.ts consume-test-credit \
  --action out/ec14-test-credit-sandbox-flow/test-credit-action-clean-consume.json \
  --network local
```

Without `--broadcast`, both commands remain dry-run.

Attach to audit bundle:

```bash
node sdk/src/cli.ts audit-bundle \
  --events out/ec14-test-credit-sandbox-flow/events.jsonl \
  --trust-policy-report out/ec13-trust-policy-flow/trust-policy-report.json \
  --test-credit-reports out/ec14-test-credit-sandbox-flow/test-credit-report-clean.json \
  --out out/ec14-test-credit-sandbox-flow/audit-bundle.json
```

`deny` actions intentionally have no chain event. `test_credit_linkage` marks them with `denied=true` and `event_found=null`.

## Runner

EC-14 consumes EC-12 and EC-13 outputs:

```text
out/ec12-adversarial-simulation/abuse-report.json
out/ec13-trust-policy-flow/trust-policy-report.json
```

Run upstream first:

```bash
bash scripts/run-ec12-adversarial-simulation-flow.sh
bash scripts/run-ec13-trust-policy-flow.sh
```

Then run:

```bash
bash scripts/run-ec14-test-credit-sandbox-flow.sh
```

Expected outputs:

```text
out/ec14-test-credit-sandbox-flow/events.jsonl
out/ec14-test-credit-sandbox-flow/audit-bundle.json
out/ec14-test-credit-sandbox-flow/test-credit-report-clean.json
out/ec14-test-credit-sandbox-flow/test-credit-report-risky.json
out/ec14-test-credit-sandbox-flow/chain-state-check-clean-passport.json
out/ec14-test-credit-sandbox-flow/test-credit-summary.json
```

Expected signal:

```text
clean Passport: grant 100, consume 5, balance 95
risky Passport: deny action only, no grant event
audit-bundle.ok=true
test_credit_linkage grant/consume events matched
chain-state-check.passport.test_credit.available=true
```

## Version Note

EC-12 and EC-13 did not add contracts. The deployment `contractVersion` therefore moves from `ec11.0.0` to `ec14.0.0` when `ContributionPointsLedger` is added.

## Boundaries

EC-14 does not add marketplace settlement, real Points value, staking, Credit Deduction, reward vaults, Commitment vaults, DAO voting, or reputation-weighted governance.
