import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { encodeAbiParameters, getAddress, keccak256, type Address, type Hex } from "viem";
import { hashJson, toBytes32 } from "./canonical.ts";
import { collectPrivacyErrors } from "./evidence.ts";

export type UnitKindStatus = "Draft" | "Experimental" | "Candidate" | "Canonical" | "Deprecated" | "Rejected";

export interface UnitKindProposal {
  schema_version: "originagent.evolution.unit_kind_proposal.v1";
  kind_id: string;
  version: string;
  display_name: string;
  description: string;
  runtime_surface: string;
  schema_hash: string;
  schema_uri: string;
  permission_model: string;
  verification_profile: string;
  risk_class: string;
  sandbox_requirement: string;
  install_semantics: string;
  rollback_semantics: string;
  compatibility_rules: string;
  deprecation_rules: string;
  proposal_hash: string;
}

export interface UnitKindReview {
  schema_version: "originagent.evolution.unit_kind_review.v1";
  kind_id: string;
  version: string;
  reviewer: Address;
  recommended_status: UnitKindStatus;
  risk_assessment: string;
  validation_summary_hash: string;
  review_hash: string;
}

export interface UnitKindValidationResult {
  ok: boolean;
  errors: string[];
  computedHash: string;
}

const PROPOSAL_REQUIRED_FIELDS = [
  "schema_version",
  "kind_id",
  "version",
  "display_name",
  "description",
  "runtime_surface",
  "schema_hash",
  "schema_uri",
  "permission_model",
  "verification_profile",
  "risk_class",
  "sandbox_requirement",
  "install_semantics",
  "rollback_semantics",
  "compatibility_rules",
  "deprecation_rules",
  "proposal_hash",
];
const REVIEW_REQUIRED_FIELDS = [
  "schema_version",
  "kind_id",
  "version",
  "reviewer",
  "recommended_status",
  "risk_assessment",
  "validation_summary_hash",
  "review_hash",
];
const KIND_ID_RE = /^[a-z][a-z0-9_]*$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const STATUS_TO_ID: Record<UnitKindStatus, number> = {
  Draft: 1,
  Experimental: 2,
  Candidate: 3,
  Canonical: 4,
  Deprecated: 5,
  Rejected: 6,
};
const STATUSES = new Set<UnitKindStatus>(Object.keys(STATUS_TO_ID) as UnitKindStatus[]);

export function createUnitKindProposal(input: Omit<UnitKindProposal, "schema_version" | "proposal_hash">): UnitKindProposal {
  const proposal: UnitKindProposal = {
    schema_version: "originagent.evolution.unit_kind_proposal.v1",
    ...input,
    proposal_hash: "",
  };
  proposal.proposal_hash = computeUnitKindProposalHash(proposal);
  const validation = validateUnitKindProposal(proposal);
  if (!validation.ok) {
    throw new Error(`invalid unit kind proposal: ${validation.errors.join("; ")}`);
  }
  return proposal;
}

export function createUnitKindReview(input: Omit<UnitKindReview, "schema_version" | "reviewer" | "review_hash"> & { reviewer: string }): UnitKindReview {
  const review: UnitKindReview = {
    schema_version: "originagent.evolution.unit_kind_review.v1",
    ...input,
    reviewer: getAddress(input.reviewer),
    review_hash: "",
  };
  review.review_hash = computeUnitKindReviewHash(review);
  const validation = validateUnitKindReview(review);
  if (!validation.ok) {
    throw new Error(`invalid unit kind review: ${validation.errors.join("; ")}`);
  }
  return review;
}

export function readUnitKindProposal(path: string): UnitKindProposal {
  return JSON.parse(readFileSync(path, "utf8")) as UnitKindProposal;
}

export function readUnitKindReview(path: string): UnitKindReview {
  return JSON.parse(readFileSync(path, "utf8")) as UnitKindReview;
}

export function writeUnitKindProposal(proposal: UnitKindProposal, path: string): UnitKindProposal {
  const validation = validateUnitKindProposal(proposal);
  if (!validation.ok) {
    throw new Error(`invalid unit kind proposal: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(proposal, null, 2)}\n`, "utf8");
  return proposal;
}

export function writeUnitKindReview(review: UnitKindReview, path: string): UnitKindReview {
  const validation = validateUnitKindReview(review);
  if (!validation.ok) {
    throw new Error(`invalid unit kind review: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  return review;
}

export function computeUnitKindProposalHash(proposal: Record<string, unknown>): string {
  const payload = { ...proposal };
  delete payload.proposal_hash;
  return hashJson(payload);
}

export function computeUnitKindReviewHash(review: Record<string, unknown>): string {
  const payload = { ...review };
  delete payload.review_hash;
  return hashJson(payload);
}

export function computeUnitKindIdHash(kindId: string): Hex {
  return keccak256(new TextEncoder().encode(kindId));
}

export function computeUnitKindVersionHash(version: string): Hex {
  return keccak256(new TextEncoder().encode(version));
}

export function computeUnitKindVersionKey(kindIdHash: string, versionHash: string): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }],
      [toBytes32(kindIdHash, "kind_id_hash"), toBytes32(versionHash, "version_hash")],
    ),
  );
}

export function unitKindStatusId(status: UnitKindStatus): number {
  return STATUS_TO_ID[status];
}

export function validateUnitKindProposal(proposal: unknown): UnitKindValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(proposal)) {
    return { ok: false, errors: ["unit kind proposal must be an object"], computedHash: "" };
  }
  validateFields(proposal, PROPOSAL_REQUIRED_FIELDS, errors);
  if (proposal.schema_version !== "originagent.evolution.unit_kind_proposal.v1") {
    errors.push("schema_version must be originagent.evolution.unit_kind_proposal.v1");
  }
  validateKindId(proposal.kind_id, errors);
  for (const field of [
    "version",
    "display_name",
    "description",
    "runtime_surface",
    "schema_uri",
    "permission_model",
    "verification_profile",
    "risk_class",
    "sandbox_requirement",
    "install_semantics",
    "rollback_semantics",
    "compatibility_rules",
    "deprecation_rules",
  ]) {
    validateNonEmptyString(proposal, field, errors);
  }
  validateHex64(proposal, ["schema_hash", "proposal_hash"], errors);
  errors.push(...collectPrivacyErrors(proposal));

  let computedHash = "";
  if (errors.length === 0) {
    computedHash = computeUnitKindProposalHash(proposal);
    if (computedHash !== proposal.proposal_hash) {
      errors.push("proposal_hash mismatch");
    }
  }
  return { ok: errors.length === 0, errors, computedHash };
}

export function validateUnitKindReview(review: unknown): UnitKindValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(review)) {
    return { ok: false, errors: ["unit kind review must be an object"], computedHash: "" };
  }
  validateFields(review, REVIEW_REQUIRED_FIELDS, errors);
  if (review.schema_version !== "originagent.evolution.unit_kind_review.v1") {
    errors.push("schema_version must be originagent.evolution.unit_kind_review.v1");
  }
  validateKindId(review.kind_id, errors);
  validateNonEmptyString(review, "version", errors);
  validateNonEmptyString(review, "risk_assessment", errors);
  validateAddress(review, "reviewer", errors);
  if (!STATUSES.has(review.recommended_status as UnitKindStatus)) {
    errors.push("recommended_status must be Draft, Experimental, Candidate, Canonical, Deprecated, or Rejected");
  }
  validateHex64(review, ["validation_summary_hash", "review_hash"], errors);
  errors.push(...collectPrivacyErrors(review));

  let computedHash = "";
  if (errors.length === 0) {
    computedHash = computeUnitKindReviewHash(review);
    if (computedHash !== review.review_hash) {
      errors.push("review_hash mismatch");
    }
  }
  return { ok: errors.length === 0, errors, computedHash };
}

function validateFields(record: Record<string, unknown>, requiredFields: string[], errors: string[]): void {
  for (const field of requiredFields) {
    if (!(field in record)) {
      errors.push(`missing field: ${field}`);
    }
  }
  for (const field of Object.keys(record)) {
    if (!requiredFields.includes(field)) {
      errors.push(`unknown field: ${field}`);
    }
  }
}

function validateKindId(value: unknown, errors: string[]): void {
  if (typeof value !== "string" || value.length === 0 || value.length > 64 || !KIND_ID_RE.test(value)) {
    errors.push("kind_id must match ^[a-z][a-z0-9_]*$ and be at most 64 characters");
  }
}

function validateNonEmptyString(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (typeof record[field] !== "string" || record[field].length === 0) {
    errors.push(`${field} must be a non-empty string`);
  }
}

function validateHex64(record: Record<string, unknown>, fields: string[], errors: string[]): void {
  for (const field of fields) {
    if (typeof record[field] !== "string" || !HEX64_RE.test(record[field])) {
      errors.push(`${field} must be a lowercase 64-character hex digest`);
    }
  }
}

function validateAddress(record: Record<string, unknown>, field: string, errors: string[]): void {
  const value = record[field];
  if (typeof value !== "string") {
    errors.push(`${field} must be an EVM address`);
    return;
  }
  try {
    getAddress(value);
  } catch {
    errors.push(`${field} must be an EVM address`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
