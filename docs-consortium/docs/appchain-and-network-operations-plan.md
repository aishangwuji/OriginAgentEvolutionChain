# OriginAgent Appchain And Network Operations Plan

Date: 2026-05-24

## Purpose

This document fixes the current interpretation of "self-built appchain" for OriginAgent.

The key decision:

```text
OriginAgent's long-term network target is a self-operated private appchain.
OriginAgent should build and operate its own underlying chain network, including chain identity, genesis, validator set, RPC, indexer, gateway, artifact mirror, manifest signing, monitoring, backup, and upgrade operations.
The candidate technical directions are Cosmos EVM and EVM appchain frameworks.
This does not mean inventing a new consensus engine, VM, or peer-to-peer stack from scratch before the protocol is proven.
Before the private appchain is launched, OriginAgent should run a controlled PVE private devnet inside the local network.
```

This plan protects release control while the protocol is still changing. It also separates three concepts that are easy to confuse:

```text
PVE private devnet:
  A controlled local-network test environment for OriginAgent contracts, endpoints, nodes, artifact mirrors, and clients.

Private appchain:
  The target self-operated OriginAgent underlying chain network.
  It should be private or permissioned at first and may be implemented with Cosmos EVM or another EVM appchain framework.

Public EVM testnet:
  A Consortium Chain operated by an external ecosystem, where OriginAgent only deploys contracts.
  This is a rehearsal option, not the target network architecture.
```

## What "Self-Built Appchain" Means

The safe meaning:

```text
Build and operate an OriginAgent-controlled private appchain.
Own the chain id, genesis, validator set, RPC endpoints, manifest signer policy, deployment manifest, and operations runbooks.
Use Cosmos EVM or another mature EVM appchain framework as the candidate implementation base.
Configure an OriginAgent-specific chain id, genesis, validator set, RPC endpoints, and deployment manifest.
Deploy OriginAgent Evolution Chain contracts onto that chain.
Run OriginAgent indexer, gateway, artifact mirror, and work-node services around it.
```

The unsafe meaning:

```text
Write a new consensus engine before a mature framework has been evaluated.
Write a new VM before the EVM-compatible route has been exhausted.
Write a new peer-to-peer blockchain stack before protocol demand justifies it.
Create a new Points economy before abuse testing.
Let node registration alone create economic value.
```

The current direction is the safe meaning only.

Candidate private appchain technical directions:

```text
Cosmos EVM direction:
  Cosmos SDK based appchain with EVM compatibility.
  Candidate family includes Ethermint / Evmos-style EVM modules or equivalent Cosmos EVM stacks.

EVM appchain direction:
  Appchain frameworks that preserve Solidity/EVM compatibility and allow OriginAgent-controlled chain identity and operations.
  Candidate family includes Polygon CDK, Arbitrum Orbit, OP Stack, Hyperledger Besu QBFT/IBFT, Nethermind private PoA/QBFT style deployments, or comparable mature EVM-compatible stacks.
```

For the next stage, Anvil and a PVE private devnet are still enough for fast local and scripted validation. The private appchain is the target, but its framework should be selected after Genesis Manifest, Endpoint Manifest, artifact ingress, work-node identity, node activity reports, and reward simulation are defined and testable.

## Why Operations And Security Cost Increase

On a public EVM testnet, another ecosystem operates the underlying chain. OriginAgent deploys contracts, but does not run the chain itself.

On a self-operated appchain, OriginAgent becomes responsible for the chain environment:

```text
chain framework selection
chain id and genesis
validator set design and key management
validator availability
block production
chain fork handling
RPC uptime and rate limits
endpoint discovery
indexer lag
artifact mirror availability
gateway relay behavior
node key security
owner / deployer / manifest signer key security
chain data backup and restore
monitoring and alerting
software upgrades
emergency rollback or pause procedures
abuse controls for spam transactions and low-value artifacts
```

This is why appchain control is stronger but operational cost is higher.

The project should therefore separate two engineering tracks:

```text
EvolutionChain protocol:
  contracts, SDK, CLI, schemas, audit-bundle, artifact formats, and EC runners.

OriginAgentNetwork / private appchain operations:
  Cosmos EVM or EVM appchain framework evaluation, genesis, validator nodes, RPC/indexer/gateway/mirror services, manifests, monitoring, backup, upgrade, and node onboarding.
```

## Release And Control Ladder

OriginAgent should move through network exposure in this order:

```text
1. Local Anvil
2. PVE Private Devnet
3. PVE Private Appchain
4. Closed Public Network
5. Public Testnet Or Public Appchain
6. Production Network
```

### 1. Local Anvil

Purpose:

```text
Fast contract, SDK, CLI, runner, and audit-bundle development.
Disposable chain state.
Single-machine testing.
```

Current EC-5 to EC-14 runners already use this style.

### 2. PVE Private Devnet

Purpose:

```text
Keep all tests inside the LAN.
Preserve source, deployment, and network control.
Validate client discovery, endpoint manifests, artifact distribution, gateway receipts, indexers, and work-node reports.
Simulate attackers and community work nodes without public exposure.
```

Suggested first topology:

```text
vm-chain-01:
  Anvil or single-node EVM dev chain.

vm-rpc-01:
  RPC endpoint and health checks.

vm-indexer-01:
  index-events / query service.

vm-gateway-01:
  ingress gateway / relayer prototype.

vm-artifact-01:
  object storage, OCI registry, or static artifact mirror.

vm-client-01:
  OriginAgent client simulation.

vm-worker-01:
  evaluator / audit / challenge worker.

vm-worker-02:
  adversarial worker for spam, typo, tamper, and Sybil simulation.

vm-monitor-01:
  logs, metrics, endpoint checks, backup checks.
```

The 10 Ubuntu VMs on PVE are useful for this stage, but they should be connected after the minimal protocol objects exist:

```text
Genesis Manifest
Endpoint Manifest
ArtifactIngressEnvelope
IngressReceipt
WorkNodeProfile
NodeActivityReport
GrowthRewardSimulationReport
```

Without these objects, 10 VMs only create machines, not a measurable OriginAgent network.

### 3. PVE Private Appchain

Purpose:

```text
Replace single-node Anvil with the target self-operated private appchain candidate.
Test validator node availability, peer discovery, block production, RPC failover, chain data backup, and indexer recovery.
Still keep the network private.
```

This phase should prove:

```text
Cosmos EVM or EVM appchain framework can support the OriginAgent contract and event surface
multiple chain nodes can stay synchronized
RPC endpoints can fail over
indexers can recover from downtime
artifact mirrors can serve the same digest from different sources
clients can verify manifests and switch endpoints
contract deployments are reproducible from genesis/deployment manifests
```

### 4. Closed Public Network

Purpose:

```text
Invite selected external developers or validators.
Expose controlled endpoints.
Keep root signing, source release, and deployment identity under OriginAgent control.
Use Contribution Points only.
```

This is the first stage where external people may participate, but the network is still not a Permissioned public launch.

### 5. Public Testnet Or Public Appchain

Purpose:

```text
Allow broader community testing with fake value.
Publish official Genesis Manifest and Endpoint Manifest.
Publish SDK and node setup instructions.
Expect spam, invalid artifacts, challenge abuse, endpoint probing, and fork attempts.
```

Public testnet does not mean production. It is an adversarial public rehearsal. The target remains an OriginAgent-controlled private appchain unless a later governance and operations decision explicitly changes that target.

### 6. Production Network

Purpose:

```text
Only after contract audits, manifest signing policy, node operations, artifact distribution, abuse gates, reward calibration, and governance runbooks are stable.
```

This is the only stage where real Points, staking, Credit Deduction, marketplace settlement, DAO, or production appchain governance may be reconsidered.

## Network Identity And Fork Control

Open source code can be copied. Official network identity must not depend on secrecy of source code.

Official network identity should come from:

```text
official Genesis Manifest
network_id
chain_id
root contract addresses
deployment hash
root signer set
manifest signature threshold
official client default configuration
official documentation and release signatures
public audit history
community recognition
```

Another party may fork the code and deploy another network. That network should have a different:

```text
network_id
chain_id
genesis deployment hash
contract addresses
manifest signer set
history
```

The OriginAgent client should not trust a random compatible deployment as the official network. It should verify the Genesis Manifest before treating any endpoint as OriginAgent's canonical network.

## Source Release Control

The current source-release policy should stay conservative:

```text
Do not publish all source, deployment scripts, public manifests, and endpoint addresses before the network identity model is complete.
Do not publish a public testnet before the client can verify the Genesis Manifest.
Do not treat obscurity as long-term security.
Do use private devnet and closed testing while the protocol is still changing.
```

When public release is chosen, the defensible position is:

```text
contracts are open and verifiable
SDK and node software are reproducible
release artifacts are signed
official network identity is manifest-based
secrets, deployer keys, validator keys, and private endpoint credentials are never committed
```

## Required Projects And Components

Current projects:

```text
OriginAgent client:
  Local Agent runtime, local evolution modules, proof bundle export, local privacy boundary.

OriginAgentEvolutionChain:
  Contracts, SDK, CLI, schemas, audit-bundle, EC runners, protocol docs.
```

Because OriginAgent is moving toward PVE devnet and private appchain operation, at least one additional project or package will be needed:

```text
OriginAgentNetwork:
  PVE devnet configuration.
  Cosmos EVM / EVM appchain framework evaluation notes.
  private appchain genesis and validator node configuration.
  Docker Compose or systemd deployment recipes.
  endpoint manifest generation.
  gateway / indexer / artifact mirror prototypes.
  monitoring and backup runbooks.
  node onboarding runbooks.
```

This can start as a single repository. It should split later only if the operational code becomes too large.

## Minimal Services Before The Private Appchain

Before launching the private appchain, these services or artifacts should exist:

```text
Genesis Manifest:
  Locks the network identity.

Endpoint Manifest:
  Lists RPC, indexer, gateway, and artifact mirror endpoints.

Artifact Ingress:
  Accepts a signed upload envelope and returns an ingress receipt.

Artifact Mirror:
  Serves content-addressed artifacts and supports digest verification.

Indexer:
  Reads chain events and exposes queryable public state.

Work Node Profile:
  Identifies OriginAgent protocol work nodes, not base-chain consensus nodes.

Node Activity Report:
  Reports measurable work such as indexed events, valid reports, audit bundles, uptime summary hash, and routing receipts.

Growth Reward Simulation Report:
  Simulates Contribution Points distribution and anti-Sybil caps without real Points emission.
```

## EC-15 Implication

EC-15 should not be "deploy the final appchain".

EC-15 should be:

```text
Network Bootstrap / Work Node Registry / Growth Reward Simulator
```

The implementation target should be compatible with:

```text
single-machine Anvil
PVE private devnet
the future OriginAgent private appchain
```

EC-15 should prepare the private-devnet objects that make 10 Ubuntu VMs meaningful:

```text
manifest verification
endpoint discovery
ingress envelope and receipt
work node identity
node activity report
Contribution Points growth reward simulation
audit-bundle linkage
```

Only after EC-15 and EC-16 should PVE 10-VM testing become the main validation stage.

Private appchain framework selection should follow measurable protocol readiness, not precede it. EC-15/EC-16 should produce the objects that let Cosmos EVM or EVM appchain candidates be compared with real OriginAgent workloads.

## Non-Goals

The current appchain direction does not mean:

```text
immediate public EVM testnet deployment
immediate production private appchain launch
immediate full open-source release
real Points emission
staking
Credit Deduction
DAO governance
marketplace settlement
rewriting EVM, consensus, or P2P stack from scratch as the first appchain implementation
forcing the OriginAgent client to require chain access
making OriginAgent official infrastructure a content quality bureau
```

## Decision Summary

```text
The long-term target is an OriginAgent self-operated private appchain.
The technical direction candidates are Cosmos EVM and EVM appchain frameworks.
Use PVE private devnet first.
Keep all early network tests inside the LAN.
Design appchain compatibility now, but select and launch the private appchain framework only after network bootstrap and node-work artifacts exist.
Do not start by writing a new consensus engine, VM, or P2P stack from scratch.
Keep public testnet, public source release, real Points, staking, Credit Deduction, DAO, and marketplace settlement after the private network model is proven.
```
