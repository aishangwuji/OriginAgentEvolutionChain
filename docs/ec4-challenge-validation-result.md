# EC-4 Challenge Validation Result

Date: 2026-05-23

Local validation:

```text
npm test: 40 passed
bash scripts/run-ec4-challenge-validation.sh: passed
npx --yes solc --bin ...: passed
forge test: not run locally; forge is not installed on this machine
```

EC-4 runner command:

```text
bash scripts/run-ec4-challenge-validation.sh
```

Observed local runner result:

```text
verify-proof: ok=true
submit-tool-module: dryRun=true, method=submitModule
submit-validator-report: dryRun=true, method=submitEvidence
submit-challenge: dryRun=true, method=submitChallenge
resolve-challenge: dryRun=true, method=resolveChallenge
challenge-summary: generated invalidated evidence and testnet reputation deltas
evidence-summary --challenge-summary: generated challenge-adjusted evidence summary
privacy scan: passed
```

Remote validation status:

```text
Target: 47.84.130.213
OS: Linux 4.18.0-240.10.1.el8_3.x86_64
Memory: 431 MiB
Swap: 2.0 GiB
Node: v24.11.1
npm: 11.6.2
Remote EC-4 runner: passed
Remote output: /root/originagent-ec4-20260523102340/OriginAgentEvolutionChain/out/ec4-challenge-validation
```

Remote commands executed:

```text
npm install --no-audit --no-fund
bash scripts/run-ec4-challenge-validation.sh
```

Boundary:

EC-4 challenge state and reputation are testnet-only. Remote validation proves the runner path works on an independent lightweight host; it does not create token rewards, slashable stake, or mainnet reputation.
