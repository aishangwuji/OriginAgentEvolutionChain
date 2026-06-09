# EC-8 Note: Agent Passport, Encrypted Memory, Reputation, And Token Economy

Date: 2026-05-23

## Summary

After EC-7, the next major product direction is no longer just "module evidence can be verified by multiple nodes." A larger direction is emerging:

```text
An Agent should have a long-lived identity, portable encrypted memory, non-transferable reputation, and eventually token-mediated economic activity.
```

This note records the architectural decision so the project does not later collapse identity, memory, reputation, and token incentives into one unsafe mechanism. The EC-8 implementation now covers the Agent Passport identity anchor only; encrypted memory, reputation, and token economics remain later phases.

## Core Decision

Each long-lived Agent may have an on-chain identity, but that identity is a public anchor, not the memory encryption secret.

The preferred concept name is:

```text
Agent Passport
```

It is closer to a lifecycle passport than a raw ID card. It should represent:

```text
who the Agent is
who controls it
which public lifecycle facts it has accumulated
which modules it has installed
which public contributions it has made
which reputation signals it has earned
where its encrypted memory vault root is anchored
how it has migrated across devices or servers
```

It should not be treated as the community contribution subject.

```text
responsibleAddress = human / company / Developer / Validator / Operator wallet that carries responsibility
agentPassportId = Agent execution identity that may have performed the work
```

Rewards, penalties, role admission, sponsorship liability, future bonds, and governance responsibility should attach first to `responsibleAddress`. `AgentPassport` should provide execution provenance, lifecycle continuity, migration history, Agent-scoped reputation signals, and trust-policy input.

Developers and validators should not be forced to use only the OriginAgent client. Valid work may be produced through the OriginAgent client, CLI, CI bot, validator runner, or sandbox test Agent. Unknown upgrade modules should be tested in clean runners or sandboxes before any production Agent installs them.

## Memory Model

Agent memory must not be written to chain, even when encrypted.

The safer model is:

```text
chain:
  public Agent identity
  encrypted memory root hash
  encrypted memory blob URI / storage commitment
  memory version
  migration event hash
  access policy hash

off-chain memory vault:
  encrypted memory snapshots
  encrypted incremental segments
  optional encrypted indexes
  recovery metadata
```

The public Agent identity must not directly encrypt or decrypt memory. A public identifier is visible to everyone and cannot be a secret.

Preferred key hierarchy:

```text
Agent Passport:
  public identity anchor

Agent local private key:
  proves control of the Agent Passport
  signs migration and memory-root updates

Memory encryption key:
  encrypts local memory snapshots / segments
  is wrapped by owner-controlled recovery keys
  is never published on-chain
```

If the owner loses the relevant private key or recovery material, the encrypted memory should be unrecoverable. That is an intentional security property, but it requires future recovery UX such as seed backup, hardware key, multi-device recovery, or social recovery.

## Owner And Sybil Boundary

The system should not try to make "one natural person equals one Agent" a hard chain-level rule.

Reasons:

```text
one person may legitimately run multiple Agents
pure smart contracts cannot reliably identify natural persons
one-Agent-per-person rules are easy to bypass and hard to enforce fairly
```

Instead:

```text
Agent creation can be open.
New Agents start with low trust and no automatic economic weight.
Rewards and influence come from contribution, history, and anti-sybil signals.
Multiple Agents controlled by the same operator should face diminishing returns for rewards and validation weight.
```

The goal is not to prevent multiple Agents. The goal is to prevent multiple low-effort Agents from multiplying rewards, validation power, or governance weight.

Current EC-8 implementation does not limit the number of Passports that one owner can register. This is a known future risk if Agent Passport is later connected to work weight, Test Credit weight, validator weight, or rewards.

Future v2 direction:

```text
max_active_passports_per_formal_subject = 3
passport_status = Active / Retired / Revoked
active_passport_count = active Passports controlled by one formally admitted subject
retire_agent_passport = retire a Passport without deleting history
extra_agent_quota = explicitly approved extra Agent capacity
```

This quota should apply to formally admitted Developer / Validator / Operator subjects, not arbitrary wallet addresses. One formal subject normally gets enough room for:

```text
primary Agent
validation / testing Agent
sandbox / experimental Agent
```

Historical Passports must remain auditable. Retired Passports should not keep earning work weight, Test Credit weight, or reward eligibility.

## Reputation And Token Separation

Reputation and token must remain separate.

```text
Reputation:
  non-transferable
  earned from contribution and accuracy
  used for trust, rank, validator weight, and market confidence

Token:
  transferable
  used for payments, fees, staking, rewards, storage, and market activity
```

Buying tokens should not buy reputation. Otherwise the protocol becomes capital-weighted instead of contribution-weighted.

Reputation sources may include:

```text
high-quality module submissions
validator reports that later remain unchallenged
successful challenges
accurate security reports
long-term low-failure module operation
real adoption evidence
documentation / test / audit contributions
stable validator uptime
```

Reputation penalties may include:

```text
invalidated evidence
failed malicious or low-quality challenges
repeated low-quality module submissions
operator-group correlation abuse
attempted privacy leakage in artifacts
```

## Token Economy Guardrails

Do not give every registered Agent a fixed daily token reward merely for existing. That creates an immediate sybil faucet.

Safer early model:

```text
no automatic reward for registration
reward active contribution
cap or decay rewards for correlated Agents
make high rewards depend on reputation, challenge history, and contribution quality
keep all of this testnet-only until real abuse data exists
```

Possible token uses:

```text
buy module packages
pay validation fees
pay encrypted memory storage fees
post challenge bonds
pay marketplace fees
reward module authors
reward validators
reward successful security challengers
pay premium Agent-to-Agent services
```

Possible token sinks:

```text
module purchases
market fees
storage fees
challenge failures
expired resource reservations
optional burn mechanics
```

## Module Pricing

Do not start with complex community pricing or auctions.

Recommended early model:

```text
module author sets a price
protocol takes a small fee
validators may receive a verification share
buyers pay for usage or installation rights
high-risk modules may require longer challenge windows or higher bonds
```

Community voting, auctions, bonding curves, or DAO-negotiated prices can be tested later after the market has real activity.

## Suggested Roadmap

```text
EC-8:
  Agent Passport identity anchor implemented.
  Defines owner, Agent key hash, genesis hash, lifecycle events, and migration semantics.
  No memory vault and no token.

EC-9:
  Encrypted Memory Vault prototype.
  Store encrypted memory off-chain and anchor memory roots on-chain or in audit artifacts.
  Demonstrate cross-machine Agent restore.

EC-10:
  Agent Reputation.
  Convert contribution, validation, challenge, and adoption history into non-transferable reputation.
  No real token.

EC-11:
  Test credit and module market MVP.
  Use test credits for module purchases, validation fees, and challenge bonds.
  Keep all economics testnet-only.

EC-12:
  Network abuse and anti-sybil experiment.
  Current route correction: validate first inside PVE Private Devnet and then the OriginAgent self-operated private appchain path.
  Public EVM testnet can be a later adversarial rehearsal option, not the target network architecture.

EC-13+:
  Only after real abuse data: consider real token, staking, rewards, DAO, and richer marketplace governance.
```

## Hard Boundaries

```text
Do not put raw memory on-chain.
Do not use public Agent identity as an encryption secret.
Do not pay Agents merely for registering.
Do not make transferable token balance equal trust.
Do not let OriginAgent require chain access to run locally.
Do not introduce real-token economics before PVE private devnet / private appchain abuse data and operations data exist.
```

## Open Questions

```text
Should one owner identity be explicit on-chain, or should owner linkage be selectively disclosed?
What recovery model is acceptable for non-technical users?
Should memory vault storage be first-party, user-selected, or decentralized from the beginning?
How should correlated Agents be detected without collecting private telemetry?
Which reputation signals are strong enough to affect validator weight?
When should module purchases be per-install, per-use, subscription, or patronage?
```

## Current Conclusion

The idea is strategically valuable, but it should be introduced as a staged identity and portability track rather than as an immediate token faucet or memory-on-chain design.

The stable direction is:

```text
Agent Passport on-chain.
Encrypted memory off-chain.
Chain stores roots and lifecycle proofs.
Reputation is non-transferable.
Token is transferable but rewards contribution, not existence.
Multiple Agents are allowed, but correlated Agents cannot multiply trust or emissions.
```
