import type {
  AnyRecord,
  HsmQueryBinding,
  HsmQueryInvalidPolicy,
  HsmQueryType
} from "../core/types.js";
import { HsmQueryParseError } from "../errors/HsmErrors.js";
import { ObjectPath } from "./ObjectPath.js";
import { QueryCodec } from "./QueryCodec.js";
import { QueryEquality } from "./QueryEquality.js";

export interface QueryDecodeResult {
  readonly accepted: boolean;
  readonly value?: unknown;
}

export interface QueryProjectionResult {
  readonly key: string;
  readonly value: string | readonly string[] | null;
}

export class QueryBinding<TContext extends AnyRecord = AnyRecord> {
  public readonly schemaKey: string;
  public readonly queryKey: string;
  public readonly source: ObjectPath;
  public readonly type: HsmQueryType;
  public readonly expose: boolean;
  public readonly omitDefault: boolean;
  public readonly invalid: HsmQueryInvalidPolicy;
  public readonly defaultValue: unknown;

  private readonly config: HsmQueryBinding<TContext>;

  public constructor(schemaKey: string, config: HsmQueryBinding<TContext>) {
    this.schemaKey = schemaKey;
    this.config = config;
    this.queryKey = config.key ?? schemaKey;
    this.source = new ObjectPath(config.source ?? schemaKey);
    this.type = config.type ?? this.inferType(config.default);
    this.expose = config.expose ?? true;
    this.omitDefault = config.omitDefault ?? true;
    this.invalid = config.invalid ?? "default";
    this.defaultValue = config.default;
  }

  public readContext(context: TContext): unknown {
    const value = this.source.get(context);
    return value === undefined ? this.defaultValue : value;
  }

  public writeContext(context: TContext, value: unknown): TContext {
    return this.source.set(context, value);
  }

  public decode(rawQuery: AnyRecord, context: TContext): QueryDecodeResult {
    if (!Object.prototype.hasOwnProperty.call(rawQuery, this.queryKey)) {
      if (this.defaultValue === undefined) return { accepted: false };
      return { accepted: true, value: this.defaultValue };
    }

    try {
      const raw = rawQuery[this.queryKey];
      const decoded = this.config.decode
        ? this.config.decode({ key: this.queryKey, raw, context })
        : QueryCodec.decode(raw, this.type);

      const candidate = decoded === undefined ? this.defaultValue : decoded;
      if (!this.isValid(candidate, context)) {
        throw new HsmQueryParseError(this.queryKey, `Value failed validation: ${String(candidate)}`);
      }

      return { accepted: true, value: candidate };
    } catch (error) {
      if (this.invalid === "throw") {
        if (error instanceof HsmQueryParseError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new HsmQueryParseError(this.queryKey, message);
      }

      if (this.invalid === "ignore") return { accepted: false };
      if (this.defaultValue === undefined) return { accepted: false };
      return { accepted: true, value: this.defaultValue };
    }
  }

  public project(context: TContext): QueryProjectionResult | null {
    if (!this.expose) return null;

    const value = this.readContext(context);
    if (value === undefined || value === null) return { key: this.queryKey, value: null };
    if (this.omitDefault && QueryEquality.same(value, this.defaultValue)) {
      return { key: this.queryKey, value: null };
    }

    const encoded = this.config.encode
      ? this.config.encode({ key: this.queryKey, value, context })
      : QueryCodec.encode(value, this.type);

    if (encoded === undefined || encoded === null) return { key: this.queryKey, value: null };
    return { key: this.queryKey, value: encoded };
  }

  private isValid(value: unknown, context: TContext): boolean {
    if (!this.config.validate) return true;
    return this.config.validate({ key: this.queryKey, value, context });
  }

  private inferType(value: unknown): HsmQueryType {
    if (Array.isArray(value)) {
      const first = value.find((item) => item !== undefined && item !== null);
      if (typeof first === "number") return "number[]";
      if (typeof first === "boolean") return "boolean[]";
      return "string[]";
    }
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (value !== undefined && value !== null && typeof value === "object") return "json";
    return "string";
  }
}
