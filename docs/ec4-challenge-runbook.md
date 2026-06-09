# EC-4 Challenge Validation Runbook

EC-4 turns EC-3 evidence into a testnet-only challenge workflow. It does not add token rewards, slashable stake, DAO voting, or mainnet reputation.

Run the local validation script:

```bash
bash scripts/run-ec4-challenge-validation.sh
```

The script performs:

```text
npm test
verify-proof
submit-tool-module --dry-run
create-external-validator-artifact
create-evidence-report
submit-validator-report --dry-run
create-challenge-record
submit-challenge --dry-run
resolve-challenge --dry-run
challenge-summary
evidence-summary --challenge-summary
```

Default outputs are written under `out/ec4-challenge-validation/`.

Audit files to keep:

```text
external-validator-artifact.json
evidence-report.json
challenge-record.json
challenge-summary.json
evidence-summary.json
```

The generated challenge record uses:

```text
challenge_id = keccak256(abi.encode(evidence_id, challenger, reason_hash))
```

The challenge summary invalidates upheld evidence and applies EC-4 testnet reputation deltas. `evidence-summary --challenge-summary` then removes invalidated evidence and blocks active reports from reporters with reputation `<= -10`.

External validation can reuse the EC-3 SSH runner channel:

```powershell
ssh -i $env:USERPROFILE\.ssh\originagent_ec3_validator root@47.84.130.213 "uname -a"
```

On the remote machine, run the same script from a clean checkout or uploaded project copy. Fixture-only challenge records are for automated regression; they do not replace the external runner evidence.
