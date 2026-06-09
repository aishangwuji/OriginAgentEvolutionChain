# EC-5 Anvil Live Chain Runbook

EC-5 turns the EC-4 dry-run and offline audit flow into a local Anvil transaction loop. It does not add public testnet deployment, token rewards, slashable stake, DAO voting, or mainnet reputation.

Prerequisites:

```text
Node.js >= 24
npm
Foundry forge/anvil/cast
```

Run the local live validation script:

```bash
bash scripts/run-ec5-anvil-live-flow.sh
```

The script performs:

```text
npm test
start fresh Anvil on 127.0.0.1:8545
deploy contracts with forge script
write out/ec5-anvil-live-flow/deployments/local.json
register validator identity
submit tool module
set validator profile
create external validator artifact
create evidence report
submit validator report
compute evidenceId locally
create challenge record
submit challenge
compute challengeId locally
resolve challenge as upheld
read chain state with chain-state-check
index chain events into events.jsonl
challenge-summary
evidence-summary --challenge-summary
audit-bundle cross-checking events, evidence report, and challenge record
privacy scan for JSON outputs
```

Deployment files:

```text
deployments/local.json
  Tracked dry-run fixture. Do not overwrite it during live Anvil runs.

out/ec5-anvil-live-flow/deployments/local.json
  Generated live Anvil addresses. Ignored by git and safe to delete.
```

Useful direct commands:

```bash
node sdk/src/cli.ts register-identity --role validator --metadata-hash 7777777777777777777777777777777777777777777777777777777777777777 --network local --dry-run
node sdk/src/cli.ts chain-state-check --module-digest aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --evidence-id <evidenceId> --challenge-id <challengeId> --reporter <validator> --challenger <challenger> --network local --deployments-dir out/ec5-anvil-live-flow/deployments
node sdk/src/cli.ts index-events --from-block 0 --to-block latest --network local --deployments-dir out/ec5-anvil-live-flow/deployments --out out/ec5-anvil-live-flow/events.jsonl
node sdk/src/cli.ts audit-bundle --events out/ec5-anvil-live-flow/events.jsonl --evidence-reports out/ec5-anvil-live-flow/evidence-report.json --challenge-records out/ec5-anvil-live-flow/challenge-record.json --out out/ec5-anvil-live-flow/audit-bundle.json
```

`chain-state-check` requires `EVOLUTION_CHAIN_RPC_URL`. Broadcast commands also require `EVOLUTION_CHAIN_PRIVATE_KEY` and `--broadcast`.
`index-events` also requires `EVOLUTION_CHAIN_RPC_URL`. `audit-bundle` reads JSONL/JSON artifacts and does not require an RPC connection.

External validation can reuse the EC-4 SSH channel:

```powershell
ssh -i $env:USERPROFILE\.ssh\originagent_ec3_validator root@47.84.130.213 "uname -a"
```

On the remote machine, install Foundry if `forge/anvil/cast` are missing, then run the same script from a clean uploaded project copy. Remote EC-5 validation proves the local-chain transaction path on an independent host; it still does not create economic rights or mainnet reputation.
