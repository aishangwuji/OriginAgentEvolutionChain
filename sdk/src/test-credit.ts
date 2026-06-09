import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getAddress, type Address, type Hex } from "viem";
import { hashJson, toBytes32 } from "./canonical.ts";
import { collectPrivacyErrors } from "./evidence.ts";
import {
  validateTrustPolicyReport,
  type AdmissionGate,
  type TrustPolicyDecision,
  type TrustPolicyReport,
} from "./trust-policy.ts";

export const TEST_CREDIT_AMOUNTS = {
  passport_bootstrap: 100,
  validator_report_grant: 25,
  module_submission_grant: 10,
  audit_request_fee: 5,
  challenge_bond: 10,
  challenge_bond_lock: 10,
  challenge_bond_refund: 10,
  challenge_bond_consume: 10,
  challenge_bond_partial_fee: 5,
  blocked_by_trust_policy: 0,
} as const;

export type TestCreditActionType = "grant" | "consume" | "deny";
export type TestCreditReason = keyof typeof TEST_CREDIT_AMOUNTS;
export type TestCreditGate = "eligible" | "manual_review" | "blocked";

export interface TestCreditAction {
  schema_version: "originagent.evolution.test_credit_action.v1";
  passport_id: Hex;
  owner: Address;
  action: TestCreditActionType;
  reason: TestCreditReason;
  amount: number;
  gate: TestCreditGate;
  trust_policy_report_hash: string;
  created_at: string;
  action_hash: string;
}

export interface TestCreditReport {
  schema_version: "originagent.evolution.test_credit_report.v1";
  passport_id: Hex;
  owner: Address;
  trust_policy_report_hash: string;
  actions: TestCreditAction[];
  granted: number;
  consumed: number;
  denied_count: number;
  balance_delta: number;
  report_hash: string;
}

export interface TestCreditValidationResult {
  ok: boolean;
  errors: string[];
  computedHash: string;
}

const ACTION_SCHEMA_VERSION = "originagent.evolution.test_credit_action.v1";
const REPORT_SCHEMA_VERSION = "originagent.evolution.test_credit_report.v1";
const ACTION_REQUIRED_FIELDS = [
  "schema_version",
  "passport_id",
  "owner",
  "action",
  "reason",
  "amount",
  "gate",
  "trust_policy_report_hash",
  "created_at",
  "action_hash",
];
const REPORT_REQUIRED_FIELDS = [
  "schema_version",
  "passport_id",
  "owner",
  "trust_policy_report_hash",
  "actions",
  "granted",
  "consumed",
  "denied_count",
  "balance_delta",
  "report_hash",
];
const HEX64_RE = /^[0-9a-f]{64}$/;
const BYTES32_RE = /^(?:0x)?[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_BYTES32 = `0x${"0".repeat(64)}` as const;
const ACTIONS = new Set<TestCreditActionType>(["grant", "consume", "deny"]);
const REASONS = new Set<TestCreditReason>(Object.keys(TEST_CREDIT_AMOUNTS) as TestCreditReason[]);
const GATES = new Set<TestCreditGate>(["eligible", "manual_review", "blocked"]);
const GRANT_REASONS = new Set<TestCreditReason>([
  "passport_bootstrap",
  "validator_report_grant",
  "module_submission_grant",
  "challenge_bond_refund",
]);
const CONSUME_REASONS = new Set<TestCreditReason>([
  "audit_request_fee",
  "challenge_bond",
  "challenge_bond_lock",
  "challenge_bond_consume",
  "challenge_bond_partial_fee",
]);

export function createTestCreditAction(input: {
  passportId: string;
  owner: string;
  action: TestCreditActionType;
  reason: TestCreditReason;
  amount?: number;
  trustPolicyReportHash?: string;
  trustPolicyReport?: TrustPolicyReport;
  createdAt: string;
}): TestCreditAction {
  const passportId = toBytes32(input.passportId, "passport_id");
  const owner = getAddress(input.owner);
  const gate = input.trustPolicyReport ? testCreditGateFor(passportId, owner, input.trustPolicyReport) : "eligible";
  const action: TestCreditAction = {
    schema_version: ACTION_SCHEMA_VERSION,
    passport_id: passportId,
    owner,
    action: input.action,
    reason: input.reason,
    amount: input.amount ?? TEST_CREDIT_AMOUNTS[input.reason],
    gate,
    trust_policy_report_hash: input.trustPolicyReport?.report_hash ?? normalizeHex64(input.trustPolicyReportHash ?? "", "trust_policy_report_hash"),
    created_at: input.createdAt,
    action_hash: "",
  };
  action.action_hash = computeTestCreditActionHash(action);
  const validation = validateTestCreditAction(action, input.trustPolicyReport);
  if (!validation.ok) {
    throw new Error(`invalid test credit action: ${validation.errors.join("; ")}`);
  }
  return action;
}

export function createTestCreditReport(input: {
  passportId: string;
  owner: string;
  actions: TestCreditAction[];
  trustPolicyReportHash?: string;
}): TestCreditReport {
  const passportId = toBytes32(input.passportId, "passport_id");
  const owner = getAddress(input.owner);
  const actions = input.actions.map(normalizeAction);
  const trustPolicyReportHash = input.trustPolicyReportHash || actions[0]?.trust_policy_report_hash || "";
  const report: TestCreditReport = {
    schema_version: REPORT_SCHEMA_VERSION,
    passport_id: passportId,
    owner,
    trust_policy_report_hash: normalizeHex64(trustPolicyReportHash, "trust_policy_report_hash"),
    actions,
    granted: actions.filter((action) => action.action === "grant").reduce((sum, action) => sum + action.amount, 0),
    consumed: actions.filter((action) => action.action === "consume").reduce((sum, action) => sum + action.amount, 0),
    denied_count: actions.filter((action) => action.action === "deny").length,
    balance_delta: 0,
    report_hash: "",
  };
  report.balance_delta = report.granted - report.consumed;
  report.report_hash = computeTestCreditReportHash(report);
  const validation = validateTestCreditReport(report);
  if (!validation.ok) {
    throw new Error(`invalid test credit report: ${validation.errors.join("; ")}`);
  }
  return report;
}

export function readTestCreditAction(path: string): TestCreditAction {
  return JSON.parse(readFileSync(path, "utf8")) as TestCreditAction;
}

export function readTestCreditReport(path: string): TestCreditReport {
  return JSON.parse(readFileSync(path, "utf8")) as TestCreditReport;
}

export function writeTestCreditAction(action: TestCreditAction, path: string): TestCreditAction {
  const validation = validateTestCreditAction(action);
  if (!validation.ok) {
    throw new Error(`invalid test credit action: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(action, null, 2)}\n`, "utf8");
  return action;
}

export function writeTestCreditReport(report: TestCreditReport, path: string): TestCreditReport {
  const validation = validateTestCreditReport(report);
  if (!validation.ok) {
    throw new Error(`invalid test credit report: ${validation.errors.join("; ")}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export function computeTestCreditActionHash(action: Record<string, unknown>): string {
  const payload = { ...action };
  delete payload.action_hash;
  return hashJson(payload);
}

export function computeTestCreditReportHash(report: Record<string, unknown>): string {
  const payload = { ...report };
  delete payload.report_hash;
  return hashJson(payload);
}

export function validateTestCreditAction(action: unknown, trustPolicyReport?: TrustPolicyReport): TestCreditValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(action)) {
    return { ok: false, errors: ["test credit action must be an object"], computedHash: "" };
  }
  validateFields(action, ACTION_REQUIRED_FIELDS, errors);
  if (action.schema_version !== ACTION_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${ACTION_SCHEMA_VERSION}`);
  }
  validateBytes32(action, "passport_id", errors);
  validateAddress(action, "owner", errors);
  if (!ACTIONS.has(action.action as TestCreditActionType)) {
    errors.push("action must be grant, consume, or deny");
  }
  if (!REASONS.has(action.reason as TestCreditReason)) {
    errors.push("reason is not supported");
  }
  validateInteger(action, "amount", errors);
  if (!GATES.has(action.gate as TestCreditGate)) {
    errors.push("gate must be eligible, manual_review, or blocked");
  }
  validateHex64(action, ["trust_policy_report_hash", "action_hash"], errors);
  if (typeof action.created_at !== "string" || action.created_at.length === 0) {
    errors.push("created_at must be a non-empty string");
  }
  validateActionSemantics(action, trustPolicyReport, errors);
  errors.push(...collectPrivacyErrors(action));

  let computedHash = "";
  if (errors.length === 0) {
    computedHash = computeTestCreditActionHash(action);
    if (computedHash !== action.action_hash) {
      errors.push("action_hash mismatch");
    }
  }
  return { ok: errors.length === 0, errors, computedHash };
}

export function validateTestCreditReport(report: unknown, trustPolicyReport?: TrustPolicyReport): TestCreditValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(report)) {
    return { ok: false, errors: ["test credit report must be an object"], computedHash: "" };
  }
  validateFields(report, REPORT_REQUIRED_FIELDS, errors);
  if (report.schema_version !== REPORT_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${REPORT_SCHEMA_VERSION}`);
  }
  validateBytes32(report, "passport_id", errors);
  validateAddress(report, "owner", errors);
  validateHex64(report, ["trust_policy_report_hash", "report_hash"], errors);
  for (const field of ["granted", "consumed", "denied_count", "balance_delta"]) {
    validateInteger(report, field, errors);
  }
  if (trustPolicyReport) {
    const trustValidation = validateTrustPolicyReport(trustPolicyReport);
    if (!trustValidation.ok) {
      errors.push(...trustValidation.errors.map((error) => `trust policy report: ${error}`));
    } else if (report.trust_policy_report_hash !== trustPolicyReport.report_hash) {
      errors.push("trust_policy_report_hash mismatch");
    }
  }
  if (!Array.isArray(report.actions)) {
    errors.push("actions must be an array");
  } else {
    validateReportActions(report, trustPolicyReport, errors);
  }
  errors.push(...collectPrivacyErrors(report));

  let computedHash = "";
  if (errors.length === 0) {
    computedHash = computeTestCreditReportHash(report);
    if (computedHash !== report.report_hash) {
      errors.push("report_hash mismatch");
    }
  }
  return { ok: errors.length === 0, errors, computedHash };
}

export function testCreditGateFor(passportId: string, owner: string, trustPolicyReport: TrustPolicyReport): TestCreditGate {
  const passport = toBytes32(passportId, "passport_id");
  const ownerAddress = getAddress(owner);
  const decisions = trustPolicyReport.decisions.filter((decision) => isRelevantDecision(decision, passport, ownerAddress));
  if (decisions.some((decision) => decision.gates.test_credit === "blocked")) {
    return "blocked";
  }
  if (decisions.some((decision) => decision.gates.test_credit === "manual_review")) {
    return "manual_review";
  }
  return "eligible";
}

function validateReportActions(
  report: Record<string, unknown>,
  trustPolicyReport: TrustPolicyReport | undefined,
  errors: string[],
): void {
  let granted = 0;
  let consumed = 0;
  let deniedCount = 0;
  const seen = new Set<string>();
  for (const [index, action] of (report.actions as unknown[]).entries()) {
    const validation = validateTestCreditAction(action, trustPolicyReport);
    if (!validation.ok) {
      errors.push(...validation.errors.map((error) => `actions[${index}]: ${error}`));
      continue;
    }
    const typed = action as TestCreditAction;
    if (typed.passport_id !== report.passport_id) {
      errors.push(`actions[${index}].passport_id mismatch`);
    }
    if (getAddress(typed.owner) !== getAddress(String(report.owner))) {
      errors.push(`actions[${index}].owner mismatch`);
    }
    if (typed.trust_policy_report_hash !== report.trust_policy_report_hash) {
      errors.push(`actions[${index}].trust_policy_report_hash mismatch`);
    }
    if (seen.has(typed.action_hash)) {
      errors.push(`duplicate action_hash ${typed.action_hash}`);
    }
    seen.add(typed.action_hash);
    if (typed.action === "grant") {
      granted += typed.amount;
    } else if (typed.action === "consume") {
      consumed += typed.amount;
    } else {
      deniedCount += 1;
    }
  }
  if (typeof report.granted === "number" && report.granted !== granted) {
    errors.push("granted mismatch");
  }
  if (typeof report.consumed === "number" && report.consumed !== consumed) {
    errors.push("consumed mismatch");
  }
  if (typeof report.denied_count === "number" && report.denied_count !== deniedCount) {
    errors.push("denied_count mismatch");
  }
  if (typeof report.balance_delta === "number" && report.balance_delta !== granted - consumed) {
    errors.push("balance_delta mismatch");
  }
}

function validateActionSemantics(
  action: Record<string, unknown>,
  trustPolicyReport: TrustPolicyReport | undefined,
  errors: string[],
): void {
  const reason = action.reason as TestCreditReason;
  const actionType = action.action as TestCreditActionType;
  if (REASONS.has(reason) && !isAllowedReasonAmount(reason, Number(action.amount))) {
    errors.push(`${reason} requires amount ${TEST_CREDIT_AMOUNTS[reason]}`);
  }
  if (actionType === "grant" && !GRANT_REASONS.has(reason)) {
    errors.push("grant action requires a grant reason");
  }
  if (actionType === "consume" && !CONSUME_REASONS.has(reason)) {
    errors.push("consume action requires a consume reason");
  }
  if (actionType === "deny" && reason !== "blocked_by_trust_policy") {
    errors.push("deny action requires blocked_by_trust_policy reason");
  }
  if ((actionType === "grant" || actionType === "consume") && action.gate !== "eligible") {
    errors.push("grant/consume requires eligible test credit gate");
  }
  if (actionType === "deny" && action.gate !== "manual_review" && action.gate !== "blocked") {
    errors.push("deny requires manual_review or blocked test credit gate");
  }
  if (
    trustPolicyReport &&
    typeof action.passport_id === "string" &&
    typeof action.owner === "string" &&
    BYTES32_RE.test(action.passport_id) &&
    ADDRESS_RE.test(action.owner)
  ) {
    if (action.trust_policy_report_hash !== trustPolicyReport.report_hash) {
      errors.push("trust_policy_report_hash mismatch");
    }
    const expectedGate = testCreditGateFor(action.passport_id, action.owner, trustPolicyReport);
    if (action.gate !== expectedGate) {
      errors.push(`gate mismatch: expected ${expectedGate}`);
    }
  }
}

function isAllowedReasonAmount(reason: TestCreditReason, amount: number): boolean {
  if (!Number.isInteger(amount) || amount < 0) {
    return false;
  }
  if (reason === "challenge_bond_refund") {
    return amount === 5 || amount === 9 || amount === 10;
  }
  if (reason === "challenge_bond_partial_fee") {
    return amount === 1 || amount === 5;
  }
  return amount === TEST_CREDIT_AMOUNTS[reason];
}

function normalizeAction(action: TestCreditAction): TestCreditAction {
  const validation = validateTestCreditAction(action);
  if (!validation.ok) {
    throw new Error(`invalid test credit action: ${validation.errors.join("; ")}`);
  }
  return {
    ...action,
    passport_id: toBytes32(action.passport_id, "passport_id"),
    owner: getAddress(action.owner),
    trust_policy_report_hash: normalizeHex64(action.trust_policy_report_hash, "trust_policy_report_hash"),
    action_hash: normalizeHex64(action.action_hash, "action_hash"),
  };
}

function isRelevantDecision(decision: TrustPolicyDecision, passportId: Hex, owner: Address): boolean {
  if (decision.subject_type === "passport" && safeBytes32Match(decision.subject_id, passportId)) {
    return true;
  }
  return decision.subject_type === "address" && safeAddressMatch(decision.subject_id, owner);
}

function safeBytes32Match(value: string, expected: Hex): boolean {
  try {
    return toBytes32(value, "subject_id") === expected;
  } catch {
    return false;
  }
}

function safeAddressMatch(value: string, expected: Address): boolean {
  try {
    return getAddress(value) === expected;
  } catch {
    return false;
  }
}

function normalizeHex64(value: string, field: string): string {
  if (!HEX64_RE.test(value)) {
    throw new Error(`${field} must be a lowercase 64-character hex digest`);
  }
  return value;
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

function validateAddress(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (typeof record[field] !== "string" || !ADDRESS_RE.test(record[field])) {
    errors.push(`${field} must be an EVM address`);
  }
}

function validateBytes32(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (typeof record[field] !== "string" || !BYTES32_RE.test(record[field])) {
    errors.push(`${field} must be a 32-byte hex value`);
  } else if (toBytes32(String(record[field]), field) === ZERO_BYTES32) {
    errors.push(`${field} must not be zero`);
  }
}

function validateHex64(record: Record<string, unknown>, fields: string[], errors: string[]): void {
  for (const field of fields) {
    if (typeof record[field] !== "string" || !HEX64_RE.test(record[field])) {
      errors.push(`${field} must be a lowercase 64-character hex digest`);
    }
  }
}

function validateInteger(record: Record<string, unknown>, field: string, errors: string[]): void {
  if (typeof record[field] !== "number" || !Number.isInteger(record[field]) || Number(record[field]) < 0) {
    errors.push(`${field} must be a non-negative integer`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
