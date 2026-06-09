# EC-1 Boundaries

OriginAgentEvolutionChain EC-1 is a chain-side proof and registry foundation. It does not alter the OriginAgent client runtime and does not require the client to be online or chain-connected.

## In Scope

- Validate exported OriginAgent proof bundles.
- Prepare public hashes for EVM contract submission.
- Register identity, module, verification report, and blinded score facts in Solidity.
- Preserve privacy by rejecting private fields before submission.

## Out of Scope

- Real token issuance, staking, rewards, slashing, DAO governance, marketplace indexing, validator networking, and appchain evaluation.
- Uploading artifacts to OCI/IPFS/Arweave.
- Executing third-party module code.
- Reading OriginAgent local memory or telemetry files directly.

## Public Chain Data

Allowed chain-side data is limited to module digest, module id hash, version hash, module type, storage URI, proof bundle hash, verification report hash, capability snapshot hash, telemetry digest, identity metadata hash, and score commit/reveal hashes.

Raw prompts, file contents, facts text, full tracebacks, local absolute paths, URL query strings, raw tool outputs, hidden reasoning, and private telemetry are forbidden.
