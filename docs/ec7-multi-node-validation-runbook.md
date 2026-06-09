# EC-7 Multi-Node Validation Runbook

EC-7 extends the EC-6 Anvil audit flow from one host to two independently executed validator environments. It is still a local-Anvil validation phase: no public testnet, real token, DAO, StakeVault, RewardVault, database indexer, or OriginAgent client integration is introduced.

## Roles

```text
coordinator / validator-1: root@47.84.130.213
validator-2 / auditor:    root@154.40.59.232
```

The coordinator starts Anvil, deploys contracts, broadcasts transactions, indexes events, and builds the final audit bundle. Each validator host runs the SDK and contract test suites before producing validator evidence. Validator-2 does not expose a long-running service.

## Standardize A Node

```bash
EC7_SSH_KEY=<path-to-ssh-key> \
EC7_NODE_HOST=154.40.59.232 \
EC7_NODE_ROLE=validator-2 \
EC7_NODE_NAME=oaec-validator-2 \
scripts/bootstrap-ec7-node.sh
```

The bootstrap script is idempotent. It sets the hostname, ensures 2G swap, installs base packages, installs Node 24, installs Foundry, and writes:

```text
out/ec7-multi-node-validation/<role>/server-standardization.json
out/ec7-multi-node-validation/server-standardization.<role>.json
```

The artifact records OS, resource, toolchain, and SSH public-key/root-login status only. It does not persist production keys, Anvil private keys, passwords, tokens, local paths, or URL queries.

## Run The Full Flow

```bash
EC7_SSH_KEY=<path-to-ssh-key> scripts/run-ec7-multi-node-validation.sh
```

Optional environment overrides:

```text
EC7_COORDINATOR_HOST
EC7_VALIDATOR2_HOST
EC7_REMOTE_BASE
OUT_DIR
ANVIL_PORT
```

The runner performs the following steps:

```text
1. Bootstrap coordinator and validator-2.
2. Package the current repository and upload it to both hosts.
3. Run npm install, npm test, and npm run test:contracts on both hosts.
4. Generate validator-1 and validator-2 external validator artifacts and evidence reports.
5. Start a fresh coordinator Anvil chain and deploy contracts.
6. Register both validators and set distinct validator profiles.
7. Submit both validator evidence reports to the same Anvil chain.
8. Submit and reject one challenge, leaving both evidence records active.
9. Run chain-state-check, index-events, challenge-summary, evidence-summary, and audit-bundle.
10. Assert high confidence, audit ok, and privacy scan success.
11. Pull artifacts back to out/ec7-multi-node-validation.
```

## Expected Gates

```text
npm test: 55 passed on each remote host.
npm run test:contracts: 21 passed on each remote host.
evidence-summary.ok=true.
evidence-summary.acceptedReports=2.
evidence-summary.highConfidence=true.
effectiveValidatorGroups.length=2.
effectiveRunnerFingerprints.length=2.
chain-state-check challenge status=rejected.
chain-state-check evidence status=active.
challenger testnetReputation=-2.
audit-bundle.ok=true.
audit-bundle evidence_linkage.length=2.
audit-bundle rejected challenge does not require EvidenceInvalidated.
privacy scan passes for EC-7 JSON/JSONL artifacts.
```

## Outputs

```text
out/ec7-multi-node-validation/server-standardization.coordinator.json
out/ec7-multi-node-validation/server-standardization.validator-2.json
out/ec7-multi-node-validation/validator-1/evidence-report.json
out/ec7-multi-node-validation/validator-2/evidence-report.json
out/ec7-multi-node-validation/events.jsonl
out/ec7-multi-node-validation/audit-bundle.json
out/ec7-multi-node-validation/evidence-summary.json
out/ec7-multi-node-validation/challenge-summary.json
out/ec7-multi-node-validation/chain-state-check.json
```

`out/` is generated validation output and is not committed.
