import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import { computeScoreCommitHash, verifyScoreReveal } from "../src/score.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const MODULE = `0x${"1".repeat(64)}`;
const REASON = `0x${"2".repeat(64)}`;
const SALT = `0x${"3".repeat(64)}`;

test("score commit and reveal match for the same score, reason hash, and salt", () => {
  const commitHash = computeScoreCommitHash(88, REASON, SALT);
  assert.equal(verifyScoreReveal(commitHash, 88, REASON, SALT), true);
  assert.equal(verifyScoreReveal(commitHash, 87, REASON, SALT), false);
});

test("score must stay within 0-100", () => {
  assert.throws(() => computeScoreCommitHash(101, REASON, SALT), /score must be an integer/);
  assert.throws(() => computeScoreCommitHash(-1, REASON, SALT), /score must be an integer/);
});

test("CLI score-commit and score-reveal use the same hash", () => {
  const commitOutput = execFileSync(
    process.execPath,
    [
      CLI,
      "score-commit",
      "--module",
      MODULE,
      "--score",
      "88",
      "--reason-hash",
      REASON,
      "--salt",
      SALT,
    ],
    { encoding: "utf8" },
  );
  const commitHash = JSON.parse(commitOutput).commitHash;
  const revealOutput = execFileSync(
    process.execPath,
    [
      CLI,
      "score-reveal",
      "--commit",
      commitHash,
      "--score",
      "88",
      "--reason-hash",
      REASON,
      "--salt",
      SALT,
    ],
    { encoding: "utf8" },
  );
  assert.equal(JSON.parse(revealOutput).matched, true);

  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          CLI,
          "score-reveal",
          "--commit",
          commitHash,
          "--score",
          "88",
          "--reason-hash",
          REASON,
          "--salt",
          `0x${"4".repeat(64)}`,
        ],
        { encoding: "utf8", stdio: "pipe" },
      ),
    /Command failed/,
  );
});
