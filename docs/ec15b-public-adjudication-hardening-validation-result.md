# EC-15B Public Adjudication Hardening Validation Result

Date: 2026-05-24

## Scope

Validated EC-15B Phase 5:

```text
CLI creation of adjudication_report.v2
EC-15B end-to-end runner
chain-state-check v2 adjudication output
audit-bundle v2 adjudication linkage
local SDK tests
remote SDK and Foundry tests
```

## Local Validation

Host:

```text
D:\Demo\OpenHome\OriginAgentEvolutionChain
Node v24.14.0
npm 11.9.0
```

Commands:

```bash
npm test
git diff --check
```

Results:

```text
npm test: 112 passed, 0 failed
git diff --check: passed
```

Local workstation notes:

```text
forge: unavailable
bash: unavailable through WSL
```

Solidity and runner validation were therefore executed on the remote Linux validation host.

## Remote Validation

Host:

```text
154.40.59.232
Linux oaec-validator-2 6.8.0-48-generic x86_64
Node v24.15.0
npm 11.12.1
Foundry forge/anvil/cast 1.7.1
```

Remote checkout:

```text
/tmp/oaec-ec15b-phase5-202605242010/OriginAgentEvolutionChain
```

Commands:

```bash
npm install
npm test
npm run test:contracts
bash scripts/run-ec15b-public-adjudication-hardening-flow.sh
```

Results:

```text
npm install: added 13 packages, 0 vulnerabilities
npm test: 112 passed, 0 failed
npm run test:contracts: 62 passed, 0 failed
EC-15B runner: passed
```

Foundry emitted one non-blocking warning:

```text
Function state mutability can be restricted to view
test/EvolutionChain.t.sol:940
```

## Runner Output

Runner output directory:

```text
/tmp/oaec-ec15b-phase5-202605242010/OriginAgentEvolutionChain/out/ec15b-public-adjudication-hardening-flow
```

Key files:

```text
events.jsonl
audit-bundle.json
upheld-chain-state-check.json
rejected-chain-state-check.json
expired-chain-state-check.json
ec15b-summary.json
```

Runner summary:

```text
ok=true
audit_ok=true
adjudication_linkage_count=3
```

Upheld path:

```text
phaseName=finalized
outcomeName=upheld
responseCount=1
commitmentCount=3
revealCount=3
quorum=3
effectiveVerdictCount=3
upheldVerdictCount=3
rejectedVerdictCount=0
evidence status=invalidated
```

Rejected path:

```text
phaseName=finalized
outcomeName=rejected
responseCount=1
commitmentCount=3
revealCount=3
quorum=3
effectiveVerdictCount=3
upheldVerdictCount=0
rejectedVerdictCount=3
evidence status=active
```

Expired no-quorum path:

```text
phaseName=expired_no_quorum
responseCount=0
commitmentCount=1
revealCount=0
quorum=3
effectiveVerdictCount=0
finalized=false
expired=true
VerificationRegistry challenge status remains submitted
```

## Issue Found And Fixed

The first remote runner attempt failed because `CHALLENGER_PRIVATE_KEY` did not match `CHALLENGER_ADDRESS`, so `submit-challenge` was sent from an unfunded address and the following response could not find the challenge.

Fix:

```text
runner now uses the funded VALIDATOR_2 account as challenger
```

The corrected runner passed on the remote host.

## Acceptance

EC-15B Phase 5 acceptance is met:

```text
Mempool copying cannot count without a prior commit.
Challenge lifecycle reaches finalized upheld, finalized rejected, or expired no quorum.
No-quorum expiration does not resolve VerificationRegistry challenges.
Operator/runner hashes do not affect quorum.
chain-state-check exposes v2 adjudication state.
audit-bundle validates v2 commit/reveal/finalize/expire linkage.
Challenge bond remains off-chain Test Credit artifact only.
No real token, staking, slash, DAO, marketplace settlement, node mining reward, or airdrop-like point system was introduced.
```
