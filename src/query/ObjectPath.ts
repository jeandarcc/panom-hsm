import type { AnyRecord } from "../core/types.js";
import { HsmConfigurationError } from "../errors/HsmErrors.js";

const CONTEXT_PREFIX = "context.";
const PATH_RE = /^[A-Za-z_$][A-Za-z0-9_$-]*(\.[A-Za-z_$][A-Za-z0-9_$-]*)*$/;

export class ObjectPath {
  public readonly raw: string;
  public readonly parts: readonly string[];

  public constructor(raw: string) {
    const normalized = ObjectPath.normalize(raw);
    this.raw = normalized;
    this.parts = Object.freeze(normalized.split("."));
  }

  public static normalize(raw: string | undefined, fallback: string): string;
  public static normalize(raw: string): string;
  public static normalize(raw: string | undefined, fallback?: string): string {
    const source = (raw ?? fallback ?? "").trim();
    const withoutContext = source.startsWith(CONTEXT_PREFIX)
      ? source.slice(CONTEXT_PREFIX.length)
      : source;

    if (!PATH_RE.test(withoutContext)) {
      throw new HsmConfigurationError(
        `Invalid query source path "${source}". Use a context path like "tab" or "profile.tab".`
      );
    }

    return withoutContext;
  }

  public get(input: AnyRecord): unknown {
    let cursor: unknown = input;
    for (const part of this.parts) {
      if (!ObjectPath.isRecord(cursor)) return undefined;
      cursor = cursor[part];
    }
    return cursor;
  }

  public set<TContext extends AnyRecord>(input: TContext, value: unknown): TContext {
    return this.setAt(input, 0, value) as TContext;
  }

  private setAt(current: unknown, index: number, value: unknown): unknown {
    const part = this.parts[index];
    if (!part) return value;

    const base = ObjectPath.isRecord(current) ? current : {};
    const nextValue = this.setAt(base[part], index + 1, value);

    if (base[part] === nextValue) return base;
    return { ...base, [part]: nextValue };
  }

  private static isRecord(value: unknown): value is AnyRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
