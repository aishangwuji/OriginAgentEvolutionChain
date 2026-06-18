# EC-6 Event Indexer And Audit Bundle Runbook

EC-6 extends the EC-5 Anvil live transaction loop with event indexing and audit bundle generation. It does not change contracts and does not add a database, explorer, public testnet, Points, DAO, CreditPool, ContributionPool, or OriginAgent client integration.

Important evidence boundary:

```text
EvidenceSubmitted emits evidenceId, moduleDigest, evidenceType, and reporter.
It does not emit proofBundleHash or reportHash.
Therefore events alone cannot reconstruct evidenceId.
The audit bundle validates evidenceId by combining chain events with evidence report artifacts.
```

## Index Events

`index-events` reads logs for the contracts in the selected deployment file:

```bash
EVOLUTION_CHAIN_RPC_URL=http://127.0.0.1:8545 \
node sdk/src/cli.ts index-events \
  --from-block 0 \
  --to-block latest \
  --network local \
  --deployments-dir out/ec5-anvil-live-flow/deployments \
  --out out/ec5-anvil-live-flow/events.jsonl
```

Output:

```text
schema_version: originagent.evolution.event.v1
format: JSONL
ordering: block_number, then log_index
args: raw decoded event args; enum values remain uint8 numbers
```

## Create Audit Bundle

`audit-bundle` cross-checks indexed events against evidence reports and challenge records:

```bash
node sdk/src/cli.ts audit-bundle \
  --events out/ec5-anvil-live-flow/events.jsonl \
  --evidence-reports out/ec5-anvil-live-flow/evidence-report.json \
  --challenge-records out/ec5-anvil-live-flow/challenge-record.json \
  --out out/ec5-anvil-live-flow/audit-bundle.json
```

The output schema is `originagent.evolution.audit_bundle.v1` and contains:

```text
ok
errors
chain_id
deployment
events
evidence_linkage
challenge_linkage
reputation_delta
privacy_scan
evidence_summary
notes
```

Audit rules:

```text
Every evidence report must match an EvidenceSubmitted event.
The EvidenceSubmitted event must match computed evidenceId, moduleDigest, evidenceType, and reporter.
Every challenge record must match a ChallengeSubmitted event.
ChallengeSubmitted arguments must independently recompute challengeId.
Resolved challenge records must have a ChallengeResolved event.
An upheld challenge must also have an EvidenceInvalidated event.
Privacy scan failures make ok=false.
```

## Full Live Flow

The EC-5 runner now includes EC-6 indexing and audit checks:

```bash
bash scripts/run-ec5-anvil-live-flow.sh
```

Expected generated files:

```text
out/ec5-anvil-live-flow/events.jsonl
out/ec5-anvil-live-flow/index-events.json
out/ec5-anvil-live-flow/audit-bundle.json
out/ec5-anvil-live-flow/create-audit-bundle.json
```

The runner fails if `audit-bundle.json` has `ok=false`.

## Validation

Local SDK validation:

```bash
npm test
npx --yes solc --bin contracts/src/IdentityRegistry.sol contracts/src/AgentPassportRegistry.sol contracts/src/ModuleRegistry.sol contracts/src/VerificationRegistry.sol contracts/src/ScoreCommitReveal.sol contracts/script/Deploy.s.sol
```

Remote validation can reuse the existing EC-3/EC-5 SSH channel:

```powershell
ssh -i $env:USERPROFILE\.ssh\originagent_ec3_validator root@47.84.130.213 "cd /root/originagent-ec6-live/OriginAgentEvolutionChain && bash scripts/run-ec5-anvil-live-flow.sh && npm run test:contracts"
```

Remote output should include `audit-bundle.json` with `ok=true`, an upheld challenge, an evidence invalidation, challenger reputation `+5`, and reporter reputation `-10`.
