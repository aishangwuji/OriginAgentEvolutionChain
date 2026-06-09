# EC-14 Test Credit Sandbox Validation Result

Date: 2026-05-23

## Scope

EC-14 adds a non-transferable `TestCreditLedger` and SDK artifacts for Test Credit grant, consume, and deny decisions.

It does not add ERC20 behavior, marketplace settlement, real token value, staking, slashing, reward vaults, stake vaults, or DAO governance.

## Local Validation

```text
npm test
```

Result:

```text
98 passed
```

Covered checks:

```text
test credit action/report hash stability
tampered passport, owner, amount, gate, trust policy hash, action hash, report hash rejection
eligible/no-decision grant and consume
blocked/manual trust gate deny behavior
deny action audit linkage without chain event
grant/consume event linkage against TestCreditLedger events
missing optional TestCreditLedger deployment error
audit-bundle compatibility without EC-14 inputs
privacy scan rejection
```

## Contract Validation

Expected contract checks:

```text
owner can grant and consume existing Passport
non-owner grant/consume rejected
unknown Passport rejected
zero amount/hash rejected
over-consume rejected
grant/consume share actionHash dedup pool
no transfer/approve/allowance interface
```

Local Windows validation:

```text
npm run test:contracts not run locally: Foundry is not installed in the local Windows shell.
```

Remote validation target:

```text
154.40.59.232
```

Result:

```text
npm test: 98 passed
npm run test:contracts: 45 passed
EC-12 runner: passed
EC-13 runner: passed
EC-14 runner: passed
```

## Runner Validation

Expected sequence:

```bash
bash scripts/run-ec12-adversarial-simulation-flow.sh
bash scripts/run-ec13-trust-policy-flow.sh
bash scripts/run-ec14-test-credit-sandbox-flow.sh
```

Expected EC-14 signal:

```text
test-credit-summary.ok=true
audit-bundle.ok=true
clean_balance=95
clean_granted=100
clean_consumed=5
test_credit_linkage includes matched grant and consume events
test_credit_linkage includes risky deny with event_found=null
```

Remote EC-14 summary:

```text
ok=true
audit_ok=true
clean_balance=95
clean_granted=100
clean_consumed=5
test_credit_linkage_count=3
clean_report_hash=6a35a6807ac18899d4d48c6aef79f0562d6907236067ee6af7deae38215d6a85
risky_report_hash=6bee33bf83693d33d2ac96aaeb40a005c849ee5c46742a3dc7c61c1edf26887a
```

## Boundary Confirmation

`TestCreditLedger` does not enforce trust policy on-chain. EC-13 gates are enforced by SDK/runner workflow before broadcast. The contract remains a minimal owner-only accounting ledger.
