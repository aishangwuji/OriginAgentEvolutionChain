import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getAddress, type Address, type Hex } from "viem";
import {
  computeVerdictCommitmentHash,
  createValidatorVerdictCommitment,
  createValidatorVerdictReveal,
  type ValidatorVerdictCommitment,
  type ValidatorVerdictReveal,
} from "./adjudication.ts";
import { toBytes32 } from "./canonical.ts";

export type VerdictCommitmentStatus =
  | "pending_commit"
  | "committed"
  | "reveal_pending"
  | "revealed"
  | "expired"
  | "archived";

export interface VaultVerdictCommitment {
  challenge_id: Hex;
  validator: Address;
  claimed_upheld: boolean;
  verdict_hash: Hex;
  method_hash: Hex;
  salt: Hex;
  commitment_hash: Hex;
  status: VerdictCommitmentStatus;
  created_at: string;
  updated_at: string;
  commit_tx_hash: Hex | null;
  commit_block: number | null;
  reveal_tx_hash: Hex | null;
  reveal_block: number | null;
  response_by: string | null;
  commit_by: string | null;
  reveal_by: string | null;
}

export interface ExportedVerdictCommitment {
  schema_version: "originagent.evolution.verdict_commitment_export.v1";
  exported_at: string;
  record: VaultVerdictCommitment;
}

export interface SaveVerdictCommitmentInput {
  challengeId: string;
  validator: string;
  claimedUpheld: boolean;
  verdictHash: string;
  methodHash: string;
  salt: string;
  createdAt: string;
  responseBy?: string;
  commitBy?: string;
  revealBy?: string;
}

// Uses synchronous SQLite (Node 24 DatabaseSync); suitable for CLI-only use.
// If consumed by long-running services, migrate to async.
export class AdjudicationVault {
  readonly path: string;
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS verdict_commitments (
        challenge_id TEXT NOT NULL,
        validator TEXT NOT NULL,
        claimed_upheld INTEGER NOT NULL,
        verdict_hash TEXT NOT NULL,
        method_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        commitment_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        commit_tx_hash TEXT,
        commit_block INTEGER,
        reveal_tx_hash TEXT,
        reveal_block INTEGER,
        response_by TEXT,
        commit_by TEXT,
        reveal_by TEXT,
        PRIMARY KEY (challenge_id, validator)
      )
    `);
  }

  close(): void {
    this.db.close();
  }

  saveBeforeBroadcast(input: SaveVerdictCommitmentInput): VaultVerdictCommitment {
    const record = this.recordFromInput(input);
    const existing = this.get(record.challenge_id, record.validator);
    if (existing) {
      if (existing.commitment_hash !== record.commitment_hash) {
        throw new Error("existing local commitment differs; refusing to overwrite salt or reveal parameters");
      }
      return existing;
    }
    this.db.prepare(`
      INSERT INTO verdict_commitments (
        challenge_id, validator, claimed_upheld, verdict_hash, method_hash, salt, commitment_hash,
        status, created_at, updated_at, commit_tx_hash, commit_block, reveal_tx_hash, reveal_block,
        response_by, commit_by, reveal_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(challenge_id, validator) DO UPDATE SET
        claimed_upheld = excluded.claimed_upheld,
        verdict_hash = excluded.verdict_hash,
        method_hash = excluded.method_hash,
        salt = excluded.salt,
        commitment_hash = excluded.commitment_hash,
        status = excluded.status,
        updated_at = excluded.updated_at,
        response_by = excluded.response_by,
        commit_by = excluded.commit_by,
        reveal_by = excluded.reveal_by
    `).run(
      record.challenge_id,
      record.validator,
      record.claimed_upheld ? 1 : 0,
      record.verdict_hash,
      record.method_hash,
      record.salt,
      record.commitment_hash,
      record.status,
      record.created_at,
      record.updated_at,
      record.commit_tx_hash,
      record.commit_block,
      record.reveal_tx_hash,
      record.reveal_block,
      record.response_by,
      record.commit_by,
      record.reveal_by,
    );
    return record;
  }

  get(challengeId: string, validator: string): VaultVerdictCommitment | undefined {
    const row = this.db.prepare(
      "SELECT * FROM verdict_commitments WHERE challenge_id = ? AND validator = ?",
    ).get(toBytes32(challengeId, "challenge_id"), getAddress(validator));
    return row ? rowToRecord(row as Record<string, unknown>) : undefined;
  }

  listPendingReveals(): VaultVerdictCommitment[] {
    const rows = this.db.prepare(`
      SELECT * FROM verdict_commitments
      WHERE status IN ('committed', 'reveal_pending')
      ORDER BY updated_at ASC, challenge_id ASC, validator ASC
    `).all();
    return rows.map((row) => rowToRecord(row as Record<string, unknown>));
  }

  markCommitSubmitted(challengeId: string, validator: string, txHash: string, committedAt: string, block?: number): VaultVerdictCommitment {
    const record = this.requireRecord(challengeId, validator);
    this.db.prepare(`
      UPDATE verdict_commitments
      SET status = 'committed', commit_tx_hash = ?, commit_block = ?, updated_at = ?
      WHERE challenge_id = ? AND validator = ?
    `).run(toBytes32(txHash, "commit_tx_hash"), block ?? null, committedAt, record.challenge_id, record.validator);
    return this.requireRecord(challengeId, validator);
  }

  markRevealSubmitted(challengeId: string, validator: string, txHash: string, submittedAt: string): VaultVerdictCommitment {
    const record = this.requireRecord(challengeId, validator);
    this.db.prepare(`
      UPDATE verdict_commitments
      SET status = 'reveal_pending', reveal_tx_hash = ?, updated_at = ?
      WHERE challenge_id = ? AND validator = ?
    `).run(toBytes32(txHash, "reveal_tx_hash"), submittedAt, record.challenge_id, record.validator);
    return this.requireRecord(challengeId, validator);
  }

  markRevealConfirmed(challengeId: string, validator: string, confirmedAt: string, block?: number): VaultVerdictCommitment {
    const record = this.requireRecord(challengeId, validator);
    this.db.prepare(`
      UPDATE verdict_commitments
      SET status = 'revealed', reveal_block = ?, updated_at = ?
      WHERE challenge_id = ? AND validator = ?
    `).run(block ?? null, confirmedAt, record.challenge_id, record.validator);
    return this.requireRecord(challengeId, validator);
  }

  revealArtifact(challengeId: string, validator: string): ValidatorVerdictReveal {
    const record = this.requireRecord(challengeId, validator);
    if (!record.salt) {
      throw new Error("missing salt; reveal is impossible without vault or export backup");
    }
    return createValidatorVerdictReveal({
      challengeId: record.challenge_id,
      validator: record.validator,
      claimedUpheld: record.claimed_upheld,
      verdictHash: record.verdict_hash,
      methodHash: record.method_hash,
      salt: record.salt,
      createdAt: new Date().toISOString(),
    });
  }

  retryReveal(challengeId: string, validator: string, chainRevealed: boolean): ValidatorVerdictReveal {
    const record = this.requireRecord(challengeId, validator);
    if (chainRevealed) {
      this.markRevealConfirmed(record.challenge_id, record.validator, new Date().toISOString());
      throw new Error("validator verdict is already revealed on-chain");
    }
    if (record.status !== "committed" && record.status !== "reveal_pending") {
      throw new Error(`cannot retry reveal from status ${record.status}`);
    }
    return this.revealArtifact(record.challenge_id, record.validator);
  }

  commitmentArtifact(challengeId: string, validator: string, createdAt: string): ValidatorVerdictCommitment {
    const record = this.requireRecord(challengeId, validator);
    return createValidatorVerdictCommitment({
      challengeId: record.challenge_id,
      validator: record.validator,
      commitmentHash: record.commitment_hash,
      createdAt,
    });
  }

  exportRecord(challengeId: string, validator: string, exportedAt: string): ExportedVerdictCommitment {
    return {
      schema_version: "originagent.evolution.verdict_commitment_export.v1",
      exported_at: exportedAt,
      record: this.requireRecord(challengeId, validator),
    };
  }

  importRecord(exported: ExportedVerdictCommitment): VaultVerdictCommitment {
    if (exported.schema_version !== "originagent.evolution.verdict_commitment_export.v1") {
      throw new Error("unsupported verdict commitment export schema_version");
    }
    const record = normalizeRecord(exported.record);
    this.db.prepare(`
      INSERT INTO verdict_commitments (
        challenge_id, validator, claimed_upheld, verdict_hash, method_hash, salt, commitment_hash,
        status, created_at, updated_at, commit_tx_hash, commit_block, reveal_tx_hash, reveal_block,
        response_by, commit_by, reveal_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(challenge_id, validator) DO UPDATE SET
        claimed_upheld = excluded.claimed_upheld,
        verdict_hash = excluded.verdict_hash,
        method_hash = excluded.method_hash,
        salt = excluded.salt,
        commitment_hash = excluded.commitment_hash,
        status = excluded.status,
        updated_at = excluded.updated_at,
        commit_tx_hash = excluded.commit_tx_hash,
        commit_block = excluded.commit_block,
        reveal_tx_hash = excluded.reveal_tx_hash,
        reveal_block = excluded.reveal_block,
        response_by = excluded.response_by,
        commit_by = excluded.commit_by,
        reveal_by = excluded.reveal_by
    `).run(
      record.challenge_id,
      record.validator,
      record.claimed_upheld ? 1 : 0,
      record.verdict_hash,
      record.method_hash,
      record.salt,
      record.commitment_hash,
      record.status,
      record.created_at,
      record.updated_at,
      record.commit_tx_hash,
      record.commit_block,
      record.reveal_tx_hash,
      record.reveal_block,
      record.response_by,
      record.commit_by,
      record.reveal_by,
    );
    return record;
  }

  private recordFromInput(input: SaveVerdictCommitmentInput): VaultVerdictCommitment {
    const challengeId = toBytes32(input.challengeId, "challenge_id");
    const validator = getAddress(input.validator);
    const verdictHash = toBytes32(input.verdictHash, "verdict_hash");
    const methodHash = toBytes32(input.methodHash, "method_hash");
    const salt = toBytes32(input.salt, "salt");
    const commitmentHash = computeVerdictCommitmentHash({
      challengeId,
      validator,
      claimedUpheld: input.claimedUpheld,
      verdictHash,
      methodHash,
      salt,
    });
    return {
      challenge_id: challengeId,
      validator,
      claimed_upheld: input.claimedUpheld,
      verdict_hash: verdictHash,
      method_hash: methodHash,
      salt,
      commitment_hash: commitmentHash,
      status: "pending_commit",
      created_at: input.createdAt,
      updated_at: input.createdAt,
      commit_tx_hash: null,
      commit_block: null,
      reveal_tx_hash: null,
      reveal_block: null,
      response_by: input.responseBy ?? null,
      commit_by: input.commitBy ?? null,
      reveal_by: input.revealBy ?? null,
    };
  }

  private requireRecord(challengeId: string, validator: string): VaultVerdictCommitment {
    const record = this.get(challengeId, validator);
    if (!record) {
      throw new Error("no local verdict commitment found; reveal is impossible without vault or export backup");
    }
    return record;
  }
}

export function openAdjudicationVault(path: string): AdjudicationVault {
  return new AdjudicationVault(path);
}

export function readExportedVerdictCommitment(path: string): ExportedVerdictCommitment {
  return JSON.parse(readFileSync(path, "utf8")) as ExportedVerdictCommitment;
}

export function writeExportedVerdictCommitment(exported: ExportedVerdictCommitment, path: string): ExportedVerdictCommitment {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(exported, null, 2)}\n`, "utf8");
  return exported;
}

function rowToRecord(row: Record<string, unknown>): VaultVerdictCommitment {
  return normalizeRecord({
    challenge_id: row.challenge_id,
    validator: row.validator,
    claimed_upheld: Number(row.claimed_upheld) === 1,
    verdict_hash: row.verdict_hash,
    method_hash: row.method_hash,
    salt: row.salt,
    commitment_hash: row.commitment_hash,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    commit_tx_hash: row.commit_tx_hash ?? null,
    commit_block: row.commit_block === null || row.commit_block === undefined ? null : Number(row.commit_block),
    reveal_tx_hash: row.reveal_tx_hash ?? null,
    reveal_block: row.reveal_block === null || row.reveal_block === undefined ? null : Number(row.reveal_block),
    response_by: row.response_by ?? null,
    commit_by: row.commit_by ?? null,
    reveal_by: row.reveal_by ?? null,
  });
}

function normalizeRecord(record: Record<string, unknown>): VaultVerdictCommitment {
  const normalized: VaultVerdictCommitment = {
    challenge_id: toBytes32(String(record.challenge_id), "challenge_id"),
    validator: getAddress(String(record.validator)),
    claimed_upheld: Boolean(record.claimed_upheld),
    verdict_hash: toBytes32(String(record.verdict_hash), "verdict_hash"),
    method_hash: toBytes32(String(record.method_hash), "method_hash"),
    salt: toBytes32(String(record.salt), "salt"),
    commitment_hash: toBytes32(String(record.commitment_hash), "commitment_hash"),
    status: statusValue(String(record.status)),
    created_at: String(record.created_at),
    updated_at: String(record.updated_at),
    commit_tx_hash: record.commit_tx_hash === null ? null : toBytes32(String(record.commit_tx_hash), "commit_tx_hash"),
    commit_block: record.commit_block === null ? null : Number(record.commit_block),
    reveal_tx_hash: record.reveal_tx_hash === null ? null : toBytes32(String(record.reveal_tx_hash), "reveal_tx_hash"),
    reveal_block: record.reveal_block === null ? null : Number(record.reveal_block),
    response_by: record.response_by === null ? null : String(record.response_by),
    commit_by: record.commit_by === null ? null : String(record.commit_by),
    reveal_by: record.reveal_by === null ? null : String(record.reveal_by),
  };
  const expected = computeVerdictCommitmentHash({
    challengeId: normalized.challenge_id,
    validator: normalized.validator,
    claimedUpheld: normalized.claimed_upheld,
    verdictHash: normalized.verdict_hash,
    methodHash: normalized.method_hash,
    salt: normalized.salt,
  });
  if (expected !== normalized.commitment_hash) {
    throw new Error("exported verdict commitment hash does not match salt and reveal parameters");
  }
  return normalized;
}

function statusValue(value: string): VerdictCommitmentStatus {
  if (
    value === "pending_commit" ||
    value === "committed" ||
    value === "reveal_pending" ||
    value === "revealed" ||
    value === "expired" ||
    value === "archived"
  ) {
    return value;
  }
  throw new Error(`unsupported verdict commitment status: ${value}`);
}
