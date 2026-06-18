# EC-7 Multi-Node Validation Result

Date: 2026-05-23

## Summary

EC-7 completed a two-host Anvil validation flow. The coordinator deployed a fresh local Anvil chain, both validator environments generated independent validator evidence, both reports were submitted to the same chain, and the resulting event/audit artifacts verified successfully.

## Node Standardization

| Role | Host | OS | Memory | Swap | Node | Foundry |
|---|---|---|---:|---:|---|---|
| coordinator / validator-1 | `47.84.130.213` | CentOS Linux 8 | 431Mi | 2.0Gi | v24.11.1 | 1.7.1-dev |
| validator-2 / auditor | `154.40.59.232` | Ubuntu 24.04.1 LTS | 1.9Gi | 2.0Gi | v24.15.0 | 1.7.1 |

Notes:

```text
validator-2 was standardized with Node 24, npm, forge, anvil, cast, git, and 2G swap.
Foundry tools are linked into the non-interactive SSH PATH.
coordinator has an EOL CentOS 8 package repository; bootstrap records tool versions and continues when required tools are already present.
```

## Validation Commands

The EC-7 runner executed these gates on both remote hosts:

```text
npm install --no-audit --no-fund
npm test
npm run test:contracts
```

Observed results:

```text
remote coordinator npm test: 55 passed
remote coordinator npm run test:contracts: 21 passed
remote validator-2 npm test: 55 passed
remote validator-2 npm run test:contracts: 21 passed
remote validator-2 EC-6 single-node runner: passed
scripts/run-ec7-multi-node-validation.sh: passed
```

Validator-2 single-node reproduction was run from the EC-7 uploaded repository. It completed the upgraded EC-6 Anvil flow (`scripts/run-ec5-anvil-live-flow.sh`) and then reran `npm run test:contracts` successfully.

## Chain Readback

```text
moduleExists=true
primary evidence status=active
secondary evidence status=active
challenge status=rejected
challenger testnetReputation=-2
```

Primary challenge:

```text
challengeId=0x3e0fba4c4dc7ee996ac732a15987ea34d4b3f0a1c3c3fb4ad515be0abf410683
evidenceId=0x54713e83485ffd987e0d4dd68f7615462e3d9366264fc3cc967d50f59930e9cb
```

## Evidence Summary

```text
ok=true
acceptedReports=2
score=120
highConfidence=true
effectiveValidatorGroups.length=2
effectiveRunnerFingerprints.length=2
errors=[]
```

## Event And Audit Bundle

```text
events.total=9
EvidenceSubmitted events=2
ChallengeSubmitted present=true
ChallengeResolved present=true
EvidenceInvalidated required=false
audit-bundle.ok=true
audit-bundle.errors=[]
privacy_scan.ok=true
```

The rejected challenge intentionally leaves both validator evidence records active. This keeps the challenge/audit path exercised without invalidating either validator report, so the two independent reports still form high confidence.

## Artifacts

Generated artifacts are under:

```text
out/ec7-multi-node-validation/
```

Key files:

```text
server-standardization.coordinator.json
server-standardization.validator-2.json
validator-1/evidence-report.json
validator-2/evidence-report.json
events.jsonl
audit-bundle.json
evidence-summary.json
challenge-summary.json
chain-state-check.json
```

The EC-7 JSON/JSONL privacy scan passed and found no private key, password, Points, secret, local path, URL query, raw prompt, facts, or private telemetry fields.

## Boundaries

EC-7 did not add a public testnet, real Points, CreditPool, ContributionPool, DAO, PVE matrix, database indexer, or OriginAgent client dependency. Anvil remains local and disposable; generated live deployment files stay under `out/`.
