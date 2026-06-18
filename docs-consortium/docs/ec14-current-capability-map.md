# EC-14 Current Capability Map

Date: 2026-05-24

Baseline commit: `3d2b889 feat: add EC-14 Contribution Points sandbox`

## Purpose

This document records what the evolution chain can actually do after EC-14, what it cannot do yet, and why the next design step should settle network bootstrap, artifact distribution, and community work boundaries before real Points or marketplace settlement.

EC-14 has produced a working chain-side audit and Contribution Points sandbox. It is not a production public network, Points economy, marketplace, or DAO.

## Current Capability Summary

The current chain-side system can run this end-to-end path:

```text
proof bundle
  -> module submission
  -> evidence report
  -> challenge / resolution
  -> indexed events
  -> audit bundle
  -> Agent Passport
  -> memory vault public linkage
  -> Passport reputation checkpoint
  -> open unit kind proposal / review / canonical status
  -> adversarial abuse report
  -> trust policy gate report
  -> non-transferable Contribution Points grant / consume / deny
```

The system is best described as:

```text
public proof anchor + event-indexed audit layer + pre-economy safety sandbox
```

It does not run Agent code on-chain. It anchors public hashes, public metadata, event state, and auditable reports.

## Four-Layer Architecture

Post-EC-14 architecture is split into four OriginAgent layers:

```text
OriginAgent 客户端层
OriginAgent 躯体层 / Artifact 层
OriginAgent 进化链层
OriginAgent 节点层
```

These layers are related, but they are not interchangeable.

```text
OriginAgent 客户端层:
  User-local Agent runtime.
  Runs locally and remains usable without chain access.
  Owns local memory, prompts, facts, sessions, tools, installation state, activation, rollback, and local execution.
  May export public proof bundles, adoption artifacts, or audit requests.
  Must not upload private memory, prompt, facts, local logs, API keys, or decrypted vault contents to the chain.

OriginAgent 躯体层 / Artifact 层:
  Stores downloadable evolution bodies: modules, upgrade packages, tool bundles, workflow definitions, planner policies, memory strategies, manifests, schemas, and versioned artifacts.
  May use IPFS, Arweave, OCI registry, Git release storage, or a dedicated artifact service.
  The chain records only hashes, digests, URIs, schema hashes, version hashes, review hashes, and audit anchors for these artifacts.
  It is the storage and distribution layer for executable or installable evolution content, not the ledger itself.

OriginAgent 进化链层:
  Logical ledger and audit protocol layer.
  Records public facts, hashes, contract state, chain events, Passport anchors, module digests, evidence, challenges, reputation checkpoints, unit kind status, trust summaries, and Contribution Points events.
  It is currently validated on Anvil-style local EVM deployments, and the long-term target is an OriginAgent self-operated private appchain.
  Candidate private appchain directions are Cosmos EVM and EVM appchain frameworks.
  It is not the client runtime, not artifact storage, and not a real Points economy.

OriginAgent 节点层:
  Real machines and services that work around the evolution chain.
  Runs indexer, validator, auditor, gateway, mirror, and sandbox/trial processes.
  Reads chain state, submits public artifacts or transactions, indexes events, checks artifact envelopes, mirrors body-layer content, and produces audit evidence.
  It is the protocol worker network, not the chain ledger itself.
```

The important boundary:

```text
OriginAgent 进化链层 = 逻辑账本层。
OriginAgent 节点层 = 现实机器上的协议工作节点网络。
```

EC-15 is therefore not about creating EVM/L2 consensus nodes, and it is not about deciding who can use the OriginAgent client.

```text
EC-15 不是底层区块链共识节点。
The candidate next phase defines network bootstrap, OriginAgent protocol work nodes, measurable public work, and Contribution Points reward simulation.
Node ID 是贡献账户，不是邀请码。
```

Typical candidate node/community-work roles:

```text
Indexer Node:
  Reads chain events and produces events.jsonl or query indexes.

Community Validator / Evaluator Node:
  Downloads artifacts, recomputes digests, runs controlled tests, and submits signed evaluation claims.
  These claims are community reports, not official conclusions.

Audit Node:
  Generates audit bundles and verifies artifact-to-event consistency.

Artifact Mirror Node:
  Mirrors modules, manifests, schemas, review reports, and other body-layer content.

Ingress / Gateway Node:
  Helps developers or clients submit artifacts to the body layer and hashes/URIs to the evolution chain.

Trial / Sandbox Node:
  Runs modules in isolated environments and reports adoption, failure, or rollback summaries.
```

## Network Bootstrap And Community Work Boundary

The network bootstrap and community work model is recorded in:

```text
docs/network-bootstrap-and-community-work-layer.md
```

The appchain and release-control model is recorded in:

```text
docs/appchain-and-network-operations-plan.md
```

Key boundary:

```text
OriginAgent official infrastructure may provide default entry points, but it must not become the only protocol entry point.
OriginAgent does not certify uploaded content.
OriginAgent records claims, hashes, reports, challenges, adoption signals, and reward/accounting anchors.
Quality is discovered by community evaluation, adversarial challenge, and market adoption.
```

A public network manifest is a bootstrap source, not protocol authority:

```text
domain = convenient discovery transport
genesis manifest = network identity authority
signed endpoint manifest = updateable endpoint metadata
chain state = final audit anchor
artifact hash = content authority
local cache = short-term outage resistance
community mirrors = alternative discovery and distribution paths
```

The client should be able to discover RPC, indexer, ingress gateway, and artifact mirror endpoints from multiple signed-manifest sources, then cache valid manifests locally. If an official domain is down, existing clients should continue with cached endpoints and new clients should support manual manifest import.

The official chain/client/body-layer path should enforce protocol integrity only:

```text
digest matches bytes
signature is valid
schema envelope is parseable
submitter identity is known
storage URI is recorded
chain anchor matches report hash
privacy / secret scan rejects forbidden public artifact content
```

It should not claim that an uploaded module is safe, high quality, performant, or worth installing. Those claims belong to community reports, challenges, curators, adoption history, and user/client policy.

Privacy scan and secret scan are protocol hygiene, not official content security review. They reject private data in public artifacts; they do not certify module safety or quality.

## Appchain And Release Control Direction

Current decision:

```text
Do not rush to a public EVM testnet.
Do not rush to full public source release.
Use PVE private devnet first.
The long-term target is an OriginAgent self-operated private appchain.
The candidate technical directions are Cosmos EVM and EVM appchain frameworks.
Do not start by inventing a new consensus engine, VM, or P2P stack from scratch.
```

The release ladder should be:

```text
Local Anvil
  -> PVE Private Devnet
  -> PVE Private Appchain
  -> Closed Public Network
  -> Public Testnet Or Public Appchain
  -> Production Network
```

The PVE private devnet is the next practical network environment. It keeps tests inside the LAN while validating:

```text
Genesis Manifest verification
Endpoint Manifest updates
RPC / indexer / gateway / mirror endpoint discovery
artifact ingress envelope and receipt
content-addressed artifact distribution
work node identity and activity reports
abuse simulation across multiple machines
Contribution Points growth reward simulation
```

A private appchain is different from a PVE private devnet. A private appchain means OriginAgent operates its own underlying chain network with chain id, genesis, validator set, chain data, RPC failover, monitoring, backups, upgrade procedures, and key management. It should be implemented through Cosmos EVM or another EVM appchain framework after EC-15/EC-16 artifacts make node work measurable.

Public EVM testnet deployment is also different. In that model, another ecosystem operates the base chain and OriginAgent only deploys contracts. It can be useful later for adversarial public rehearsal, but it is not the target network architecture because it reduces release control and exposes contract addresses, bytecode, events, and public state to external users.

The official network identity must come from signed manifests and release history, not from source secrecy:

```text
Genesis Manifest
network_id
chain_id
deployment hash
root signer set
contract addresses
manifest signature threshold
official client defaults
signed releases
audit history
```

Another team may fork the code later, but it should not be recognized as the official OriginAgent network unless it has the official network identity.

## Contract Capability Map

Current deployment contains eight contracts:

```text
IdentityRegistry
AgentPassportRegistry
AgentReputationRegistry
EvolutionUnitKindRegistry
ModuleRegistry
VerificationRegistry
ScoreCommitReveal
ContributionPointsLedger
```

Capability by contract:

```text
IdentityRegistry:
  Registers address roles: Developer, Validator, Operator.
  Provides minimal role identity for validator qualification.

AgentPassportRegistry:
  Registers long-lived Agent Passport identity anchors.
  Computes passportId from owner, agentKeyHash, and genesisHash.
  Supports Agent key migration records.
  Does not prove natural-person uniqueness or wallet recovery.

ModuleRegistry:
  Registers module digests, module id hashes, version hashes, storage URIs, and submitters.
  Still uses legacy ModuleType enum: Skill, DomainPack, Workflow, Tool.
  Remains a compatibility layer.

VerificationRegistry:
  Stores verification reports and evidence records.
  Allows owner-managed validator profiles.
  Allows challenge submission and owner resolution.
  Maintains address-level testnetReputation for challenge flow.
  Does not create real Credit Deduction, staking, or economic finality.

ScoreCommitReveal:
  Provides commit/reveal scoring for module scores.
  Prevents direct score disclosure before reveal.

AgentReputationRegistry:
  Stores passive Passport-level reputation checkpoints.
  Does not auto-listen to challenge events.
  Does not replace address-level testnetReputation.

EvolutionUnitKindRegistry:
  Registers open capability kind definitions such as tool@1.
  Supports proposal, review hash, and status transitions.
  tool@1 maps to legacy ModuleType.Tool by audit convention, not by chain-level foreign key.

ContributionPointsLedger:
  Stores non-transferable Contribution Points accounting by passportId.
  Supports owner-only grantCredit and consumeCredit.
  Has no transfer, approve, allowance, withdraw, market, or ERC20 behavior.
  Does not enforce EC-13 trust gates on-chain; SDK and runner enforce them before broadcast.
```

## SDK And CLI Capability Map

The SDK and CLI can currently:

```text
validate proof bundles
prepare module submissions
dry-run and broadcast core contract calls
create and validate evidence reports
create and validate challenge records
summarize evidence and challenge outcomes
create and validate Agent Passport and migration records
create and validate memory vault public metadata artifacts
create and validate Agent reputation records and reports
checkpoint Passport reputation
create and validate unit kind proposal and review artifacts
propose unit kinds and set review/status
index chain events into JSONL
generate audit bundles
analyze adversarial abuse scenarios
evaluate trust policy gates
create and validate Contribution Points actions and reports
grant and consume Contribution Points through dry-run or broadcast
read module, evidence, challenge, Passport, reputation, unit kind, and Contribution Points chain state
```

Real broadcasting is opt-in through `EVOLUTION_CHAIN_RPC_URL`, `EVOLUTION_CHAIN_PRIVATE_KEY`, and `--broadcast`. Without `--broadcast`, transaction commands are dry-runs.

## Audit Coverage

`audit-bundle` can cross-check:

```text
evidence reports against EvidenceSubmitted events
challenge records against ChallengeSubmitted / ChallengeResolved / EvidenceInvalidated events
Agent Passport artifacts against AgentPassportRegistered events
migration artifacts against AgentPassportMigrationRecorded events
memory vault public metadata against Passport linkage
reputation reports against challenge source events and AgentReputationCheckpointed events
unit kind proposal/review artifacts against proposal, review, and status events
abuse reports against referenced public events/artifacts
trust policy reports through a compact trust_policy_summary
Contribution Points grant/consume actions against ContributionPointsGranted / ContributionPointsConsumed events
Contribution Points deny actions as denied=true and event_found=null
privacy scan rules across public artifacts
```

Privacy scan rejects sensitive keys or strings such as prompt, facts, raw telemetry, local paths, URL query strings, and secret-like values.

## Chain State Reads

`chain-state-check` can read:

```text
module existence
evidence status and evidence type
challenge status and resolution state
reporter/challenger identity and address-level testnetReputation
Passport owner, agentKeyHash, genesisHash, metadataHash, registration time, and migration count
Passport reputation checkpoint availability and values
Passport Contribution Points granted, consumed, balance, and operation count
unit kind availability, hashes, review hash, status, submitter, and timestamps
```

This makes `chain-state-check` the current operational diagnostic tool for a live Anvil deployment.

## What The Chain Can Do Now

The current system can:

```text
prove that a module digest was submitted
prove that public evidence was attached to a module
prove that a challenge was submitted and resolved
maintain sandbox-only address reputation for challenge outcomes
register an Agent Passport and migrate its Agent key hash
anchor encrypted memory vault public metadata without exposing plaintext
checkpoint Passport-level reputation from audited off-chain reports
register open evolution unit kind definitions
simulate and flag protocol abuse patterns before incentives
translate abuse signals into trust gate decisions
grant, consume, or deny non-transferable Contribution Points in a sandbox
produce reproducible audit artifacts from chain events and public reports
```

## What The Chain Cannot Do Yet

The current system cannot:

```text
issue real Points
run staking, Credit Deduction, rewards, ContributionPool, CreditPool, or DAO voting
run a real marketplace or settlement layer
publish production genesis/endpoint manifests
provide decentralized client network discovery
run public ingress gateways or artifact mirror discovery
pay nodes for uptime or contribution
identify node operators as first-class protocol subjects
prove long-term node uptime
account for community evaluation Validation Work or challenge Validation Work
prevent all Sybil attacks by itself
prove natural-person uniqueness
force EC-13 trust gates at contract level
bind open unit kinds to ModuleRegistry submissions through a contract-level foreign key
store private memory, prompts, facts, raw telemetry, local paths, keys, or decrypted vault contents
automatically punish abuse report subjects
certify uploaded content quality, security, or performance
operate as a public production network
```

These are intentional boundaries. EC-14 is a sandbox checkpoint, not an economic launch.

## Node Growth Design Implication

The next growth mechanism should not reward raw registration.

Unsafe model:

```text
register node -> receive Points over time
```

This would invite Sybil attacks, idle node farming, referral spam, and low-quality upload flooding.

Safer model:

```text
registered node -> eligible node identity
eligible node + formally valid / challenge-surviving / market-referenced work + low risk -> weighted share of an epoch reward pool
```

Recommended node identity direction:

```text
node_id = hash(passport_id, operator_address, node_public_key, nonce)
```

The `node_id` should act as a contribution account, not as a transferable asset, invitation code, or permanent rent stream.

Node value should come from:

```text
stable uptime
valid indexed events
formally valid community evaluation claims
valid audit bundles
challenge-surviving unit kind reviews
valid module/evolution contribution routing
low abuse risk from EC-12
eligible trust gate from EC-13
Passport reputation from EC-10
diversity against owner/operator/runner clustering
```

Node value should not come from:

```text
registration alone
early-number scarcity alone
multi-level referrals
permanent upload tax
raw upload count
raw Passport count
raw address count
```

## Candidate Next Direction

Before real rewards or marketplace settlement, the next phase should not jump straight to paying nodes. It should first make network bootstrap and community work measurable.

One candidate shape is:

```text
Candidate: Network Bootstrap / Work Node Registry / Growth Reward Simulator
```

Primary questions:

```text
How does a client discover the network without depending on one official domain?
What split between genesis manifest and endpoint manifest prevents endpoint updates from changing network identity?
How are artifact gateway and mirror receipts represented?
Who is a node?
What public node activity is formally valid, challenge-surviving, market-referenced, or adoption-correlated?
How does a node prove uptime without leaking private data?
How are community evaluation claims recorded without making official infrastructure a quality certifier?
How do EC-12 abuse reports and EC-13 trust gates cap or block node rewards?
How does EC-10 Passport reputation influence node weight without becoming a single-point oracle?
How does the epoch reward pool make average rewards decrease as active nodes increase?
How do we prevent upload routing attribution from becoming referral farming?
```

Proposed v1 economic shape:

```text
epoch_reward_pool = fixed_or_decaying_pool(epoch)

node_reward_i =
  epoch_reward_pool
  * node_weight_i
  / sum(active_node_weights)
```

The reward should initially be Contribution Points only. Real Points, marketplace settlement, staking, Credit Deduction, and DAO voting should remain later phases.

## Candidate Guardrails

The next candidate phase should preserve these guardrails:

```text
do not launch real Points emissions
do not reward registration alone
do not make node_id transferable
do not introduce multi-level referrals
do not grant permanent upload royalties
do not treat Contribution Points as money
do not bypass EC-12 and EC-13 gates
do not let one owner/operator group/runner fingerprint dominate rewards
```

The first implementation should simulate many nodes and attack patterns before writing a real reward mechanism.
