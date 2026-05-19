import type {
  AnyRecord,
  HsmQuerySchema,
  HsmUrlState
} from "../core/types.js";
import { HsmConfigurationError } from "../errors/HsmErrors.js";
import { QueryBinding } from "./QueryBinding.js";

export interface QueryHydrationResult<TContext extends AnyRecord = AnyRecord> {
  readonly context: TContext;
  readonly urlState: HsmUrlState<TContext>;
}

export interface QueryProjectionOptions {
  readonly preserveQuery?: AnyRecord;
}

export class UrlStateProjector<TContext extends AnyRecord = AnyRecord> {
  private readonly bindings: readonly QueryBinding<TContext>[];
  private readonly ownedKeys: ReadonlySet<string>;

  public constructor(schema: HsmQuerySchema<TContext> | undefined) {
    this.bindings = Object.freeze(this.compile(schema));
    this.ownedKeys = new Set(this.bindings.map((binding) => binding.queryKey));
  }

  public get enabled(): boolean {
    return this.bindings.length > 0;
  }

  public hydrate(rawQuery: AnyRecord, baseContext: TContext): QueryHydrationResult<TContext> {
    let context = baseContext;
    const decoded: AnyRecord = {};

    for (const binding of this.bindings) {
      const result = binding.decode(rawQuery, context);
      if (!result.accepted) continue;
      decoded[binding.queryKey] = result.value;
      context = binding.writeContext(context, result.value);
    }

    const projected = this.project(context);
    const unknown = this.unknown(rawQuery);

    return {
      context,
      urlState: Object.freeze({
        raw: Object.freeze({ ...rawQuery }),
        decoded: Object.freeze(decoded),
        unknown: Object.freeze(unknown),
        projected: Object.freeze(projected),
        context: Object.freeze({ ...context })
      })
    };
  }

  public project(context: TContext, options: QueryProjectionOptions = {}): AnyRecord {
    const output: AnyRecord = options.preserveQuery ? { ...options.preserveQuery } : {};

    for (const key of this.ownedKeys) {
      delete output[key];
    }

    for (const binding of this.bindings) {
      const projected = binding.project(context);
      if (!projected) continue;
      if (projected.value === null) {
        delete output[projected.key];
        continue;
      }
      output[projected.key] = projected.value;
    }

    return output;
  }

  public unknown(rawQuery: AnyRecord): AnyRecord {
    const output: AnyRecord = {};
    for (const [key, value] of Object.entries(rawQuery)) {
      if (!this.ownedKeys.has(key)) output[key] = value;
    }
    return output;
  }

  private compile(schema: HsmQuerySchema<TContext> | undefined): QueryBinding<TContext>[] {
    if (!schema) return [];

    const bindings = Object.entries(schema).map(
      ([schemaKey, binding]) => new QueryBinding<TContext>(schemaKey, binding)
    );

    const seen = new Map<string, string>();
    for (const binding of bindings) {
      const owner = seen.get(binding.queryKey);
      if (owner) {
        throw new HsmConfigurationError(
          `Query key "${binding.queryKey}" is bound by both "${owner}" and "${binding.schemaKey}".`
        );
      }
      seen.set(binding.queryKey, binding.schemaKey);
    }

    return bindings;
  }
}
