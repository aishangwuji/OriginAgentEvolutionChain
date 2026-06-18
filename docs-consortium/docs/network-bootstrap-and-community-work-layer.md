# OriginAgent Network Bootstrap and Community Work Layer

Date: 2026-05-24

## Purpose

This note records the post-EC-14 network architecture discussion that must be settled before designing real node rewards or marketplace settlement.

The appchain, private devnet, and release-control route is recorded separately in:

```text
docs/appchain-and-network-operations-plan.md
```

The key conclusion is:

```text
OriginAgent official infrastructure may provide default entry points, but it must not become the only protocol entry point.

OriginAgent does not certify uploaded content.
OriginAgent records claims, hashes, reports, challenges, adoption signals, and reward/accounting anchors.
Quality is discovered by community evaluation, adversarial challenge, and market adoption.
```

## Network Discovery Is Bootstrap, Not Authority

A public network manifest is useful, but it must not be a central control point.

Unsafe model:

```text
client must always call originagent.example
originagent.example returns the only RPC/indexer/gateway list
all uploads and downloads depend on official servers
```

Target model:

```text
domain = convenient discovery transport
genesis manifest = network identity authority
signed endpoint manifest = updateable endpoint metadata
chain state = final audit anchor
artifact hash = content authority
local cache = short-term outage resistance
community mirrors = alternative discovery and distribution paths
```

The public manifest can live at a path such as:

```text
https://network.originagent.example/.well-known/originagent-network.json
```

But this is only one discovery source. Clients should be able to load the same signed manifest from:

```text
official HTTPS domain
GitHub or release mirror
IPFS CID
Arweave transaction
community mirror URL
known peer response
local file import
bundled genesis manifest
```

If the official domain is down, old clients should keep using cached endpoints and new clients should still support manual manifest import.

## Genesis And Endpoint Manifests

The manifest model should split immutable network identity from mutable endpoint discovery.

`Genesis Manifest` locks the network identity:

```text
network_id
chain_id
genesis deployment hash
root contract addresses
root manifest signer set
manifest signature threshold
client compatibility floor
genesis manifest hash
```

Clients may bundle the genesis manifest hash or root signer set. A later endpoint update must not silently replace these fields.

`Endpoint Manifest` describes how a client reaches the public network:

```text
network_id
chain_id
deployment contract addresses
contract code hashes or deployment hash
RPC endpoints
indexer endpoints
ingress gateway endpoints
artifact gateway / mirror endpoints
manifest version
updated_at / expires_at
signing key id
signature
```

The client must not trust the domain alone. It should verify:

```text
manifest signature
network_id
chain_id
contract addresses
contract code hashes where available
manifest version monotonicity
expiry window
endpoint health
```

For v1, a single foundation signature may be acceptable for a sandbox network. Before public production use, endpoint manifests should move to threshold signing, for example `m-of-n` manifest signers. Clients should reject silent root key replacement unless it is authorized by the genesis manifest's rotation policy.

The client should keep the latest valid manifest in local cache and use multiple endpoints when possible.

## Public Endpoint Roles

OriginAgent network access should be split by role:

```text
RPC endpoint:
  Reads chain state and broadcasts signed transactions.

Indexer endpoint:
  Serves searchable views of chain events and public artifacts.
  It is a cache/query layer, not final authority.

Ingress / Gateway endpoint:
  Accepts public artifact envelopes, computes or checks hashes, stores content, returns receipts, and may relay Consortium Chain anchors.
  It does not certify quality, security, performance, or usefulness.

Artifact gateway / mirror:
  Serves content-addressed evolution bodies, reports, schemas, manifests, and review artifacts.
```

The client should be able to use official endpoints, community endpoints, private endpoints, or manually configured endpoints.

## Submitter And Relayer Boundary

Ingress gateways must not become hidden owners of submitted artifacts.

The upload envelope should be signed by the original submitter:

```text
submitter_passport_id
submitter_address
artifact_digest
artifact_kind
storage_uri
nonce
created_at
submitter_signature
```

If a gateway relays the chain transaction, the chain or report should still distinguish:

```text
submitter = the actor who signs and owns the claim
relayer = the gateway or account that paid gas or forwarded the anchor
ingress_node_id = optional attribution for routing work
```

Gateway receipts should include a replay-resistant nonce and the received artifact digest. Routing attribution can earn limited credit only if the artifact and report survive protocol checks and challenge windows; it must not create permanent upload rent.

## Protocol Integrity, Not Official Testing

OriginAgent-controlled chain, client, gateway, and artifact-body infrastructure should not be responsible for testing uploaded content quality.

They may enforce protocol integrity:

```text
schema envelope is parseable
declared digest matches bytes
signature is valid
submitter identity is known
storage URI is recorded
chain anchor matches report hash
public artifact does not claim private data as public proof material
privacy / secret scan rejects forbidden public artifact content
```

They should not claim:

```text
this module is safe
this module is high quality
this module is performant
this module should be installed
this score is final
```

Those claims belong to open community reports, challenges, and market signals.

Privacy scan and secret scan are protocol hygiene, not content quality certification. A gateway or SDK may reject prompt, facts, raw telemetry, local paths, URL queries, private keys, API keys, or secret-like values in public artifacts. That rejection does not mean the module is otherwise safe or high quality.

## Body / Artifact Distribution

The body layer should be content-addressed. Download source is not trusted; digest verification is trusted.

Early distribution can be hybrid:

```text
official object storage or CDN for default availability
OCI registry for package-like artifacts
Git release storage for reproducible release bundles
community artifact mirrors
IPFS / content-addressed P2P as optional path
Arweave or other archival storage for important historical artifacts
developer self-hosted URLs
enterprise or local-network mirrors
```

Pure P2P should not be required at the beginning because NAT, uptime, moderation, and performance costs are high. P2P can become an additional route after digest verification, mirror receipts, and abuse controls exist.

## Community Work Layer

The community work layer is not an official quality bureau. It is an open production layer where people and Agents perform useful network work.

Examples:

```text
Builder Agent:
  creates modules, upgrade packages, workflows, planner policies, tools, and schemas.

Evaluator Agent:
  tests installation, compatibility, benchmarks, regression behavior, and local adoption outcomes.

Security Agent:
  looks for permission overreach, malicious behavior, unsafe dependencies, or sandbox escape attempts.

Stress Agent:
  runs load, resource, soak, and failure-mode experiments.

Challenger Agent:
  challenges fake reports, low-quality scores, copied reports, forged benchmarks, and suspicious claims.

Curator Agent:
  builds rankings, risk lists, topic indexes, and market-facing recommendation views.

Adoption Agent:
  reports adoption, rollback, failure, and long-term use signals from controlled environments.
```

These roles can be run by humans, companies, community nodes, or specialized Agents. Their outputs are not final truth; they are signed claims that can be reused, challenged, and weighted.

## Evaluation Validation Work

Community validation can become a new Validation Work form:

```text
Proof of Useful Evaluation
Proof of Useful Challenge
Proof of Useful Distribution
Proof of Useful Adoption Signal
```

In the current design stage, these Validation Work terms refer to Contribution Points accounting or simulation only. They are not real Points emissions, staking rewards, marketplace settlement, or Credit Deductionable economic finality.

The reward target must not be raw activity count.

Do not reward:

```text
number of reports alone
number of scores alone
number of registered nodes
number of uploaded artifacts
referrals
permanent upload rent
copying someone else's report
low-information spam reports
```

Reward signals should prefer:

```text
reproducible evidence
independent environment coverage
challenge-surviving claims
novel risk discovery
long-term agreement with adoption or rollback outcomes
useful artifact availability
valid event indexing
valid report-to-chain linkage
low conflict of interest
diverse owner/operator/runner fingerprints
```

This makes validation a competitive market instead of an official maintenance burden.

## Claim, Challenge, And Market Discovery

Reports should be treated as claims, not final scores.

Examples:

```text
I claim this artifact installs under environment hash X.
I claim this module exceeded resource threshold Y.
I claim this permission model is stricter than the artifact behavior.
I claim this benchmark delta is reproducible with method hash Z.
I claim this report is copied, forged, or low-information.
```

The chain should anchor:

```text
claimant identity
artifact digest
method hash
environment hash
result hash
report hash
challenge hash
challenge outcome
reward/accounting anchor
```

The chain should not become the judge of absolute module quality. Clients, marketplaces, curators, and users can combine reports, challenge history, adoption history, and local policy to decide what to install or rank.

## Design Guardrails

```text
Official infrastructure is allowed to bootstrap the network, but not to be the only entry point.
Official infrastructure does not certify content quality.
Gateway work is envelope/hash/receipt work, not quality testing.
Artifact source is not trusted; artifact digest is trusted.
Indexer output is not trusted; chain events and report hashes are the audit source.
Community reports are claims, not final truth.
Rewards should pay formally valid, challenge-surviving, market-referenced, or adoption-correlated contribution, not busy work.
Client privacy boundaries remain local and must not be weakened by community validation.
```
