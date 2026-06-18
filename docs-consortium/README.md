# OriginAgentEvolutionChain

Independent chain-side protocol work for OriginAgent evolution modules.

EC-1/EC-2 established a minimal local/EVM-testnet foundation:

- shared schemas for OriginAgent Phase 1 proof bundles and chain submission payloads
- a TypeScript SDK/CLI named `OriginAgentEvolutionChain`
- minimal Solidity registries for identity, modules, verification reports, and score commit/reveal
- fixtures that contain only public hashes and metadata

EC-3 adds the tools-only external validation MVP:

- `submit-tool-module` accepts only proof bundles with `module_type=tool`
- validator reports are gated by foundation allowlist and source diversity
- evidence summary caps repeated operator groups or runner fingerprints
- challenge/invalidate is state-only and sandbox-only; no points credit deduction exists in EC-3

EC-4 adds testnet challenge adjudication:

- any address can submit a challenge against active evidence
- foundation owner resolves challenges and may invalidate evidence
- contribution standing is audit-only and does not migrate to real economic weight

EC-5 adds an Anvil-only live transaction closure:

- contracts are deployed to a fresh local Anvil instance
- SDK/CLI commands can broadcast identity, module, evidence, challenge, and resolution transactions
- chain-state-check reads module, evidence, challenge, identity, and contribution standing state back from the chain

EC-6 adds event-indexed audit artifacts:

- index-events reads chain logs for the contracts in the selected deployment file
- audit-bundle checks events against evidence reports and challenge records
- evidenceId validation intentionally depends on evidence report artifacts because EvidenceSubmitted does not emit proofBundleHash or reportHash

EC-7 adds two-host independent validation:

- bootstrap-ec7-node standardizes remote validator hosts with Node 24, Foundry, and 2G swap
- run-ec7-multi-node-validation executes SDK/contract tests on two remote hosts
- two independent validator reports are submitted to one coordinator Anvil chain and audited through events/audit-bundle

EC-8 adds Agent Passport identity anchors:

- AgentPassportRegistry registers long-lived Agent identities controlled by an owner address
- passportId, genesisHash, and migrationHash are SDK-computable bytes32 anchors
- Passport registration and migration events are indexed and checked by audit-bundle
- encrypted memory vaults, reputation, contribution points economics, and owner recovery remain later phases

EC-9 adds encrypted memory vault restore:

- OriginAgentclient can export allowlisted memory files into an AES-256-GCM vault
- vault public metadata links to an EC-8 Agent Passport without exposing memory plaintext
- audit-bundle accepts `--memory-vaults` and checks public digest integrity plus Passport linkage
- EC-9 does not add contracts, distribute vault keys, migrate Agent private keys, or put memory on-chain

EC-10 adds Agent Passport reputation checkpoints:

- AgentReputationRegistry stores passive Passport-level reputation checkpoints
- address-level `VerificationRegistry.testnetReputation` remains unchanged for challenge flow compatibility
- off-chain reputation records/reports explain `challenge_upheld +5` and `challenge_rejected -2` for challengers
- audit-bundle accepts `--reputation-reports` and checks report integrity, challenge source events, and checkpoint events
- EC-10 does not add contribution points economics, staking, DAO governance, or natural-person uniqueness

EC-11 adds Evolution Unit Kind Registry:

- EvolutionUnitKindRegistry records open Agent capability type definitions such as `tool@1`
- proposal/review artifacts define schema, permission, verification, sandbox, install, rollback, and deprecation semantics
- `tool@1` is the first canonical kind and maps to legacy `ModuleType.Tool` by audit convention, not by contract-level foreign key
- audit-bundle accepts `--unit-kind-proposals` and `--unit-kind-reviews`
- EC-11 does not add Contribution Points, marketplace settlement, Points voting, staking, or DAO governance

EC-12 adds an adversarial simulation harness:

- abuse reports flag protocol-layer risks before Contribution Points or marketplace incentives
- simulation covers Passport Sybil, reputation farming, validator collusion, unit kind typosquatting, module spam, artifact tampering, and privacy leakage
- audit-bundle accepts optional `--abuse-report` and exposes `abuse_signals`
- tampered and dirty artifacts are isolated under `out/ec12-adversarial-simulation/dirty/`
- EC-12 does not add contracts, Points, staking, Credit Deduction, DAO governance, or public-network attacks

EC-13 adds Trust Policy / Risk Gate reports:

- trust policy reports translate EC-12 abuse signals into advisory gate decisions
- subjects include Passports, addresses, validators, unit kinds, module submitters, and artifact sets
- audit-bundle accepts optional `--trust-policy-report` and exposes only `trust_policy_summary`
- EC-13 does not write chain state, change reputation, Credit Deduction, reward, or enforce Contribution Points

EC-14 adds a non-transferable Contribution Points sandbox:

- ContributionPointsLedger records owner-only grant/consume accounting by Agent Passport
- Contribution Points is not ERC20 and has no transfer, approve, allowance, withdraw, or market behavior
- SDK Contribution Points actions consume EC-13 trust gates before broadcast; blocked/manual-review subjects produce deny artifacts
- audit-bundle accepts optional `--test-credit-reports` and exposes `test_credit_linkage`
- EC-12 and EC-13 added no contracts, so deployment `contractVersion` jumps from `ec11.0.0` to `ec14.0.0`

EC-15A adds the challenge adjudication v2 baseline:

- ChallengeAdjudicationRegistry lets a Foundation-allowlisted validator committee finalize challenges
- finalize calls back into VerificationRegistry through `resolveChallengeFromAdjudicator`
- legacy owner `resolveChallenge` remains sandbox-only and is blocked once v2 adjudication starts
- EC-15A verdicts are plain-text and are not suitable for public economic incentives

EC-15B hardens adjudication before public-network incentives:

- production verdicts use commit-reveal: `commitVerdict` then `revealVerdict`
- response / commit / reveal / expire deadlines prevent permanently hanging challenges
- `ExpiredNoQuorum` leaves the VerificationRegistry challenge unresolved and maps to manual review off-chain
- quorum counts only unique Foundation-allowlisted EVM validator addresses that reveal
- `operatorGroupHash` and `runnerFingerprintHash` are diversity hints only, not contract quorum proof
- SDK validator commands use a local SQLite Commitment State Vault for salt persistence, retry, export, and import
- audit-bundle accepts `adjudication_report.v2` and checks commit/reveal/finalize/expire event linkage
- challenge bond remains an off-chain Contribution Points artifact only, with no on-chain credit movement

EC-16A adds module verification and work claim artifacts:

- `module_manifest.v1` records a module distribution URI, immutable module digest, and responsible EVM address
- `module_acquisition_receipt.v1` records that a validator/tester acquired the module and checked the expected digest
- `verification_run_receipt.v1` records a sandbox or validator-run execution result, environment hash, and log digest
- `community_work_claim.v1` links the work proof URI/digest to the responsible address and related artifacts
- audit-bundle accepts EC-16A artifacts through `--module-manifests`, `--module-acquisition-receipts`, `--verification-run-receipts`, and `--community-work-claims`
- `agent_passport_id` remains optional execution metadata; `responsible_address` is the accountability subject
- EC-16A is off-chain artifact and audit linkage only, with no contract changes or economic settlement

Current capability map after EC-16A:

- the protocol can anchor module, evidence, challenge, Passport, memory-vault, reputation, unit-kind, abuse, trust-policy, and Contribution Points public facts
- it can represent module distribution, module acquisition, verification run, and community work proof through canonical artifacts
- it can produce event-indexed and artifact-linked audit bundles and read current module/evidence/challenge/adjudication/Passport/unit-kind/Test-Credit state
- it can run validator committee challenge adjudication through commit-reveal and no-quorum expiration
- it cannot yet identify work nodes as first-class registry subjects, assign formal developer/tester admission, pay uptime/contribution rewards, run marketplace settlement, or issue real Points
- the recommended next design direction is to split future work into Work Node Registry, reward-weight simulation, anti-Sybil calibration, role admission, module publication gates, company admin recovery, and revenue-routing dry runs before any real contribution points economics

Post-EC-16A architecture is split into client, artifact/body, evolution-chain, and node/community-work layers. The evolution-chain layer is the logical ledger and audit protocol; the node/community-work layer is the real-machine and Agent-run protocol work network. See `docs/ec14-current-capability-map.md`, `docs/ec15b-public-adjudication-hardening-runbook.md`, `docs/ec16a-module-verification-protocol-runbook.md`, and `docs/network-bootstrap-and-community-work-layer.md`.

The current network release direction is conservative but explicit: the long-term target is an OriginAgent self-operated private appchain, with Cosmos EVM and EVM appchain frameworks as candidate directions. Early network tests stay inside a PVE private devnet, while public testnet, full public source release, real Points, staking, Credit Deduction, DAO, and marketplace settlement remain postponed until network identity, endpoint discovery, artifact distribution, node work reports, reward simulation, and private-appchain operations are proven. See `docs/appchain-and-network-operations-plan.md`.

This project does not depend on the OriginAgent Python runtime. It consumes exported proof bundle JSON files.

## Commands

```powershell
npm test
node sdk/src/cli.ts verify-proof fixtures/proof_bundle.valid.json
node sdk/src/cli.ts prepare-module fixtures/proof_bundle.valid.json --storage-uri oci://registry.example/originagent/demo-skill@sha256:1111111111111111111111111111111111111111111111111111111111111111
node sdk/src/cli.ts deploy-info --network local
node sdk/src/cli.ts deploy-info --network local --deployments-dir out/ec5-anvil-live-flow/deployments
node sdk/src/cli.ts register-identity --role validator --metadata-hash 7777777777777777777777777777777777777777777777777777777777777777 --network local --dry-run
node sdk/src/cli.ts compute-agent-key-hash --public-key 1111111111111111111111111111111111111111111111111111111111111111
node sdk/src/cli.ts create-agent-passport-record --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --agent-key-hash 0x02d449a31fbb267c8f352e9968a79e3e5fc95c1bbeaa502fd6454ebde5a4bedc --genesis-nonce 3333333333333333333333333333333333333333333333333333333333333333 --metadata-hash 0000000000000000000000000000000000000000000000000000000000000000
node sdk/src/cli.ts register-agent-passport --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --agent-key-hash 0x02d449a31fbb267c8f352e9968a79e3e5fc95c1bbeaa502fd6454ebde5a4bedc --genesis-hash 0x728fc6a9faf5c1f9b38e5d3325df0c9f4ec16b89268ab3e63fb09066c36ab50e --metadata-hash 0000000000000000000000000000000000000000000000000000000000000000 --network local --dry-run
node sdk/src/cli.ts create-agent-reputation-record --passport-id 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --source challenge_upheld --source-id 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb --subject-address 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --created-at 2026-05-23T00:00:00Z
node sdk/src/cli.ts create-agent-reputation-report --passport-id 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --records out/ec10-agent-reputation-flow/agent-reputation-record-upheld.json out/ec10-agent-reputation-flow/agent-reputation-record-rejected.json
node sdk/src/cli.ts checkpoint-agent-reputation --passport-id 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --score 3 --positive-count 1 --negative-count 1 --report-hash 1111111111111111111111111111111111111111111111111111111111111111 --network local --dry-run
node sdk/src/cli.ts create-unit-kind-proposal --kind-id tool --version 1 --display-name Tool --description "Legacy executable tool unit kind." --runtime-surface tool_call --schema-hash 1111111111111111111111111111111111111111111111111111111111111111 --schema-uri ipfs://unit-kind/tool/v1/schema --permission-model "declared tool permissions only" --verification-profile "validator tool execution replay" --risk-class executable_tool --sandbox-requirement "isolated process without secret access" --install-semantics "install as ModuleType.Tool-compatible unit" --rollback-semantics "remove unit manifest and restore previous activation" --compatibility-rules "tool@1 maps to ModuleType.Tool by EC-11 audit convention" --deprecation-rules "legacy mapping remains auditable after deprecation"
node sdk/src/cli.ts create-unit-kind-review --kind-id tool --version 1 --reviewer 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --recommended-status Canonical --risk-assessment "low risk compatibility kind" --validation-summary-hash 2222222222222222222222222222222222222222222222222222222222222222
node sdk/src/cli.ts propose-unit-kind --proposal out/ec11-unit-kind-registry-flow/unit-kind-proposal.json --network local --dry-run
node sdk/src/cli.ts set-unit-kind-review --review out/ec11-unit-kind-registry-flow/unit-kind-review.json --network local --dry-run
node sdk/src/cli.ts set-unit-kind-status --kind-id tool --version 1 --status Canonical --network local --dry-run
node sdk/src/cli.ts create-module-manifest --module-id ec16a-demo-module --module-name "EC16A Demo Module" --version 1.0.0 --storage-uri https://github.com/originagent/demo-modules/releases/download/ec16a/demo-module.tgz --storage-kind github_release --module-digest aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --digest-algorithm sha256 --responsible-address 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --created-at 2026-05-25T00:00:00.000Z --out out/ec16a/module-manifest.json
node sdk/src/cli.ts validate-module-manifest out/ec16a/module-manifest.json
node sdk/src/cli.ts create-module-acquisition-receipt --module-id ec16a-demo-module --manifest-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --storage-uri https://github.com/originagent/demo-modules/releases/download/ec16a/demo-module.tgz --downloaded-digest bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb --expected-digest bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb --hash-matched true --acquired-by 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 --acquired-at 2026-05-25T00:00:00.000Z --created-at 2026-05-25T00:00:00.000Z --out out/ec16a/module-acquisition-receipt.json
node sdk/src/cli.ts validate-module-acquisition-receipt out/ec16a/module-acquisition-receipt.json
node sdk/src/cli.ts create-verification-run-receipt --module-id ec16a-demo-module --manifest-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --acquisition-receipt-hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb --validator-address 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 --environment-hash cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc --run-result passed --log-uri https://github.com/originagent/evolution-proofs/releases/download/ec16a/verification-run-log.txt --log-digest dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd --started-at 2026-05-25T00:00:00.000Z --completed-at 2026-05-25T00:05:00.000Z --created-at 2026-05-25T00:06:00.000Z --out out/ec16a/verification-run-receipt.json
node sdk/src/cli.ts validate-verification-run-receipt out/ec16a/verification-run-receipt.json
node sdk/src/cli.ts create-community-work-claim --claim-id ec16a-demo-testing-claim --responsible-address 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --work-kind testing --summary "Downloaded module fixture, verified digest, ran sandbox verification, and linked receipts." --proof-uri https://github.com/originagent/evolution-proofs/releases/download/ec16a/community-work-proof.txt --proof-digest eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee --artifact-hashes aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc --created-at 2026-05-25T00:07:00.000Z --out out/ec16a/community-work-claim.json
node sdk/src/cli.ts validate-community-work-claim out/ec16a/community-work-claim.json
node sdk/src/cli.ts analyze-adversarial-simulation --events out/ec12-adversarial-simulation/events.jsonl --evidence-reports out/ec12-adversarial-simulation/evidence-report-self.json --agent-passports out/ec12-adversarial-simulation/agent-passport-1.json --unit-kind-proposals out/ec12-adversarial-simulation/unit-kind-proposal-tool.json --unit-kind-reviews out/ec12-adversarial-simulation/unit-kind-review-tool.json --out out/ec12-adversarial-simulation/abuse-report.json
node sdk/src/cli.ts validate-abuse-report out/ec12-adversarial-simulation/abuse-report.json
node sdk/src/cli.ts evaluate-trust-policy --abuse-report out/ec12-adversarial-simulation/abuse-report.json --out out/ec13-trust-policy-flow/trust-policy-report.json
node sdk/src/cli.ts validate-trust-policy-report out/ec13-trust-policy-flow/trust-policy-report.json --source-abuse-report out/ec12-adversarial-simulation/abuse-report.json
node sdk/src/cli.ts create-test-credit-action --passport-id 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --action grant --reason passport_bootstrap --trust-policy-report-hash 1111111111111111111111111111111111111111111111111111111111111111 --created-at 2026-05-23T00:00:00Z
node sdk/src/cli.ts create-test-credit-report --passport-id 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --actions out/ec14-test-credit-sandbox-flow/test-credit-action-clean-grant.json out/ec14-test-credit-sandbox-flow/test-credit-action-clean-consume.json
node sdk/src/cli.ts validate-test-credit-report out/ec14-test-credit-sandbox-flow/test-credit-report-clean.json --trust-policy-report out/ec13-trust-policy-flow/trust-policy-report.json
node sdk/src/cli.ts grant-test-credit --action out/ec14-test-credit-sandbox-flow/test-credit-action-clean-grant.json --network local --dry-run
node sdk/src/cli.ts consume-test-credit --action out/ec14-test-credit-sandbox-flow/test-credit-action-clean-consume.json --network local --dry-run
node sdk/src/cli.ts submit-module --proof-bundle fixtures/proof_bundle.valid.json --storage-uri oci://registry.example/originagent/demo-skill@sha256:1111111111111111111111111111111111111111111111111111111111111111 --network local --dry-run
node sdk/src/cli.ts submit-tool-module --proof-bundle fixtures/proof_bundle.tool.valid.json --storage-uri oci://registry.example/originagent/demo-tool@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --network local --dry-run
node sdk/src/cli.ts submit-verification --proof-bundle fixtures/proof_bundle.valid.json --network local --dry-run
node sdk/src/cli.ts set-validator-profile --validator 0x6666666666666666666666666666666666666666 --operator-group-hash 1111111111111111111111111111111111111111111111111111111111111111 --runner-fingerprint-hash 2222222222222222222222222222222222222222222222222222222222222222 --allowed true --network local --dry-run
node sdk/src/cli.ts submit-validator-report --report fixtures/evidence_report.validator.valid.json --network local --dry-run
node sdk/src/cli.ts evidence-summary --reports fixtures/evidence_report.validator.valid.json fixtures/evidence_report.validator.second.valid.json
node sdk/src/cli.ts create-challenge-record --evidence-id 0x361b495f66880e093aafba25cae772528fcfd6a76dde0777236bf7a3b5a8baf6 --module-digest aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --reason-hash 9999999999999999999999999999999999999999999999999999999999999999 --challenger 0x8888888888888888888888888888888888888888 --reporter 0x6666666666666666666666666666666666666666 --created-at 2026-05-23T00:00:00Z --status upheld --resolution-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
node sdk/src/cli.ts submit-challenge --evidence-id 0x361b495f66880e093aafba25cae772528fcfd6a76dde0777236bf7a3b5a8baf6 --reason-hash 9999999999999999999999999999999999999999999999999999999999999999 --network local --dry-run
node sdk/src/cli.ts resolve-challenge --challenge-id 0x404dc225fc320b3990e027d7386acae0423f1613f80b64bf4fd6e7aac3826651 --upheld true --resolution-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --network local --dry-run
node sdk/src/cli.ts create-challenge-response --challenge-id 0x404dc225fc320b3990e027d7386acae0423f1613f80b64bf4fd6e7aac3826651 --evidence-id 0x361b495f66880e093aafba25cae772528fcfd6a76dde0777236bf7a3b5a8baf6 --respondent 0x6666666666666666666666666666666666666666 --response-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --created-at 2026-05-24T00:00:00.000Z --out out/ec15b/challenge-response.json
node sdk/src/cli.ts submit-challenge-response --response out/ec15b/challenge-response.json --network local --dry-run
node sdk/src/cli.ts create-verdict-commitment --challenge-id 0x404dc225fc320b3990e027d7386acae0423f1613f80b64bf4fd6e7aac3826651 --validator 0x6666666666666666666666666666666666666666 --claimed-upheld true --verdict-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --method-hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb --created-at 2026-05-24T00:00:00.000Z --vault out/ec15b/validator-vault.sqlite --out out/ec15b/verdict-commitment.json
node sdk/src/cli.ts commit-validator-verdict --challenge-id 0x404dc225fc320b3990e027d7386acae0423f1613f80b64bf4fd6e7aac3826651 --validator 0x6666666666666666666666666666666666666666 --claimed-upheld true --verdict-hash aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --method-hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb --created-at 2026-05-24T00:00:00.000Z --vault out/ec15b/validator-vault.sqlite --commitment-out out/ec15b/verdict-commitment.json --network local --dry-run
node sdk/src/cli.ts reveal-validator-verdict --challenge-id 0x404dc225fc320b3990e027d7386acae0423f1613f80b64bf4fd6e7aac3826651 --validator 0x6666666666666666666666666666666666666666 --vault out/ec15b/validator-vault.sqlite --reveal-out out/ec15b/verdict-reveal.json --network local --dry-run
node sdk/src/cli.ts retry-verdict-reveal --challenge-id 0x404dc225fc320b3990e027d7386acae0423f1613f80b64bf4fd6e7aac3826651 --validator 0x6666666666666666666666666666666666666666 --vault out/ec15b/validator-vault.sqlite --network local --dry-run
node sdk/src/cli.ts list-pending-verdict-reveals --vault out/ec15b/validator-vault.sqlite
node sdk/src/cli.ts export-verdict-commitment --challenge-id 0x404dc225fc320b3990e027d7386acae0423f1613f80b64bf4fd6e7aac3826651 --validator 0x6666666666666666666666666666666666666666 --vault out/ec15b/validator-vault.sqlite --out out/ec15b/verdict-commitment-export.json
node sdk/src/cli.ts import-verdict-commitment --file out/ec15b/verdict-commitment-export.json --vault out/ec15b/restored-vault.sqlite
node sdk/src/cli.ts create-adjudication-report --phase finalized --challenge-id 0x404dc225fc320b3990e027d7386acae0423f1613f80b64bf4fd6e7aac3826651 --claimed-upheld true --final-report-hash cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc --quorum 3 --effective-verdict-count 3 --commitment-hashes aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc --revealed-verdict-hashes dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff --unrevealed-commitment-count 0 --response-by 2026-05-24T00:00:00.000Z --commit-by 2026-05-27T00:00:00.000Z --reveal-by 2026-05-28T00:00:00.000Z --finalized-at 2026-05-28T00:00:01.000Z --out out/ec15b/adjudication-report.json
node sdk/src/cli.ts validate-adjudication-report out/ec15b/adjudication-report.json
node sdk/src/cli.ts finalize-challenge-adjudication --report out/ec15b/adjudication-report.json --network local --dry-run
node sdk/src/cli.ts expire-challenge-no-quorum --report out/ec15b/expired-adjudication-report.json --network local --dry-run
node sdk/src/cli.ts chain-state-check --module-digest aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --evidence-id 0x361b495f66880e093aafba25cae772528fcfd6a76dde0777236bf7a3b5a8baf6 --challenge-id 0x404dc225fc320b3990e027d7386acae0423f1613f80b64bf4fd6e7aac3826651 --reporter 0x6666666666666666666666666666666666666666 --challenger 0x8888888888888888888888888888888888888888 --network local
node sdk/src/cli.ts index-events --from-block 0 --to-block latest --network local --deployments-dir out/ec5-anvil-live-flow/deployments --out out/ec5-anvil-live-flow/events.jsonl
node sdk/src/cli.ts audit-bundle --events out/ec5-anvil-live-flow/events.jsonl --evidence-reports out/ec5-anvil-live-flow/evidence-report.json --challenge-records out/ec5-anvil-live-flow/challenge-record.json --out out/ec5-anvil-live-flow/audit-bundle.json
node sdk/src/cli.ts challenge-summary --challenges fixtures/challenge_record.upheld.valid.json
node sdk/src/cli.ts evidence-summary --reports fixtures/evidence_report.validator.valid.json fixtures/evidence_report.validator.second.valid.json --challenge-summary out/ec4-challenge-validation/challenge-summary.json
node sdk/src/cli.ts create-external-validator-artifact --module-digest aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --validator 0x6666666666666666666666666666666666666666 --operator-group-hash 1111111111111111111111111111111111111111111111111111111111111111 --runner-fingerprint-hash 2222222222222222222222222222222222222222222222222222222222222222 --tool-tests-hash 2b517d681fb728bf05da53e4a79f53005968476affe5cb239cdedaf4a46a53bc --result-digest cb18c111559d1102a7e30d5e8af1ea4f31307ad790f3edf81d6882d90e8ad56e --created-at 2026-05-22T09:18:00Z
bash scripts/run-ec3-external-validation.sh
bash scripts/run-ec4-challenge-validation.sh
bash scripts/run-ec5-anvil-live-flow.sh
EC7_SSH_KEY=<path-to-ssh-key> EC7_NODE_HOST=154.40.59.232 EC7_NODE_ROLE=validator-2 EC7_NODE_NAME=oaec-validator-2 bash scripts/bootstrap-ec7-node.sh
EC7_SSH_KEY=<path-to-ssh-key> bash scripts/run-ec7-multi-node-validation.sh
bash scripts/run-ec8-agent-passport-live-flow.sh
bash scripts/run-ec9-memory-vault-restore-flow.sh
bash scripts/run-ec10-agent-reputation-flow.sh
bash scripts/run-ec11-unit-kind-registry-flow.sh
bash scripts/run-ec12-adversarial-simulation-flow.sh
bash scripts/run-ec13-trust-policy-flow.sh
bash scripts/run-ec14-test-credit-sandbox-flow.sh
bash scripts/run-ec15a-challenge-adjudication-flow.sh
bash scripts/run-ec15b-public-adjudication-hardening-flow.sh
bash scripts/run-ec16a-module-verification-protocol-flow.sh
node sdk/src/cli.ts score-commit --module 0x1111111111111111111111111111111111111111111111111111111111111111 --score 88 --reason-hash 0x2222222222222222222222222222222222222222222222222222222222222222 --salt 0x3333333333333333333333333333333333333333333333333333333333333333
node sdk/src/cli.ts submit-score-commit --module 0x1111111111111111111111111111111111111111111111111111111111111111 --score 88 --reason-hash 0x2222222222222222222222222222222222222222222222222222222222222222 --salt 0x3333333333333333333333333333333333333333333333333333333333333333 --network local --dry-run
```

Foundry contract tests live under `contracts/`. Run them with `forge test` from that directory when Foundry is installed.

EC-2 uses Foundry for local deployment and contract execution. Install Foundry as the official `forge/anvil/cast` toolchain; it is not a Python package and should not be installed with pip. The SDK only uses `viem` for ABI encoding and optional RPC broadcasting.

The tracked `deployments/local.json` is a local dry-run fixture. EC-5 live Anvil runs do not overwrite it; generated live addresses are written under `out/ec5-anvil-live-flow/deployments/local.json` and consumed with `--deployments-dir out/ec5-anvil-live-flow/deployments`.
EC-6 audit artifacts are also generated under `out/ec5-anvil-live-flow/`; `events.jsonl` is a raw event index and `audit-bundle.json` is the cross-check report. See `docs/ec6-event-indexer-runbook.md`.
EC-7 multi-node validation artifacts are generated under `out/ec7-multi-node-validation/` and stay out of git. See `docs/ec7-multi-node-validation-runbook.md` and `docs/ec7-multi-node-validation-result.md`.
EC-8 Agent Passport artifacts are generated under `out/ec8-agent-passport-live-flow/` and stay out of git. See `docs/ec8-agent-passport-runbook.md`, `docs/ec8-agent-passport-validation-result.md`, and `docs/ec8-agent-passport-memory-economy-note.md`.
EC-9 memory vault restore artifacts are generated under `out/ec9-memory-vault-restore-flow/` and stay out of git. See `docs/ec9-memory-vault-runbook.md` and `docs/ec9-memory-vault-validation-result.md`.
EC-10 reputation checkpoint artifacts are generated under `out/ec10-agent-reputation-flow/` and stay out of git. See `docs/ec10-reputation-runbook.md` and `docs/ec10-reputation-validation-result.md`.
EC-11 unit kind registry artifacts are generated under `out/ec11-unit-kind-registry-flow/` and stay out of git. See `docs/ec11-unit-kind-registry-runbook.md` and `docs/ec11-unit-kind-registry-validation-result.md`.
EC-12 adversarial simulation artifacts are generated under `out/ec12-adversarial-simulation/` and stay out of git. See `docs/ec12-adversarial-simulation-runbook.md` and `docs/ec12-adversarial-simulation-validation-result.md`.
EC-13 trust policy artifacts are generated under `out/ec13-trust-policy-flow/` and stay out of git. See `docs/ec13-trust-policy-runbook.md` and `docs/ec13-trust-policy-validation-result.md`.
EC-14 Contribution Points sandbox artifacts are generated under `out/ec14-test-credit-sandbox-flow/` and stay out of git. See `docs/ec14-test-credit-runbook.md` and `docs/ec14-test-credit-validation-result.md`.
EC-15A challenge adjudication artifacts are generated under `out/ec15a-challenge-adjudication-flow/` and stay out of git.
EC-15B public adjudication hardening artifacts are generated under `out/ec15b-public-adjudication-hardening-flow/` and stay out of git. See `docs/ec15b-public-adjudication-hardening-runbook.md` and `docs/ec15b-public-adjudication-hardening-validation-result.md`.
EC-16A module verification artifacts are generated under `out/ec16a-module-verification-protocol-flow/` and stay out of git. See `docs/ec16a-module-verification-protocol-runbook.md` and `docs/ec16a-module-verification-protocol-validation-result.md`.
The current post-EC-16A capability is summarized in this README; the last full gap map remains `docs/ec14-current-capability-map.md`.

```powershell
cd contracts
forge test
anvil
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

Real transaction broadcasting is opt-in. Set `EVOLUTION_CHAIN_RPC_URL` and `EVOLUTION_CHAIN_PRIVATE_KEY`, then pass `--broadcast`. Without `--broadcast`, submit commands remain dry-run.

## Boundaries

EC-16A records only public governance/proof/identity/reputation/unit-kind/abuse-signal/trust-policy/test-credit/adjudication/module-verification facts: digests, hashes, URIs, status, validator/operator hashes, challenge hashes, adjudication commitment/reveal/finalize/expire hashes, module manifest hashes, acquisition receipt hashes, verification run hashes, community work claim hashes, Agent Passport hashes, memory vault public digests, Passport-level reputation checkpoints, unit kind proposal/review hashes, abuse signal categories, trust gate summaries, Contribution Points action/report hashes, public owner addresses, public metadata hashes, server tool versions, and decoded public events. Code, prompts, private facts, raw telemetry, local paths, URL queries, production keys, Anvil private keys, Agent private keys, validator reveal salt outside the local vault, vault keys, decrypted memory, full logs, module bodies, and work proof bodies stay out of chain artifacts. EC-10 Passport reputation, EC-11 canonical kind status, EC-12 abuse signals, EC-13 trust gates, EC-14 Contribution Points, EC-15B adjudication, and EC-16A work claims are not transferable Points, do not create real economic rewards, and do not automatically punish participants.
