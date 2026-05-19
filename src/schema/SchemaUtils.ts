import type { AnyRecord } from "../core/types.js";
import { HsmSchemaFunctionError, HsmSchemaValidationError } from "./SchemaErrors.js";
import type { HsmSchemaRefList, JsonValue } from "./HsmSchema.js";

export function optional<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) {
    Object.assign(target, { [key]: value });
  }
}

export function assertNoFunction(value: unknown, path: string): void {
  if (typeof value === "function") throw new HsmSchemaFunctionError(path);
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoFunction(item, `${path}[${index}]`));
    return;
  }

  for (const [key, child] of Object.entries(value as AnyRecord)) {
    assertNoFunction(child, path ? `${path}.${key}` : key);
  }
}

export function toJsonValue(value: unknown, path: string): JsonValue | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "function") throw new HsmSchemaFunctionError(path);
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new HsmSchemaValidationError(`Non-finite number cannot be serialized at "${path}".`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const json = toJsonValue(item, `${path}[${index}]`);
      return json === undefined ? null : json;
    });
  }
  if (typeof value === "object") {
    const output: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value as AnyRecord)) {
      const json = toJsonValue(child, path ? `${path}.${key}` : key);
      if (json !== undefined) output[key] = json;
    }
    return output;
  }
  throw new HsmSchemaValidationError(`Value at "${path}" is not JSON-serializable.`);
}

export function normalizeRefList(ref: unknown, path: string): HsmSchemaRefList | undefined {
  if (ref === undefined || ref === null) return undefined;
  const refs = Array.isArray(ref) ? ref : [ref];
  const names = refs.map((item, index) => {
    if (typeof item === "function") throw new HsmSchemaFunctionError(`${path}[${index}]`);
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new HsmSchemaValidationError(`Expected named string reference at "${path}[${index}]".`);
    }
    return item;
  });
  return { refs: Object.freeze([...new Set(names)]) };
}

export function refsToRuntime(ref?: HsmSchemaRefList): string | readonly string[] | undefined {
  if (!ref || ref.refs.length === 0) return undefined;
  return ref.refs.length === 1 ? ref.refs[0] : [...ref.refs];
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value as AnyRecord).sort()) {
    output[key] = sortObject((value as AnyRecord)[key]);
  }
  return output;
}

export function checksum(value: unknown): string {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
