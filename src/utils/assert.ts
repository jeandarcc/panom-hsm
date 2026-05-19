import { HsmConfigurationError } from "../errors/HsmErrors.js";

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new HsmConfigurationError(message);
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
