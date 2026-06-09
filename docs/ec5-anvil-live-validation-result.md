# EC-5 Anvil Live Validation Result

Date: 2026-05-23

Local validation:

```text
npm test: 43 passed
npx --yes solc --bin ...: passed
npm run test:contracts: not run locally; forge is not installed on this machine
bash scripts/run-ec5-anvil-live-flow.sh: not run locally; local Foundry/Git Bash runtime is unavailable
```

Remote validation:

```text
Target: 47.84.130.213
OS: Linux 4.18.0-240.10.1.el8_3.x86_64
Memory: 431 MiB
Swap: 2.0 GiB
Node: v24.11.1
npm: 11.6.2
Foundry: v1.7.1-dev alpine/musl build
Remote npm test: 43 passed
Remote npm run test:contracts: 21 passed
Remote EC-5 runner: passed
Remote output: /root/originagent-ec5-live/OriginAgentEvolutionChain/out/ec5-anvil-live-flow
```

Remote chain readback:

```text
chainId: 31337
moduleExists: true
evidenceStatus: invalidated
evidenceType: validator_report
challengeStatus: upheld
reporter identity: validator
reporter testnetReputation: -10
challenger testnetReputation: +5
```

Computed IDs used by the live flow:

```text
evidenceId: 0x54713e83485ffd987e0d4dd68f7615462e3d9366264fc3cc967d50f59930e9cb
challengeId: 0x9716d7844f288fc4dcd13faee3ebc2503dd7cbf4b0b1ca2f05821de9c9e1c5d4
```

Operational notes:

```text
Default remote Node was changed from /usr/local/bin/node v14.15.2 to Node v24.11.1.
Foundry linux_amd64 binaries require newer GLIBC than CentOS 8 provides.
The remote server uses Foundry alpine/musl binaries instead.
Live deployment addresses were generated under out/ec5-anvil-live-flow/deployments/local.json and are not committed.
```

Boundary:

EC-5 proves the local Anvil transaction path for identity, module, evidence, challenge, resolution, and chain readback. It does not create token rewards, slashable stake, public testnet deployment, DAO governance, or mainnet reputation.
