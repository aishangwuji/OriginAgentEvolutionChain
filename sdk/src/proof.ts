import { readFileSync } from "node:fs";
import { assertOciDigestMatchesArtifact } from "./artifact.ts";
import { hashJson, sha256Hex, toBytes32 } from "./canonical.ts";

export interface ProofBundle {
  schema_version: string;
  artifact_digest: string;
  module_id: string;
  module_type: "skill" | "domain_pack" | "workflow" | "tool";
  module_version: string;
  verification_event_hash: string;
  activation_event_hash: string;
  verification_report_digest: string;
  capability_snapshot_digest: string;
  telemetry_digest: string;
  state_branch_digest: string;
  ledger_tip_hash: string;
  created_at: string;
  actor: string;
  actor_public_key: string;
  signature_scheme: "ed25519";
  signature: string;
  proof_bundle_hash: string;
}

export interface ProofValidationResult {
  ok: boolean;
  errors: string[];
  computedHash: string;
  proofBundleHash: string;
}

export interface ModuleSubmission {
  moduleDigest: `0x${string}`;
  moduleIdHash: `0x${string}`;
  moduleType: ProofBundle["module_type"];
  versionHash: `0x${string}`;
  manifestHash: `0x${string}`;
  proofBundleHash: `0x${string}`;
  storageUri: string;
}

const PROOF_SCHEMA_VERSION = "originagent.evolution.proof_bundle.v1";
const REQUIRED_FIELDS = [
  "schema_version",
  "artifact_digest",
  "module_id",
  "module_type",
  "module_version",
  "verification_event_hash",
  "activation_event_hash",
  "verification_report_digest",
  "capability_snapshot_digest",
  "telemetry_digest",
  "state_branch_digest",
  "ledger_tip_hash",
  "created_at",
  "actor",
  "actor_public_key",
  "signature_scheme",
  "signature",
  "proof_bundle_hash",
];
const MODULE_TYPES = new Set(["skill", "domain_pack", "workflow", "tool"]);
const FORBIDDEN_KEYS = new Set([
  "raw_prompt",
  "prompt",
  "file_content",
  "file_contents",
  "raw_tool_output",
  "facts",
  "facts_raw",
  "facts_text",
  "traceback",
  "hidden_reasoning",
  "private_telemetry",
]);
const HEX64_RE = /^[0-9a-f]{64}$/;
const WINDOWS_PATH_RE = /[A-Za-z]:[\\/][^\s"'<>]+/;
const UNIX_PRIVATE_PATH_RE = /(?:\/Users\/|\/home\/)[^\s"'<>]+/;
const URL_QUERY_RE = /https?:\/\/[^\s"'<>?]+\?[^\s"'<>]+/;
const SECRET_ASSIGNMENT_RE =
  /\b(?:api[_-]?key|secret|password|authorization|bearer)\b\s*[:=]\s*["']?[^"',;\s<>]+/i;

export function readProofBundle(path: string): ProofBundle {
  return JSON.parse(readFileSync(path, "utf8")) as ProofBundle;
}

export function computeProofBundleHash(bundle: Record<string, unknown>): string {
  const payload = { ...bundle };
  delete payload.proof_bundle_hash;
  delete payload.signature;
  return hashJson(payload);
}

export function validateProofBundle(bundle: unknown): ProofValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(bundle)) {
    return { ok: false, errors: ["proof bundle must be an object"], computedHash: "", proofBundleHash: "" };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in bundle)) {
      errors.push(`missing field: ${field}`);
    }
  }
  for (const field of Object.keys(bundle)) {
    if (!REQUIRED_FIELDS.includes(field)) {
      errors.push(`unknown field: ${field}`);
    }
  }

  if (bundle.schema_version !== PROOF_SCHEMA_VERSION) {
    errors.push("schema_version must be originagent.evolution.proof_bundle.v1");
  }
  for (const field of [
    "artifact_digest",
    "verification_event_hash",
    "verification_report_digest",
    "telemetry_digest",
    "ledger_tip_hash",
    "proof_bundle_hash",
  ]) {
    if (typeof bundle[field] !== "string" || !HEX64_RE.test(bundle[field])) {
      errors.push(`${field} must be a lowercase 64-character hex digest`);
    }
  }
  for (const optionalDigest of ["activation_event_hash", "capability_snapshot_digest", "state_branch_digest"]) {
    const value = bundle[optionalDigest];
    if (typeof value !== "string" || (value !== "" && !HEX64_RE.test(value))) {
      errors.push(`${optionalDigest} must be empty or a lowercase 64-character hex digest`);
    }
  }
  if (typeof bundle.module_id !== "string" || bundle.module_id.length === 0) {
    errors.push("module_id must be a non-empty string");
  }
  if (!MODULE_TYPES.has(String(bundle.module_type))) {
    errors.push("module_type must be skill, domain_pack, workflow, or tool");
  }
  if (typeof bundle.module_version !== "string" || bundle.module_version.length === 0) {
    errors.push("module_version must be a non-empty string");
  }
  if (bundle.signature_scheme !== "ed25519") {
    errors.push("signature_scheme must be ed25519");
  }
  scanPrivacy(bundle, "$", errors);

  let computedHash = "";
  if (errors.length === 0) {
    computedHash = computeProofBundleHash(bundle);
    if (computedHash !== bundle.proof_bundle_hash) {
      errors.push("proof_bundle_hash mismatch");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    computedHash,
    proofBundleHash: typeof bundle.proof_bundle_hash === "string" ? bundle.proof_bundle_hash : "",
  };
}

export function prepareModuleSubmission(bundle: ProofBundle, storageUri: string): ModuleSubmission {
  const validation = validateProofBundle(bundle);
  if (!validation.ok) {
    throw new Error(`invalid proof bundle: ${validation.errors.join("; ")}`);
  }
  assertOciDigestMatchesArtifact(storageUri, bundle.artifact_digest);
  const manifestHash = hashJson({
    artifact_digest: bundle.artifact_digest,
    module_id: bundle.module_id,
    module_type: bundle.module_type,
    module_version: bundle.module_version,
  });
  return {
    moduleDigest: toBytes32(bundle.artifact_digest, "artifact_digest"),
    moduleIdHash: `0x${sha256Hex(Buffer.from(bundle.module_id, "utf8"))}`,
    moduleType: bundle.module_type,
    versionHash: `0x${sha256Hex(Buffer.from(bundle.module_version, "utf8"))}`,
    manifestHash: toBytes32(manifestHash, "manifestHash"),
    proofBundleHash: toBytes32(bundle.proof_bundle_hash, "proof_bundle_hash"),
    storageUri,
  };
}

function scanPrivacy(value: unknown, path: string, errors: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanPrivacy(item, `${path}[${index}]`, errors));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        errors.push(`forbidden private field: ${path}.${key}`);
      }
      scanPrivacy(item, `${path}.${key}`, errors);
    }
    return;
  }
  if (typeof value === "string") {
    if (WINDOWS_PATH_RE.test(value) || UNIX_PRIVATE_PATH_RE.test(value)) {
      errors.push(`local absolute path detected at ${path}`);
    }
    if (URL_QUERY_RE.test(value)) {
      errors.push(`URL query string detected at ${path}`);
    }
    if (SECRET_ASSIGNMENT_RE.test(value)) {
      errors.push(`secret-like string detected at ${path}`);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
