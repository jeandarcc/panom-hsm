import type { HsmQueryType } from "../core/types.js";
import { HsmQueryParseError } from "../errors/HsmErrors.js";

export class QueryCodec {
  private constructor() {}

  public static decode(raw: unknown, type: HsmQueryType): unknown {
    if (raw === undefined) return undefined;

    switch (type) {
      case "string":
        return this.toSingleString(raw);
      case "number":
        return this.toNumber(raw);
      case "boolean":
        return this.toBoolean(raw);
      case "string[]":
        return this.toArray(raw).map((value) => String(value));
      case "number[]":
        return this.toArray(raw).map((value) => this.toNumber(value));
      case "boolean[]":
        return this.toArray(raw).map((value) => this.toBoolean(value));
      case "json":
        return this.toJson(raw);
      default: {
        const exhaustive: never = type;
        return exhaustive;
      }
    }
  }

  public static encode(value: unknown, type: HsmQueryType): string | readonly string[] | null {
    if (value === undefined || value === null) return null;

    switch (type) {
      case "string":
        return String(value);
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new HsmQueryParseError("", `Cannot encode non-finite number value: ${String(value)}`);
        }
        return String(value);
      case "boolean":
        if (typeof value !== "boolean") {
          throw new HsmQueryParseError("", `Cannot encode non-boolean value: ${String(value)}`);
        }
        return value ? "true" : "false";
      case "string[]":
        return this.expectArray(value).map((item) => String(item));
      case "number[]":
        return this.expectArray(value).map((item) => {
          if (typeof item !== "number" || !Number.isFinite(item)) {
            throw new HsmQueryParseError("", `Cannot encode non-finite number value: ${String(item)}`);
          }
          return String(item);
        });
      case "boolean[]":
        return this.expectArray(value).map((item) => {
          if (typeof item !== "boolean") {
            throw new HsmQueryParseError("", `Cannot encode non-boolean value: ${String(item)}`);
          }
          return item ? "true" : "false";
        });
      case "json":
        return JSON.stringify(value);
      default: {
        const exhaustive: never = type;
        return exhaustive;
      }
    }
  }

  private static toSingleString(raw: unknown): string {
    const values = this.toArray(raw);
    return String(values[0] ?? "");
  }

  private static toNumber(raw: unknown): number {
    const value = this.toSingleString(raw);
    if (value.trim() === "") {
      throw new HsmQueryParseError("", "Cannot decode an empty string as number.");
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new HsmQueryParseError("", `Cannot decode "${value}" as number.`);
    }
    return parsed;
  }

  private static toBoolean(raw: unknown): boolean {
    const value = this.toSingleString(raw).trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(value)) return true;
    if (["false", "0", "no", "off"].includes(value)) return false;
    throw new HsmQueryParseError("", `Cannot decode "${value}" as boolean.`);
  }

  private static toJson(raw: unknown): unknown {
    const value = this.toSingleString(raw);
    try {
      return JSON.parse(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown JSON parse error.";
      throw new HsmQueryParseError("", `Cannot decode JSON query value: ${message}`);
    }
  }

  private static toArray(raw: unknown): readonly unknown[] {
    if (Array.isArray(raw)) return raw;
    if (raw === undefined) return [];
    return [raw];
  }

  private static expectArray(value: unknown): readonly unknown[] {
    if (!Array.isArray(value)) {
      throw new HsmQueryParseError("", `Cannot encode non-array value: ${String(value)}`);
    }
    return value;
  }
}
