import { createHash } from "node:crypto";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function canonicalStringify(value: unknown): string {
  return encodeCanonical(value);
}

export function hashJson(value: unknown): string {
  return sha256Hex(Buffer.from(canonicalStringify(value), "utf8"));
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function toBytes32(value: string, fieldName = "value", allowEmpty = false): `0x${string}` {
  if (value === "" && allowEmpty) {
    return `0x${"0".repeat(64)}`;
  }
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`${fieldName} must be a 32-byte hex value`);
  }
  return `0x${normalized.toLowerCase()}`;
}

export function hexToBytes32(value: string, fieldName = "value"): Buffer {
  const normalized = toBytes32(value, fieldName).slice(2);
  return Buffer.from(normalized, "hex");
}

function encodeCanonical(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonical JSON does not support non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => encodeCanonical(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    const encoded = entries.map(([key, item]) => {
      if (item === undefined) {
        throw new Error(`canonical JSON does not support undefined at key ${key}`);
      }
      return `${JSON.stringify(key)}:${encodeCanonical(item)}`;
    });
    return `{${encoded.join(",")}}`;
  }
  throw new Error(`canonical JSON does not support ${typeof value}`);
}
