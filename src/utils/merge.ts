import type { AnyRecord } from "../core/types.js";

export function shallowMerge<T extends AnyRecord>(items: readonly T[]): T {
  return Object.assign({}, ...items) as T;
}

export function unique(items: readonly string[]): readonly string[] {
  return Array.from(new Set(items));
}


export function deepMerge<T extends AnyRecord>(base: T, patch: Partial<T> | undefined): T {
  if (!patch) return { ...base } as T;
  const output: AnyRecord = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    const current = output[key];
    output[key] = isMergeable(current) && isMergeable(value)
      ? deepMerge(current, value as AnyRecord)
      : value;
  }

  return output as T;
}

function isMergeable(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
