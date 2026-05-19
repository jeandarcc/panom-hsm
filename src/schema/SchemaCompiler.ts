import type {
  AnyRecord,
  HsmEventTransitionConfig,
  HsmMachineConfig,
  HsmPolicyDefinition,
  HsmPolicyDefinitions,
  HsmQueryBinding,
  HsmStateBackendConfig,
  HsmStateConfig
} from "../core/types.js";
import { StateTree } from "../core/StateTree.js";
import { RouteTable } from "../routing/RouteTable.js";
import type {
  HsmSchema,
  HsmSchemaActionProbe,
  HsmSchemaBackendPolicy,
  HsmSchemaCompileOptions,
  HsmSchemaEventMap,
  HsmSchemaEventTransition,
  HsmSchemaGuardProbe,
  HsmSchemaLoaderProbe,
  HsmSchemaPolicyDefinitions,
  HsmSchemaPolicyRule,
  HsmSchemaPolicySet,
  HsmSchemaQuery,
  HsmSchemaQueryBinding,
  HsmSchemaRefList,
  HsmSchemaRouteIndexEntry,
  HsmSchemaStateIndexEntry,
  HsmSchemaStateNode,
  JsonValue
} from "./HsmSchema.js";
import { HsmSchemaValidationError } from "./SchemaErrors.js";
import { checksum, normalizeRefList, optional, toJsonValue } from "./SchemaUtils.js";

type ExtendedStateConfig<TContext extends AnyRecord = AnyRecord> = HsmStateConfig<TContext> & {
  readonly backend?: HsmStateBackendConfig<TContext>;
};

export interface HsmCompiledSchemaDiagnostics {
  readonly guards: readonly HsmSchemaGuardProbe[];
  readonly actions: readonly HsmSchemaActionProbe[];
  readonly loaders: readonly HsmSchemaLoaderProbe[];
}

export class SchemaCompiler<TContext extends AnyRecord = AnyRecord> {
  private readonly guardProbes: HsmSchemaGuardProbe[] = [];
  private readonly actionProbes: HsmSchemaActionProbe[] = [];
  private readonly loaderProbes: HsmSchemaLoaderProbe[] = [];

  public compile(config: HsmMachineConfig<TContext>, options: HsmSchemaCompileOptions = {}): HsmSchema {
    this.guardProbes.length = 0;
    this.actionProbes.length = 0;
    this.loaderProbes.length = 0;

    const tree = new StateTree(config);
    const routeTable = new RouteTable(tree);
    const compiledPolicyDefinitions = config.policies ? this.compilePolicyDefinitions(config.policies) : undefined;
    const roots: Record<string, HsmSchemaStateNode> = {};

    for (const root of tree.roots) {
      roots[root.key] = this.compileState(root.key, root.id, null, (config.states[root.key] ?? {}) as ExtendedStateConfig<TContext>);
    }

    const stateIndex = tree.all.map<HsmSchemaStateIndexEntry>((node) => {
      const stateConfig = node.config as ExtendedStateConfig<TContext>;
      const entry: HsmSchemaStateIndexEntry = {
        id: node.id,
        key: node.key,
        parentId: node.parent?.id ?? null,
        depth: node.depth,
        tags: Object.freeze([...(node.config.tags ?? [])]),
        meta: Object.freeze({ ...(node.config.meta ?? {}) })
      };
      optional(entry, "initial", node.config.initial);
      optional(entry, "policies", this.compilePolicies(stateConfig));
      optional(entry, "backend", this.compileBackend(stateConfig.backend, `states.${node.id}.backend`, node.id));
      return Object.freeze(entry);
    });

    const routeIndex = routeTable.entries.map<HsmSchemaRouteIndexEntry>((entry) => Object.freeze({
      stateId: entry.stateId,
      pattern: entry.pattern,
      canonicalPattern: entry.canonicalPattern,
      kind: entry.kind,
      isAlias: entry.isAlias,
      redirectToCanonical: entry.redirectToCanonical,
      priority: entry.priority,
      score: entry.score
    }));

    const metadata = {
      ...(options.generatedAt === false ? {} : { generatedAt: options.generatedAt ?? new Date().toISOString() }),
      ...(options.source ? { source: options.source } : {}),
      ...(options.description ? { description: options.description } : {})
    };

    const schemaWithoutChecksum: Omit<HsmSchema, "metadata"> & { metadata?: Omit<NonNullable<HsmSchema["metadata"]>, "checksum"> } = {
      kind: "panom-hsm.schema",
      schemaVersion: "1.0",
      id: config.id,
      version: options.version ?? config.version ?? "0.0.0",
      states: Object.freeze(roots),
      index: Object.freeze({
        states: Object.freeze(stateIndex),
        routes: Object.freeze(routeIndex),
        guards: Object.freeze(this.unique(this.guardProbes.map((item) => item.guard))),
        actions: Object.freeze(this.unique(this.actionProbes.map((item) => item.action))),
        loaders: Object.freeze(this.unique(this.loaderProbes.map((item) => item.loader))),
        tags: Object.freeze(this.unique(tree.all.flatMap((node) => [...node.tags])))
      }),
      ...(config.initial ? { initial: config.initial } : {}),
      ...(config.query ? { query: this.compileQuery(config.query) } : {}),
      ...(compiledPolicyDefinitions ? { policies: compiledPolicyDefinitions } : {}),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {})
    };

    const schema: HsmSchema = Object.freeze({
      ...schemaWithoutChecksum,
      metadata: Object.freeze({
        ...(schemaWithoutChecksum.metadata ?? {}),
        checksum: checksum(schemaWithoutChecksum)
      })
    });

    return schema;
  }

  public diagnostics(): HsmCompiledSchemaDiagnostics {
    return Object.freeze({
      guards: Object.freeze([...this.guardProbes]),
      actions: Object.freeze([...this.actionProbes]),
      loaders: Object.freeze([...this.loaderProbes])
    });
  }

  private compileState(
    key: string,
    id: string,
    parentId: string | null,
    config: ExtendedStateConfig<TContext>
  ): HsmSchemaStateNode {
    const path = parentId ? `states.${id}` : `states.${key}`;
    const output: HsmSchemaStateNode = { key, id };

    optional(output, "path", config.path);
    optional(output, "url", config.url ? Object.freeze({ ...config.url }) : undefined);
    optional(output, "initial", config.initial);
    optional(output, "guard", this.trackGuard(normalizeRefList(config.guard, `${path}.guard`), id, "guard"));
    optional(output, "resolve", this.compileResolve(config.resolve, id, `${path}.resolve`));

    if (typeof config.redirect === "function") {
      normalizeRefList(config.redirect, `${path}.redirect`);
    }
    if (config.redirect !== undefined && typeof config.redirect !== "string") {
      throw new HsmSchemaValidationError(`Only string redirects can be serialized at "${path}.redirect".`);
    }
    optional(output, "redirect", config.redirect);

    optional(output, "beforeLeave", this.trackGuard(normalizeRefList(config.beforeLeave, `${path}.beforeLeave`), id, "beforeLeave"));
    optional(output, "beforeEnter", this.trackGuard(normalizeRefList(config.beforeEnter, `${path}.beforeEnter`), id, "beforeEnter"));
    optional(output, "entry", this.trackAction(normalizeRefList(config.entry, `${path}.entry`), id, "entry"));
    optional(output, "exit", this.trackAction(normalizeRefList(config.exit, `${path}.exit`), id, "exit"));
    optional(output, "onEnter", this.trackAction(normalizeRefList(config.onEnter, `${path}.onEnter`), id, "onEnter"));
    optional(output, "onLeave", this.trackAction(normalizeRefList(config.onLeave, `${path}.onLeave`), id, "onLeave"));
    optional(output, "afterEnter", this.trackAction(normalizeRefList(config.afterEnter, `${path}.afterEnter`), id, "afterEnter"));
    optional(output, "loader", this.trackLoader(normalizeRefList(config.loader, `${path}.loader`), id));
    optional(output, "on", this.compileEvents(config.on, id, `${path}.on`));
    optional(output, "tags", config.tags ? Object.freeze([...config.tags]) : undefined);
    optional(output, "meta", config.meta ? Object.freeze({ ...config.meta }) : undefined);
    optional(output, "policies", this.compilePolicies(config));
    optional(output, "backend", this.compileBackend(config.backend, `${path}.backend`, id));

    if (config.states) {
      const children: Record<string, HsmSchemaStateNode> = {};
      for (const [childKey, childConfig] of Object.entries(config.states)) {
        const childId = `${id}.${childKey}`;
        children[childKey] = this.compileState(childKey, childId, id, childConfig as ExtendedStateConfig<TContext>);
      }
      if (Object.keys(children).length > 0) optional(output, "states", Object.freeze(children));
    }

    return Object.freeze(output);
  }

  private compileResolve(
    rules: ExtendedStateConfig<TContext>["resolve"],
    stateId: string,
    path: string
  ): readonly import("./HsmSchema.js").HsmSchemaSelectionRule[] | undefined {
    if (!rules || rules.length === 0) return undefined;
    return Object.freeze(rules.map((rule, index) => {
      const guard = this.trackGuard(normalizeRefList(rule.guard, `${path}[${index}].guard`), stateId, "resolve");
      return Object.freeze({
        target: rule.target,
        ...(guard ? { guard } : {})
      });
    }));
  }

  private compileEvents(
    events: ExtendedStateConfig<TContext>["on"],
    stateId: string,
    path: string
  ): HsmSchemaEventMap | undefined {
    if (!events) return undefined;
    const output: Record<string, readonly HsmSchemaEventTransition[]> = {};
    for (const [eventName, transitionOrTransitions] of Object.entries(events)) {
      const transitions = Array.isArray(transitionOrTransitions) ? transitionOrTransitions : [transitionOrTransitions];
      output[eventName] = Object.freeze(transitions.map((transition, index) => {
        if (typeof transition === "string") {
          return Object.freeze({ target: transition });
        }
        const typed = transition as HsmEventTransitionConfig<TContext>;
        const guard = this.trackGuard(normalizeRefList(typed.guard, `${path}.${eventName}[${index}].guard`), stateId, "resolve");
        const actions = this.trackAction(normalizeRefList(typed.actions, `${path}.${eventName}[${index}].actions`), stateId, "event");
        const params = toJsonValue(typed.params, `${path}.${eventName}[${index}].params`);
        const context = toJsonValue(typed.context, `${path}.${eventName}[${index}].context`);
        const result: HsmSchemaEventTransition = { target: typed.target };
        optional(result, "guard", guard);
        optional(result, "actions", actions);
        optional(result, "params", params);
        optional(result, "context", context);
        return Object.freeze(result);
      }));
    }
    return Object.freeze(output);
  }

  private compileQuery(query: HsmMachineConfig<TContext>["query"]): HsmSchemaQuery {
    const output: Record<string, HsmSchemaQueryBinding> = {};
    if (!query) return Object.freeze(output);

    for (const [key, binding] of Object.entries(query)) {
      const item = binding as HsmQueryBinding<TContext>;
      if (item.encode) normalizeRefList(item.encode, `query.${key}.encode`);
      if (item.decode) normalizeRefList(item.decode, `query.${key}.decode`);
      if (item.validate) normalizeRefList(item.validate, `query.${key}.validate`);

      const defaultValue = toJsonValue(item.default, `query.${key}.default`);
      const compiled: HsmSchemaQueryBinding = {};
      optional(compiled, "source", item.source);
      optional(compiled, "key", item.key);
      optional(compiled, "type", item.type);
      optional(compiled, "default", defaultValue);
      optional(compiled, "expose", item.expose);
      optional(compiled, "omitDefault", item.omitDefault);
      optional(compiled, "invalid", item.invalid);
      output[key] = Object.freeze(compiled);
    }
    return Object.freeze(output);
  }

  private compilePolicies(config: ExtendedStateConfig<TContext>): HsmSchemaPolicySet | undefined {
    const policies: HsmSchemaPolicySet = {};
    optional(policies, "permissions", config.permissions ? Object.freeze([...config.permissions]) : undefined);
    optional(policies, "denyPermissions", config.denyPermissions ? Object.freeze([...config.denyPermissions]) : undefined);
    optional(policies, "capabilities", config.capabilities ? Object.freeze([...config.capabilities]) : undefined);
    optional(policies, "denyCapabilities", config.denyCapabilities ? Object.freeze([...config.denyCapabilities]) : undefined);
    optional(policies, "features", config.features ? Object.freeze([...config.features]) : undefined);
    optional(policies, "denyFeatures", config.denyFeatures ? Object.freeze([...config.denyFeatures]) : undefined);
    optional(policies, "layout", config.layout);
    return Object.keys(policies).length > 0 ? Object.freeze(policies) : undefined;
  }

  private compilePolicyDefinitions(definitions: HsmPolicyDefinitions<TContext>): HsmSchemaPolicyDefinitions {
    const output: HsmSchemaPolicyDefinitions = {};
    optional(output, "permissions", this.compilePolicyMap(definitions.permissions, "policies.permissions"));
    optional(output, "capabilities", this.compilePolicyMap(definitions.capabilities, "policies.capabilities"));
    optional(output, "features", this.compilePolicyMap(definitions.features, "policies.features"));
    return Object.freeze(output);
  }

  private compilePolicyMap(
    map: Record<string, HsmPolicyDefinition<TContext>> | undefined,
    path: string
  ): Record<string, HsmSchemaPolicyRule> | undefined {
    if (!map) return undefined;
    const output: Record<string, HsmSchemaPolicyRule> = {};
    for (const [key, definition] of Object.entries(map)) {
      output[key] = this.compilePolicyRule(definition, `${path}.${key}`, key);
    }
    return Object.freeze(output);
  }

  private compilePolicyRule(
    definition: HsmPolicyDefinition<TContext>,
    path: string,
    policyKey: string
  ): HsmSchemaPolicyRule {
    if (typeof definition === "boolean") return Object.freeze({ enabled: definition });

    if (typeof definition === "string" || typeof definition === "function" || Array.isArray(definition)) {
      const output: HsmSchemaPolicyRule = {};
      optional(output, "guard", this.trackGuard(normalizeRefList(definition, `${path}.guard`), policyKey, "policy"));
      return Object.freeze(output);
    }

    const typed = definition as import("../core/types.js").HsmPolicyRule<TContext>;
    const output: HsmSchemaPolicyRule = {};
    optional(output, "guard", this.trackGuard(normalizeRefList(typed.guard, `${path}.guard`), policyKey, "policy"));
    optional(output, "description", typed.description);
    optional(output, "tags", typed.tags ? Object.freeze([...typed.tags]) : undefined);
    optional(output, "meta", typed.meta ? toJsonValue(typed.meta, `${path}.meta`) as Record<string, JsonValue> : undefined);
    return Object.freeze(output);
  }

  private compileBackend(policy: HsmStateBackendConfig<TContext> | undefined, path: string, stateId: string): HsmSchemaBackendPolicy | undefined {
    if (!policy) return undefined;
    const output: HsmSchemaBackendPolicy = {};
    optional(output, "routes", policy.routes ? Object.freeze([...policy.routes]) : undefined);
    optional(output, "methods", policy.methods ? Object.freeze(policy.methods.map((method) => method.toUpperCase())) : undefined);
    optional(output, "guards", this.trackGuard(normalizeRefList(policy.guards, `${path}.guards`), stateId, "backend"));
    optional(output, "meta", policy.meta ? toJsonValue(policy.meta, `${path}.meta`) as Record<string, JsonValue> : undefined);
    return Object.keys(output).length > 0 ? Object.freeze(output) : undefined;
  }

  private trackGuard(ref: HsmSchemaRefList | undefined, stateId: string, phase: HsmSchemaGuardProbe["phase"]): HsmSchemaRefList | undefined {
    if (!ref) return undefined;
    for (const guard of ref.refs) this.guardProbes.push(Object.freeze({ stateId, guard, phase }));
    return ref;
  }

  private trackAction(ref: HsmSchemaRefList | undefined, stateId: string, phase: HsmSchemaActionProbe["phase"]): HsmSchemaRefList | undefined {
    if (!ref) return undefined;
    for (const action of ref.refs) this.actionProbes.push(Object.freeze({ stateId, action, phase }));
    return ref;
  }

  private trackLoader(ref: HsmSchemaRefList | undefined, stateId: string): HsmSchemaRefList | undefined {
    if (!ref) return undefined;
    for (const loader of ref.refs) this.loaderProbes.push(Object.freeze({ stateId, loader }));
    return ref;
  }

  private unique(values: readonly string[]): readonly string[] {
    return Object.freeze([...new Set(values)].sort());
  }
}

export function compileSchema<TContext extends AnyRecord = AnyRecord>(
  config: HsmMachineConfig<TContext>,
  options: HsmSchemaCompileOptions = {}
): HsmSchema {
  return new SchemaCompiler<TContext>().compile(config, options);
}

export function defineHsm<TContext extends AnyRecord = AnyRecord>(
  config: HsmMachineConfig<TContext>
): HsmMachineConfig<TContext> {
  return config;
}
