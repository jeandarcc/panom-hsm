import type {
  AnyRecord,
  HsmActionMap,
  HsmGuardMap,
  HsmLoaderMap,
  HsmMachineConfig,
  HsmPolicyDefinitions,
  HsmQuerySchema,
  HsmStateConfig
} from "../core/types.js";
import type { HsmSchema, HsmSchemaEventMap, HsmSchemaStateNode, HsmSchemaRuntimeOptions } from "./HsmSchema.js";
import { refsToRuntime } from "./SchemaUtils.js";

export class SchemaConfigFactory<TContext extends AnyRecord = AnyRecord> {
  public fromSchema(schema: HsmSchema, options: HsmSchemaRuntimeOptions<TContext> = {}): HsmMachineConfig<TContext> {
    const states: Record<string, HsmStateConfig<TContext>> = {};
    for (const [key, state] of Object.entries(schema.states)) {
      states[key] = this.stateFromSchema(state);
    }

    const config: HsmMachineConfig<TContext> = {
      id: schema.id,
      states
    };

    if (schema.initial !== undefined) Object.assign(config, { initial: schema.initial });
    if (options.context !== undefined) Object.assign(config, { context: options.context });
    if (options.guards !== undefined) Object.assign(config, { guards: options.guards as HsmGuardMap<TContext> });
    if (options.actions !== undefined) Object.assign(config, { actions: options.actions as HsmActionMap<TContext> });
    if (options.loaders !== undefined) Object.assign(config, { loaders: options.loaders as HsmLoaderMap<TContext> });
    if (schema.query !== undefined) Object.assign(config, { query: schema.query as HsmQuerySchema<TContext> });
    if (schema.policies !== undefined) Object.assign(config, { policies: this.policiesFromSchema(schema.policies) });

    return config;
  }

  private stateFromSchema(state: HsmSchemaStateNode): HsmStateConfig<TContext> {
    const config: HsmStateConfig<TContext> = {};

    if (state.path !== undefined) Object.assign(config, { path: state.path });
    if (state.url !== undefined) Object.assign(config, { url: state.url });
    if (state.initial !== undefined) Object.assign(config, { initial: state.initial });
    if (state.guard !== undefined) Object.assign(config, { guard: refsToRuntime(state.guard) });
    if (state.resolve !== undefined) {
      Object.assign(config, {
        resolve: state.resolve.map((rule) => ({
          target: rule.target,
          ...(rule.guard ? { guard: refsToRuntime(rule.guard) } : {})
        }))
      });
    }
    if (state.redirect !== undefined) Object.assign(config, { redirect: state.redirect });
    if (state.beforeLeave !== undefined) Object.assign(config, { beforeLeave: refsToRuntime(state.beforeLeave) });
    if (state.beforeEnter !== undefined) Object.assign(config, { beforeEnter: refsToRuntime(state.beforeEnter) });
    if (state.entry !== undefined) Object.assign(config, { entry: refsToRuntime(state.entry) });
    if (state.exit !== undefined) Object.assign(config, { exit: refsToRuntime(state.exit) });
    if (state.onEnter !== undefined) Object.assign(config, { onEnter: refsToRuntime(state.onEnter) });
    if (state.onLeave !== undefined) Object.assign(config, { onLeave: refsToRuntime(state.onLeave) });
    if (state.afterEnter !== undefined) Object.assign(config, { afterEnter: refsToRuntime(state.afterEnter) });
    if (state.loader !== undefined) Object.assign(config, { loader: refsToRuntime(state.loader) });
    if (state.on !== undefined) Object.assign(config, { on: this.eventsFromSchema(state.on) });
    if (state.tags !== undefined) Object.assign(config, { tags: [...state.tags] });
    if (state.meta !== undefined) Object.assign(config, { meta: { ...state.meta } });
    if (state.policies?.permissions !== undefined) Object.assign(config, { permissions: [...state.policies.permissions] });
    if (state.policies?.denyPermissions !== undefined) Object.assign(config, { denyPermissions: [...state.policies.denyPermissions] });
    if (state.policies?.capabilities !== undefined) Object.assign(config, { capabilities: [...state.policies.capabilities] });
    if (state.policies?.denyCapabilities !== undefined) Object.assign(config, { denyCapabilities: [...state.policies.denyCapabilities] });
    if (state.policies?.features !== undefined) Object.assign(config, { features: [...state.policies.features] });
    if (state.policies?.denyFeatures !== undefined) Object.assign(config, { denyFeatures: [...state.policies.denyFeatures] });
    if (state.policies?.layout !== undefined) Object.assign(config, { layout: state.policies.layout });
    if (state.backend !== undefined) {
      Object.assign(config, {
        backend: {
          ...(state.backend.routes ? { routes: [...state.backend.routes] } : {}),
          ...(state.backend.methods ? { methods: [...state.backend.methods] } : {}),
          ...(state.backend.guards ? { guards: refsToRuntime(state.backend.guards) } : {}),
          ...(state.backend.meta ? { meta: { ...state.backend.meta } } : {})
        }
      });
    }

    if (state.states !== undefined) {
      const children: Record<string, HsmStateConfig<TContext>> = {};
      for (const [key, child] of Object.entries(state.states)) {
        children[key] = this.stateFromSchema(child);
      }
      Object.assign(config, { states: children });
    }

    return config;
  }

  private policiesFromSchema(schema: NonNullable<HsmSchema["policies"]>): HsmPolicyDefinitions<TContext> {
    const output: HsmPolicyDefinitions<TContext> = {};
    if (schema.permissions) Object.assign(output, { permissions: this.policyMapFromSchema(schema.permissions) });
    if (schema.capabilities) Object.assign(output, { capabilities: this.policyMapFromSchema(schema.capabilities) });
    if (schema.features) Object.assign(output, { features: this.policyMapFromSchema(schema.features) });
    return output;
  }

  private policyMapFromSchema(map: NonNullable<NonNullable<HsmSchema["policies"]>["permissions"]>): NonNullable<HsmPolicyDefinitions<TContext>["permissions"]> {
    const output: NonNullable<HsmPolicyDefinitions<TContext>["permissions"]> = {};
    for (const [key, rule] of Object.entries(map)) {
      if (rule.enabled !== undefined && !rule.guard) {
        output[key] = rule.enabled;
        continue;
      }
      const definition: AnyRecord = {};
      if (rule.guard) definition.guard = refsToRuntime(rule.guard);
      if (rule.description) definition.description = rule.description;
      if (rule.tags) definition.tags = [...rule.tags];
      if (rule.meta) definition.meta = { ...rule.meta };
      output[key] = definition as NonNullable<HsmPolicyDefinitions<TContext>["permissions"]>[string];
    }
    return output;
  }

  private eventsFromSchema(events: HsmSchemaEventMap): NonNullable<HsmStateConfig<TContext>["on"]> {
    const output: NonNullable<HsmStateConfig<TContext>["on"]> = {};
    for (const [eventName, transitions] of Object.entries(events)) {
      Object.assign(output, {
        [eventName]: transitions.map((transition) => ({
          target: transition.target,
          ...(transition.guard ? { guard: refsToRuntime(transition.guard) } : {}),
          ...(transition.actions ? { actions: refsToRuntime(transition.actions) } : {}),
          ...(transition.params !== undefined ? { params: transition.params as AnyRecord } : {}),
          ...(transition.context !== undefined ? { context: transition.context as Partial<TContext> } : {})
        }))
      });
    }
    return output;
  }
}
