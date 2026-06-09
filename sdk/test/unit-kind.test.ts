import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import { loadDeployment } from "../src/contracts.ts";
import {
  computeUnitKindIdHash,
  computeUnitKindProposalHash,
  computeUnitKindReviewHash,
  computeUnitKindVersionHash,
  computeUnitKindVersionKey,
  createUnitKindProposal,
  createUnitKindReview,
  readUnitKindProposal,
  readUnitKindReview,
  validateUnitKindProposal,
  validateUnitKindReview,
} from "../src/unit-kind.ts";
import {
  proposeUnitKindTransaction,
  setUnitKindReviewTransaction,
  setUnitKindStatusTransaction,
} from "../src/transactions.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = join(ROOT, "sdk", "src", "cli.ts");
const REVIEWER = "0x5555555555555555555555555555555555555555";
const SCHEMA_HASH = "1".repeat(64);
const SUMMARY_HASH = "2".repeat(64);

test("unit kind proposal and review validate stable hashes", () => {
  const proposal = proposalFixture();
  const review = reviewFixture(proposal);

  assert.equal(validateUnitKindProposal(proposal).ok, true);
  assert.equal(validateUnitKindReview(review).ok, true);
  assert.equal(computeUnitKindProposalHash(proposal), proposal.proposal_hash);
  assert.equal(computeUnitKindReviewHash(review), review.review_hash);

  const kindIdHash = computeUnitKindIdHash(proposal.kind_id);
  const versionHash = computeUnitKindVersionHash(proposal.version);
  assert.match(kindIdHash, /^0x[0-9a-f]{64}$/);
  assert.match(computeUnitKindVersionKey(kindIdHash, versionHash), /^0x[0-9a-f]{64}$/);
});

test("unit kind validation rejects tampering and invalid kind ids", () => {
  const proposal = proposalFixture();
  const review = reviewFixture(proposal);

  const invalidProposalCases = [
    { ...proposal, kind_id: "Tool" },
    { ...proposal, kind_id: "tool-v1" },
    { ...proposal, version: "" },
    { ...proposal, schema_hash: "0".repeat(63) },
    { ...proposal, permission_model: "" },
    { ...proposal, risk_class: "" },
    { ...proposal, proposal_hash: "0".repeat(64) },
    { ...proposal, prompt: "private" },
  ];
  for (const candidate of invalidProposalCases) {
    assert.equal(validateUnitKindProposal(candidate).ok, false);
  }

  const invalidReviewCases = [
    { ...review, kind_id: "bad-kind" },
    { ...review, recommended_status: "None" },
    { ...review, reviewer: "not-an-address" },
    { ...review, validation_summary_hash: "0".repeat(63) },
    { ...review, review_hash: "0".repeat(64) },
    { ...review, facts: ["private"] },
  ];
  for (const candidate of invalidReviewCases) {
    assert.equal(validateUnitKindReview(candidate).ok, false);
  }
});

test("unit kind CLI creates, writes, and validates artifacts", () => {
  const tmp = mkdtempSync(join(tmpdir(), "ec11-unit-kind-"));
  const proposalPath = join(tmp, "unit-kind-proposal.json");
  const reviewPath = join(tmp, "unit-kind-review.json");

  const proposal = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "create-unit-kind-proposal",
        "--kind-id",
        "tool",
        "--version",
        "1",
        "--display-name",
        "Tool",
        "--description",
        "Legacy executable tool unit kind.",
        "--runtime-surface",
        "tool_call",
        "--schema-hash",
        SCHEMA_HASH,
        "--schema-uri",
        "ipfs://unit-kind/tool/v1/schema",
        "--permission-model",
        "declared tool permissions only",
        "--verification-profile",
        "validator tool execution replay",
        "--risk-class",
        "executable_tool",
        "--sandbox-requirement",
        "isolated process without secret access",
        "--install-semantics",
        "install as ModuleType.Tool-compatible unit",
        "--rollback-semantics",
        "remove unit manifest and restore previous activation",
        "--compatibility-rules",
        "maps to ModuleType.Tool",
        "--deprecation-rules",
        "legacy mapping remains auditable",
        "--out",
        proposalPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  );
  assert.equal(proposal.proposal_hash, readUnitKindProposal(proposalPath).proposal_hash);

  const review = JSON.parse(
    execFileSync(
      process.execPath,
      [
        CLI,
        "create-unit-kind-review",
        "--kind-id",
        "tool",
        "--version",
        "1",
        "--reviewer",
        REVIEWER,
        "--recommended-status",
        "Canonical",
        "--risk-assessment",
        "low risk compatibility kind",
        "--validation-summary-hash",
        SUMMARY_HASH,
        "--out",
        reviewPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  );
  assert.equal(review.review_hash, readUnitKindReview(reviewPath).review_hash);
  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "validate-unit-kind-proposal", proposalPath], { cwd: ROOT, encoding: "utf8" })).ok, true);
  assert.equal(JSON.parse(execFileSync(process.execPath, [CLI, "validate-unit-kind-review", reviewPath], { cwd: ROOT, encoding: "utf8" })).ok, true);

  const invalidPath = join(tmp, "invalid-proposal.json");
  writeFileSync(invalidPath, JSON.stringify({ ...proposal, kind_id: "bad-kind" }));
  const invalid = spawnSync(process.execPath, [CLI, "validate-unit-kind-proposal", invalidPath], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.notEqual(invalid.status, 0);
  assert.match(JSON.parse(invalid.stdout).errors.join("\n"), /kind_id/);
});

test("unit kind dry-run transactions use optional registry only when present", async () => {
  const proposal = proposalFixture();
  const review = reviewFixture(proposal);
  const proposed = await proposeUnitKindTransaction(proposal, { network: "local", dryRun: true });
  const reviewSet = await setUnitKindReviewTransaction(review, { network: "local", dryRun: true });
  const canonical = await setUnitKindStatusTransaction("tool", "1", "Canonical", { network: "local", dryRun: true });

  assert.equal(loadDeployment("local").contracts.EvolutionUnitKindRegistry, "0x8888888888888888888888888888888888888888");
  assert.equal(proposed.contract, "EvolutionUnitKindRegistry");
  assert.equal(proposed.method, "proposeKind");
  assert.equal(proposed.target, "0x8888888888888888888888888888888888888888");
  assert.equal(reviewSet.method, "setReviewReport");
  assert.equal(canonical.method, "setKindStatus");
  assert.equal(canonical.publicPayload.statusId, 4);

  const deploymentsDir = mkdtempSync(join(tmpdir(), "ec11-old-deployments-"));
  writeFileSync(
    join(deploymentsDir, "local.json"),
    JSON.stringify({
      chainId: 31337,
      network: "local",
      contracts: {
        IdentityRegistry: "0x1111111111111111111111111111111111111111",
        AgentPassportRegistry: "0x6666666666666666666666666666666666666666",
        AgentReputationRegistry: "0x7777777777777777777777777777777777777777",
        ModuleRegistry: "0x2222222222222222222222222222222222222222",
        VerificationRegistry: "0x3333333333333333333333333333333333333333",
        ScoreCommitReveal: "0x4444444444444444444444444444444444444444",
      },
      deployer: REVIEWER,
      deployedAt: "old-fixture",
      contractVersion: "ec10.0.0",
    }),
  );
  assert.equal(loadDeployment("local", deploymentsDir).contracts.EvolutionUnitKindRegistry, undefined);
  await assert.rejects(
    () => proposeUnitKindTransaction(proposal, { network: "local", deploymentsDir, dryRun: true }),
    /EvolutionUnitKindRegistry not found/,
  );
});

function proposalFixture() {
  return createUnitKindProposal({
    kind_id: "tool",
    version: "1",
    display_name: "Tool",
    description: "Legacy executable tool unit kind.",
    runtime_surface: "tool_call",
    schema_hash: SCHEMA_HASH,
    schema_uri: "ipfs://unit-kind/tool/v1/schema",
    permission_model: "declared tool permissions only",
    verification_profile: "validator tool execution replay",
    risk_class: "executable_tool",
    sandbox_requirement: "isolated process without secret access",
    install_semantics: "install as ModuleType.Tool-compatible unit",
    rollback_semantics: "remove unit manifest and restore previous activation",
    compatibility_rules: "maps to ModuleType.Tool for EC-11 v1",
    deprecation_rules: "legacy mapping remains auditable after deprecation",
  });
}

function reviewFixture(proposal: ReturnType<typeof proposalFixture>) {
  return createUnitKindReview({
    kind_id: proposal.kind_id,
    version: proposal.version,
    reviewer: REVIEWER,
    recommended_status: "Canonical",
    risk_assessment: "low risk compatibility kind",
    validation_summary_hash: SUMMARY_HASH,
  });
}
