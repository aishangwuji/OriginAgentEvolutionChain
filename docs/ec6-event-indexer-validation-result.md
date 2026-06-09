# EC-6 Event Indexer Validation Result

Date: 2026-05-23

EC-6 validation completed for the event indexer and audit bundle flow.

## Local Validation

```text
npm test: passed, 54 tests
npx --yes solc --bin contracts/src/IdentityRegistry.sol contracts/src/AgentPassportRegistry.sol contracts/src/ModuleRegistry.sol contracts/src/VerificationRegistry.sol contracts/src/ScoreCommitReveal.sol contracts/script/Deploy.s.sol: passed
```

## Remote Validation

Host:

```text
47.84.130.213
Node.js v24.11.1
npm 11.6.2
Foundry v1.7.1-dev alpine/musl build
```

Commands executed from a clean uploaded project copy:

```bash
npm install --no-audit --no-fund
bash scripts/run-ec5-anvil-live-flow.sh
npm run test:contracts
```

Results:

```text
remote npm test inside runner: 54 passed
remote run-ec5-anvil-live-flow.sh: passed
remote npm run test:contracts: 21 passed
remote output directory: /root/originagent-ec6-live/OriginAgentEvolutionChain/out/ec5-anvil-live-flow
```

Audit bundle summary:

```text
ok=true
errors=[]
events.total=7
IdentityRegistered=1
ModuleSubmitted=1
ValidatorProfileSet=1
EvidenceSubmitted=1
ChallengeSubmitted=1
EvidenceInvalidated=1
ChallengeResolved=1
evidence_linkage[0].artifact_matched=true
challenge_linkage[0].record_matched=true
challenge_linkage[0].resolution_found=true
challenge_linkage[0].invalidation_found=true
privacy_scan.ok=true
challenger reputation delta=+5
reporter reputation delta=-10
```

Computed IDs from the remote live flow:

```text
evidenceId=0x54713e83485ffd987e0d4dd68f7615462e3d9366264fc3cc967d50f59930e9cb
challengeId=0x9716d7844f288fc4dcd13faee3ebc2503dd7cbf4b0b1ca2f05821de9c9e1c5d4
```

## Notes

`EvidenceSubmitted` does not emit `proofBundleHash` or `reportHash`, so EC-6 intentionally validates `evidenceId` using the evidence report artifact plus the indexed event. This is an audit model dependency, not a contract change.
