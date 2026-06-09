import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import {
  computeProofBundleHash,
  prepareModuleSubmission,
  readProofBundle,
  validateProofBundle,
} from "../src/proof.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE = join(ROOT, "fixtures", "proof_bundle.valid.json");
const CLI = join(ROOT, "sdk", "src", "cli.ts");

test("valid proof bundle hash verifies and is stable across field order", () => {
  const bundle = readProofBundle(FIXTURE);
  const validation = validateProofBundle(bundle);
  assert.equal(validation.ok, true, validation.errors.join("; "));

  const reordered = Object.fromEntries(Object.entries(bundle).reverse());
  assert.equal(computeProofBundleHash(reordered), computeProofBundleHash(bundle));
});

test("proof bundle hash tampering is rejected", () => {
  const bundle = readProofBundle(FIXTURE);
  bundle.proof_bundle_hash = "9".repeat(64);
  const validation = validateProofBundle(bundle);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /proof_bundle_hash mismatch/);
});

test("private fields, local paths, URL queries, and secret-like strings are rejected", () => {
  const bundle = readProofBundle(FIXTURE) as Record<string, unknown>;
  bundle.raw_prompt = "summarize private data";
  bundle.note = "C:\\Users\\tester\\secret.txt";
  bundle.callback = "https://example.invalid/path?token=abc";
  bundle.secret = "api_key=abc123";

  const validation = validateProofBundle(bundle);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /forbidden private field/);
  assert.match(validation.errors.join("\n"), /local absolute path/);
  assert.match(validation.errors.join("\n"), /URL query string/);
  assert.match(validation.errors.join("\n"), /secret-like string/);
});

test("prepare-module emits contract-ready bytes32 values", () => {
  const submission = prepareModuleSubmission(
    readProofBundle(FIXTURE),
    "oci://registry.example/originagent/demo-skill@sha256:1111111111111111111111111111111111111111111111111111111111111111",
  );
  assert.equal(submission.moduleDigest, `0x${"1".repeat(64)}`);
  assert.equal(submission.moduleType, "skill");
  assert.match(submission.manifestHash, /^0x[0-9a-f]{64}$/);
  assert.match(submission.proofBundleHash, /^0x[0-9a-f]{64}$/);
});

test("prepare-module rejects OCI URI without matching artifact digest", () => {
  assert.throws(
    () =>
      prepareModuleSubmission(
        readProofBundle(FIXTURE),
        "oci://registry.example/originagent/demo-skill@sha256:9999999999999999999999999999999999999999999999999999999999999999",
      ),
    /storageUri digest must match/,
  );
  assert.throws(
    () => prepareModuleSubmission(readProofBundle(FIXTURE), "oci://registry.example/originagent/demo-skill:1.0.0"),
    /storageUri must match/,
  );
});

test("CLI verifies proof and prepares module", () => {
  const verifyOutput = execFileSync(process.execPath, [CLI, "verify-proof", FIXTURE], { encoding: "utf8" });
  assert.equal(JSON.parse(verifyOutput).ok, true);

  const prepareOutput = execFileSync(
    process.execPath,
    [
      CLI,
      "prepare-module",
      FIXTURE,
      "--storage-uri",
      "oci://registry.example/originagent/demo-skill@sha256:1111111111111111111111111111111111111111111111111111111111111111",
    ],
    { encoding: "utf8" },
  );
  assert.equal(JSON.parse(prepareOutput).moduleType, "skill");
});

test("CLI rejects invalid proof fixture", () => {
  const bundle = JSON.parse(readFileSync(FIXTURE, "utf8"));
  bundle.prompt = "private prompt";
  const invalidPath = join(tmpdir(), `originagent-chain-invalid-${Date.now()}.json`);
  writeFileSync(invalidPath, JSON.stringify(bundle), "utf8");

  assert.throws(
    () => execFileSync(process.execPath, [CLI, "verify-proof", invalidPath], { encoding: "utf8", stdio: "pipe" }),
    /Command failed/,
  );
});
