# EC-9 Memory Vault Validation Result

Date: 2026-05-23

## Scope

EC-9 implements encrypted memory vault export/inspect/verify/import in `OriginAgentclient` and public memory-vault linkage in `OriginAgentEvolutionChain` audit bundles.

No contract was added. No Anvil broadcast is required for EC-9.

## Local Validation

Client targeted tests:

```text
D:\Demo\OpenHome\OriginAgentclient\.venv\Scripts\python.exe -m pytest tests\evolution\test_memory_vault.py
7 passed
```

Chain SDK tests:

```text
npm test
68 passed
```

Local EC-9 runner:

```text
bash scripts/run-ec9-memory-vault-restore-flow.sh
not run locally: Windows bash resolves to WSL launcher, and WSL is not installed in this environment.
```

Remote validation on `154.40.59.232`:

```text
OriginAgentclient tests/evolution/test_memory_vault.py: 7 passed
OriginAgentEvolutionChain npm test: 68 passed
CLIENT_ROOT=/root/originagent-ec9-remote/OriginAgentclient bash scripts/run-ec9-memory-vault-restore-flow.sh: passed
```

## Verified Behavior

Client tests cover:

```text
export writes only allowlisted memory files into encrypted payload
history/session/provider/private-key material stays out of the vault
key-file content is not embedded in the vault
metadata, ciphertext, and digest tampering are rejected
wrong key fails before target workspace writes
import defaults to dry-run
--apply writes restored files
conflicts fail by default
--replace overwrites only vault paths and preserves unrelated target files
broken source ledger blocks export
public privacy scan rejects forbidden metadata
Typer CLI export / verify / import works end to end
```

Chain tests cover:

```text
audit-bundle --memory-vaults happy path ok=true
memory_vault_linkage artifact_valid=true
memory_vault_linkage passport_linked=true
tampered passport_id rejected
tampered agent_key_hash rejected
tampered vault_digest rejected
tampered encrypted_payload_digest rejected
private public metadata makes privacy_scan.ok=false
old EC-5 through EC-8 audit-bundle tests still pass without --memory-vaults
```

## Output Artifacts

The EC-9 runner writes local artifacts under:

```text
out/ec9-memory-vault-restore-flow/
```

These artifacts are not committed.

Expected final artifacts:

```text
memory-vault.json
agent-passport-record.json
agent-migration-record.json
events.jsonl
audit-bundle.json
import-memory-vault-dry-run.json
import-memory-vault-apply.json
```

## Remote Validation

Remote Ubuntu validation completed on `154.40.59.232`:

```text
output: /root/originagent-ec9-remote/OriginAgentEvolutionChain/out/ec9-memory-vault-restore-flow
audit-bundle.ok=true
privacy_scan.ok=true
events.total=2
agent_passport_linkage[0].artifact_matched=true
agent_migration_linkage[0].artifact_matched=true
agent_migration_linkage[0].migration_index=1
memory_vault_linkage[0].artifact_valid=true
memory_vault_linkage[0].passport_linked=true
```

`47.84.130.213` is suitable only for smoke checks due to its small memory profile.
