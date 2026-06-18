# EC-15B Public Adjudication Hardening Runbook

Date: 2026-05-24

## Purpose

EC-15B hardens EC-15A challenge adjudication before any public-network or economic incentive work.

It adds:

```text
commit-reveal validator verdicts
response / commit / reveal / expire adjudication lifecycle
ExpiredNoQuorum terminal state
validator-local Commitment State Vault
adjudication_report.v2 audit linkage
off-chain Contribution Points challenge bond artifacts
```

EC-15B does not add real Points, staking, Credit Deduction, DAO governance, marketplace settlement, community validation work rewards, or airdrop-like points.

## Contract Flow

`ChallengeAdjudicationRegistry.VERSION = ec15b.0.0`.

The production verdict path is:

```text
submitResponse(challengeId, responseHash)
commitVerdict(challengeId, commitmentHash)
revealVerdict(challengeId, claimedUpheld, verdictHash, methodHash, salt)
finalizeChallenge(challengeId, claimedUpheld, finalReportHash)
```

No-quorum timeout path:

```text
expireChallengeNoQuorum(challengeId, expirationReportHash)
```

Commitment formula:

```text
keccak256(abi.encode(challengeId, validator, claimedUpheld, verdictHash, methodHash, salt))
```

Deadline formula:

```text
responseBy = challengeSubmittedAt + 1 day
commitStart = responseSubmittedAt != 0 ? responseSubmittedAt : responseBy
commitBy = commitStart + 3 days
revealBy = commitBy + 1 day
```

`expireChallengeNoQuorum` can run only after `revealBy` and only when neither upheld nor rejected reached quorum. It does not call `VerificationRegistry.resolveChallengeFromAdjudicator`, so the underlying challenge remains unresolved in `VerificationRegistry` and should be treated as `unresolved` / `manual_review` by policy consumers.

## Quorum Boundary

EC-15B quorum counts only unique Foundation-allowlisted EVM validator addresses that successfully reveal.

`operatorGroupHash` and `runnerFingerprintHash` are still emitted in reveal events, but they are diversity hints for indexers and curators only. They do not affect contract quorum and must not be treated as Sybil resistance.

## Commitment Vault

Validator CLI commands use `sdk/src/adjudication-vault.ts`.

The vault stores:

```text
challengeId
validator
claimedUpheld
verdictHash
methodHash
salt
commitmentHash
status
commit / reveal transaction metadata
```

The vault is local validator/node SDK infrastructure. It is not a client safety root and should not be read by ordinary OriginAgent clients.

Commands:

```bash
node sdk/src/cli.ts create-verdict-commitment \
  --challenge-id <challenge_id> \
  --validator <validator> \
  --claimed-upheld true \
  --verdict-hash <hash> \
  --method-hash <hash> \
  --created-at 2026-05-24T00:00:00.000Z \
  --vault out/ec15b/vault.sqlite \
  --out out/ec15b/commitment.json

node sdk/src/cli.ts commit-validator-verdict \
  --challenge-id <challenge_id> \
  --validator <validator> \
  --claimed-upheld true \
  --verdict-hash <hash> \
  --method-hash <hash> \
  --created-at 2026-05-24T00:00:00.000Z \
  --vault out/ec15b/vault.sqlite \
  --commitment-out out/ec15b/commitment.json \
  --network local \
  --broadcast

node sdk/src/cli.ts reveal-validator-verdict \
  --challenge-id <challenge_id> \
  --validator <validator> \
  --vault out/ec15b/vault.sqlite \
  --reveal-out out/ec15b/reveal.json \
  --network local \
  --broadcast

node sdk/src/cli.ts retry-verdict-reveal \
  --challenge-id <challenge_id> \
  --validator <validator> \
  --vault out/ec15b/vault.sqlite \
  --network local \
  --broadcast

node sdk/src/cli.ts list-pending-verdict-reveals \
  --vault out/ec15b/vault.sqlite

node sdk/src/cli.ts export-verdict-commitment \
  --challenge-id <challenge_id> \
  --validator <validator> \
  --vault out/ec15b/vault.sqlite \
  --out out/ec15b/commitment-export.json

node sdk/src/cli.ts import-verdict-commitment \
  --file out/ec15b/commitment-export.json \
  --vault out/ec15b/restored-vault.sqlite
```

If the vault and any export backup are missing, salt recovery is impossible by design.

## Adjudication Report v2

Finalized report:

```bash
node sdk/src/cli.ts create-adjudication-report \
  --phase finalized \
  --challenge-id <challenge_id> \
  --claimed-upheld true \
  --final-report-hash <hash> \
  --quorum 3 \
  --effective-verdict-count 3 \
  --response-hashes <response_hash> \
  --commitment-hashes <commitment_hash_1> <commitment_hash_2> <commitment_hash_3> \
  --revealed-verdict-hashes <verdict_hash_1> <verdict_hash_2> <verdict_hash_3> \
  --unrevealed-commitment-count 0 \
  --response-by <iso> \
  --commit-by <iso> \
  --reveal-by <iso> \
  --finalized-at <iso> \
  --out out/ec15b/adjudication-report.json
```

Expired report:

```bash
node sdk/src/cli.ts create-adjudication-report \
  --phase expired_no_quorum \
  --challenge-id <challenge_id> \
  --expiration-report-hash <hash> \
  --quorum 3 \
  --effective-verdict-count 0 \
  --commitment-hashes <commitment_hash_1> \
  --unrevealed-commitment-count 1 \
  --response-by <iso> \
  --commit-by <iso> \
  --reveal-by <iso> \
  --expired-at <iso> \
  --out out/ec15b/expired-adjudication-report.json
```

Validate:

```bash
node sdk/src/cli.ts validate-adjudication-report out/ec15b/adjudication-report.json
```

## Bond Artifact Boundary

Challenge bond remains off-chain Contribution Points artifact modeling only.

Audit requires a `challenge_bond_lock` artifact for EC-15B adjudication reports, but there is no on-chain credit movement, forced refund, or enforceable Credit Deduction.

Settlement semantics are recorded as artifacts only:

```text
upheld: bond artifact records 10 as refundable
rejected: bond artifact records 10 as consumed
expired_no_quorum without response: bond artifact records fee 1 and refundable 9
expired_no_quorum with response: bond artifact records fee 5 and refundable 5
```

## Audit And State Inspection

Audit:

```bash
node sdk/src/cli.ts audit-bundle \
  --events out/ec15b-public-adjudication-hardening-flow/events.jsonl \
  --evidence-reports out/ec15b-public-adjudication-hardening-flow/upheld-evidence-report.json \
  --challenge-records out/ec15b-public-adjudication-hardening-flow/upheld-challenge-record.json \
  --test-credit-reports out/ec15b-public-adjudication-hardening-flow/test-credit-report-bond.json \
  --adjudication-reports out/ec15b-public-adjudication-hardening-flow/upheld-adjudication-report.json \
  --out out/ec15b-public-adjudication-hardening-flow/audit-bundle.json
```

`audit-bundle` checks event presence and hash consistency for:

```text
AdjudicationPhaseStarted deadlines
ValidatorVerdictCommitted commitment hashes
ValidatorVerdictRevealed verdict hashes
ChallengeAdjudicationFinalized final reports
ChallengeAdjudicationExpiredNoQuorum expiration reports
```

It does not recompute module quality, recompute quorum, or use operator/runner hints as quorum proof.

State:

```bash
EVOLUTION_CHAIN_RPC_URL=http://127.0.0.1:8545 \
node sdk/src/cli.ts chain-state-check \
  --challenge-id <challenge_id> \
  --network local \
  --deployments-dir out/ec15b-public-adjudication-hardening-flow/deployments
```

`chain-state-check --challenge-id` returns EC-15B adjudication phase, response, deadlines, response count, commitment count, reveal count, quorum, finalized / expired state, outcome, and effective vote counts.

## Runner

Run:

```bash
bash scripts/run-ec15b-public-adjudication-hardening-flow.sh
```

The runner starts a fresh Anvil chain, deploys contracts, confirms the adjudicator, registers validators, and demonstrates:

```text
upheld path: response -> 3 commits -> 3 reveals -> finalize upheld -> evidence invalidated
rejected path: response -> 3 commits -> 3 reveals -> finalize rejected -> evidence remains active
expired path: no response -> delayed commit -> no quorum -> expire no quorum
audit-bundle.ok=true
chain-state-check shows finalized or expired adjudication state
```

Expected output directory:

```text
out/ec15b-public-adjudication-hardening-flow/
```

Key outputs:

```text
events.jsonl
audit-bundle.json
upheld-chain-state-check.json
rejected-chain-state-check.json
expired-chain-state-check.json
ec15b-summary.json
```

## Validation

Run:

```bash
npm test
npm run test:contracts
bash scripts/run-ec15b-public-adjudication-hardening-flow.sh
git diff --check
```

Use a remote Linux host with Node 24, Foundry, Anvil, and Cast if the local workstation lacks Foundry or Bash.

## Safety Boundary

EC-15B is mandatory before any real economic incentive experiment. Even after EC-15B, the system still depends on Foundation allowlist validator admission and off-chain Contribution Points modeling.

Do not introduce real Points emission, staking, Credit Deduction, DAO, marketplace settlement, community validation work rewards, or airdrop-like points in EC-15B.
