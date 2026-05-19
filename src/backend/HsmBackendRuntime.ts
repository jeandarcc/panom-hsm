import type { AnyRecord } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import { HsmGuardRejectedError, HsmRouteNotFoundError, HsmQueryParseError } from "../errors/HsmErrors.js";
import { createHsmFromSchema } from "../schema/createHsmFromSchema.js";
import type { HsmSchema, HsmSchemaStateIndexEntry } from "../schema/HsmSchema.js";
import { refsToRuntime } from "../schema/SchemaUtils.js";
import { SchemaValidator } from "../schema/SchemaValidator.js";
import { RequestResolver } from "./RequestResolver.js";
import { BackendPolicyEnforcer } from "./BackendPolicyEnforcer.js";
import type {
  HsmBackendMiddleware,
  HsmBackendMiddlewareOptions,
  HsmBackendRequest,
  HsmBackendResolveFailure,
  HsmBackendResolveOptions,
  HsmBackendResolveResult,
  HsmBackendRuntimeConfig
} from "./types.js";

export class HsmBackendRuntime<
  TContext extends AnyRecord = AnyRecord,
  TRequest extends HsmBackendRequest = HsmBackendRequest
> {
  public readonly schema: HsmSchema;
  public readonly hsm: HsmMachine<TContext>;

  private readonly requestResolver = new RequestResolver();
  private readonly policyEnforcer = new BackendPolicyEnforcer<TContext>();
  private readonly stateIndex = new Map<string, HsmSchemaStateIndexEntry>();
  private readonly config: HsmBackendRuntimeConfig<TContext, TRequest>;

  public constructor(config: HsmBackendRuntimeConfig<TContext, TRequest>) {
    const validator: SchemaValidator = new SchemaValidator();
    validator.assertValid(config.schema);
    this.schema = config.schema;
    this.config = config;
    for (const state of config.schema.index.states) {
      this.stateIndex.set(state.id, state);
    }
    const runtimeOptions: Parameters<typeof createHsmFromSchema<TContext>>[1] = {};
    if (config.guards !== undefined) Object.assign(runtimeOptions, { guards: config.guards });
    if (config.actions !== undefined) Object.assign(runtimeOptions, { actions: config.actions });
    if (config.loaders !== undefined) Object.assign(runtimeOptions, { loaders: config.loaders });
    this.hsm = createHsmFromSchema<TContext>(config.schema, runtimeOptions);
  }

  public async resolveRequest(
    request: TRequest,
    options: HsmBackendResolveOptions<TContext> = {}
  ): Promise<HsmBackendResolveResult<TContext>> {
    const normalized = this.requestResolver.normalize(request);

    try {
      const context = await this.contextFor(request, normalized.url, normalized.method, options.context);
      const resolveOptions = {
        context,
        canonicalizeAliases: true,
        preserveUnknownQuery: true,
        ...(this.config.resolveOptions ?? {}),
        ...(options.resolveOptions ?? {})
      };
      const baseUrl = options.baseUrl ?? this.config.baseUrl;
      if (baseUrl !== undefined) Object.assign(resolveOptions, { baseUrl });
      const snapshot = await this.hsm.resolveUrl(normalized.url, resolveOptions);

      const state = this.stateIndex.get(snapshot.stateId);
      if (!state) {
        throw new Error(`Schema index does not contain resolved state "${snapshot.stateId}".`);
      }

      const methodAllowed = this.isMethodAllowed(snapshot.activePath, normalized.method);
      if (!methodAllowed) {
        return this.fail(request, normalized, "method_not_allowed", 405, new Error(`Method ${normalized.method} is not allowed for ${snapshot.stateId}.`), options.strict);
      }

      const stateAllowed = this.matchesRequiredState(snapshot.stateId, snapshot.activePath, options.requireState);
      if (!stateAllowed) {
        return this.fail(request, normalized, "backend_guard_failed", 403, new Error(`Resolved state ${snapshot.stateId} does not satisfy required state.`), options.strict);
      }

      const tagAllowed = this.matchesRequiredTag([...snapshot.tags], options.requireTag);
      if (!tagAllowed) {
        return this.fail(request, normalized, "backend_guard_failed", 403, new Error(`Resolved state ${snapshot.stateId} does not satisfy required tag.`), options.strict);
      }

      const policyFailure = this.policyEnforcer.checkAll(snapshot, {
        ...(options.requirePermission ? { permissions: options.requirePermission } : {}),
        ...(options.requireCapability ? { capabilities: options.requireCapability } : {}),
        ...(options.requireFeature ? { features: options.requireFeature } : {})
      });
      if (policyFailure) {
        return this.fail(request, normalized, policyFailure.reason, policyFailure.status, new Error(policyFailure.message), options.strict);
      }

      await this.runBackendGuards(snapshot.activePath, context, snapshot.params, normalized.method);

      const syncOptions = { preserveUnknownQuery: true, canonicalizePath: true };
      const syncBaseUrl = options.baseUrl ?? this.config.baseUrl;
      if (syncBaseUrl !== undefined) Object.assign(syncOptions, { baseUrl: syncBaseUrl });
      const canonicalUrl = this.hsm.syncUrl(normalized.url, snapshot.context as TContext, syncOptions);

      return Object.freeze({
        ok: true,
        request,
        method: normalized.method,
        url: normalized.url,
        snapshot,
        state,
        canonicalUrl
      });
    } catch (error) {
      if (error instanceof HsmRouteNotFoundError) {
        return this.fail(request, normalized, "route_not_found", 404, error, options.strict);
      }
      if (error instanceof HsmQueryParseError) {
        return this.fail(request, normalized, "query_invalid", 400, error, options.strict);
      }
      if (error instanceof HsmGuardRejectedError) {
        return this.fail(request, normalized, "guard_failed", 403, error, options.strict);
      }
      return this.fail(request, normalized, "error", 500, error, options.strict);
    }
  }

  public async assertRequest(
    request: TRequest,
    options: HsmBackendResolveOptions<TContext> = {}
  ): Promise<Extract<HsmBackendResolveResult<TContext>, { ok: true }>> {
    const result = await this.resolveRequest(request, { ...options, strict: true });
    if (!result.ok) throw result.error;
    return result;
  }

  public middleware(options: HsmBackendMiddlewareOptions<TContext> = {}): HsmBackendMiddleware<TRequest> {
    return async (req, res, next) => {
      const result = await this.resolveRequest(req, options);
      if (result.ok) {
        Object.assign(req, { [options.attachTo ?? "hsm"]: result });
        next();
        return;
      }

      const response = res.status?.(result.status) ?? res;
      const body = options.exposeErrorBody === false
        ? { error: result.reason }
        : { error: result.reason, message: result.error instanceof Error ? result.error.message : String(result.error) };
      if (response.json) {
        response.json(body);
        return;
      }
      if (response.send) {
        response.send(body);
        return;
      }
      if (response.end) response.end();
    };
  }

  public requireState(state: string | readonly string[], options: HsmBackendMiddlewareOptions<TContext> = {}): HsmBackendMiddleware<TRequest> {
    return this.middleware({ ...options, requireState: state });
  }

  public requireTag(tag: string | readonly string[], options: HsmBackendMiddlewareOptions<TContext> = {}): HsmBackendMiddleware<TRequest> {
    return this.middleware({ ...options, requireTag: tag });
  }

  public requirePermission(permission: string | readonly string[], options: HsmBackendMiddlewareOptions<TContext> = {}): HsmBackendMiddleware<TRequest> {
    return this.middleware({ ...options, requirePermission: permission });
  }

  public requireCapability(capability: string | readonly string[], options: HsmBackendMiddlewareOptions<TContext> = {}): HsmBackendMiddleware<TRequest> {
    return this.middleware({ ...options, requireCapability: capability });
  }

  public requireFeature(feature: string | readonly string[], options: HsmBackendMiddlewareOptions<TContext> = {}): HsmBackendMiddleware<TRequest> {
    return this.middleware({ ...options, requireFeature: feature });
  }

  public async assertPermission(
    request: TRequest,
    permission: string | readonly string[],
    options: HsmBackendResolveOptions<TContext> = {}
  ): Promise<Extract<HsmBackendResolveResult<TContext>, { ok: true }>> {
    return this.assertRequest(request, { ...options, requirePermission: permission });
  }

  private async contextFor(
    request: TRequest,
    url: string,
    method: string,
    override: TContext | undefined
  ): Promise<TContext> {
    if (override) return override;
    const source = this.config.context;
    if (typeof source === "function") {
      return source({ request, url, method, schema: this.schema });
    }
    return (source ?? {}) as TContext;
  }

  private isMethodAllowed(activePath: readonly string[], method: string): boolean {
    for (const stateId of [...activePath].reverse()) {
      const methods = this.stateIndex.get(stateId)?.backend?.methods;
      if (methods && methods.length > 0) return methods.includes(method.toUpperCase());
    }
    return true;
  }

  private async runBackendGuards(
    activePath: readonly string[],
    context: TContext,
    params: AnyRecord,
    method: string
  ): Promise<void> {
    for (const stateId of activePath) {
      const state = this.stateIndex.get(stateId);
      const guardRef = refsToRuntime(state?.backend?.guards);
      if (!guardRef) continue;
      const node = this.hsm.tree.get(stateId);
      await this.hsm.guards.assertAll({
        context,
        state: node,
        stateId,
        params,
        meta: node.meta,
        event: { type: `backend.${method}` }
      }, guardRef);
    }
  }

  private matchesRequiredState(
    stateId: string,
    activePath: readonly string[],
    required: string | readonly string[] | undefined
  ): boolean {
    if (!required) return true;
    const requiredList = Array.isArray(required) ? required : [required];
    return requiredList.some((item) => stateId === item || activePath.includes(item));
  }

  private matchesRequiredTag(tags: readonly string[], required: string | readonly string[] | undefined): boolean {
    if (!required) return true;
    const requiredList = Array.isArray(required) ? required : [required];
    return requiredList.every((tag) => tags.includes(tag));
  }

  private fail(
    request: TRequest,
    normalized: { readonly method: string; readonly url: string },
    reason: HsmBackendResolveFailure["reason"],
    status: number,
    error: unknown,
    strict: boolean | undefined
  ): HsmBackendResolveFailure {
    if (strict) throw error;
    return Object.freeze({ ok: false, request, method: normalized.method, url: normalized.url, reason, status, error });
  }
}

export function createHsmBackend<
  TContext extends AnyRecord = AnyRecord,
  TRequest extends HsmBackendRequest = HsmBackendRequest
>(config: HsmBackendRuntimeConfig<TContext, TRequest>): HsmBackendRuntime<TContext, TRequest> {
  return new HsmBackendRuntime(config);
}
