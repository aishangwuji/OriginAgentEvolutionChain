import { hexToBytes32, sha256Hex, toBytes32 } from "./canonical.ts";

export function computeScoreCommitHash(score: number, reasonHash: string, salt: string): `0x${string}` {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error("score must be an integer from 0 to 100");
  }
  const payload = Buffer.concat([Buffer.from([score]), hexToBytes32(reasonHash, "reasonHash"), hexToBytes32(salt, "salt")]);
  return `0x${sha256Hex(payload)}`;
}

export function verifyScoreReveal(commitHash: string, score: number, reasonHash: string, salt: string): boolean {
  return toBytes32(commitHash, "commitHash") === computeScoreCommitHash(score, reasonHash, salt);
}
