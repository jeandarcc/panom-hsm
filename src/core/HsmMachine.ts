import type {
  AnyRecord,
  HsmEvent,
  HsmHrefOptions,
  HsmMachineConfig,
  HsmPolicyDecision,
  HsmResolvedRedirect,
  HsmResolvedState,
  HsmResolveOptions,
  HsmRouteEntry,
  HsmRouteMatch,
  HsmSnapshot,
  HsmTransitionOptions,
  HsmTransitionResult,
  HsmUrlResolveOptions,
  HsmUrlState,
  HsmUrlSyncOptions,
  HsmUrlTransitionOptions
} from "./types.js";
import { StateTree } from "./StateTree.js";
import { GuardRegistry } from "../guards/GuardRegistry.js";
import { ActionRegistry } from "../actions/ActionRegistry.js";
import { LoaderRegistry } from "../loaders/LoaderRegistry.js";
import { LoaderRunner } from "../loaders/LoaderRunner.js";
import { EventDispatcher } from "../events/EventDispatcher.js";
import { StateResolver } from "../resolution/StateResolver.js";
import { SnapshotFactory } from "./SnapshotFactory.js";
import { RouteTable } from "../routing/RouteTable.js";
import {
  HsmGuardRejectedError,
  HsmRedirectLoopError,
  HsmRouteBuildError,
  HsmRouteNotFoundError,
  HsmUnresolvedStateError
} from "../errors/HsmErrors.js";
import { UrlTools } from "../routing/UrlTools.js";
import { PathComposer } from "../routing/PathComposer.js";
import { UrlStateProjector, type QueryHydrationResult } from "../query/UrlStateProjector.js";
import { deepMerge } from "../utils/merge.js";
import { TransitionPlanner } from "../transitions/TransitionPlanner.js";
import { TransitionLifecycle } from "../transitions/TransitionLifecycle.js";
import { TransitionAbortController } from "../transitions/TransitionAbortController.js";
import { TransitionManager } from "../transitions/TransitionManager.js";
import { TransitionResultFactory } from "../transitions/TransitionResultFactory.js";
import { PolicyEngine } from "../policy/PolicyEngine.js";

export class HsmMachine<TContext extends AnyRecord = AnyRecord> {
  public readonly id: string;
  public readonly tree: StateTree<TContext>;
  public readonly guards: GuardRegistry<TContext>;
  public readonly actions: ActionRegistry<TContext>;
  public readonly loaders: LoaderRegistry<TContext>;
  public readonly routeTable: RouteTable<TContext>;
  public readonly urlState: UrlStateProjector<TContext>;
  public readonly policy: PolicyEngine<TContext>;

  private readonly resolver: StateResolver<TContext>;
  private readonly snapshots: SnapshotFactory<TContext>;
  private readonly initialStateKey: string | undefined;
  private readonly contextSource: HsmMachineConfig<TContext>["context"];
  private readonly transitionAbort = new TransitionAbortController();
  private readonly transitions: TransitionManager<TContext>;
  private readonly events: EventDispatcher<TContext>;
  private readonly results = new TransitionResultFactory<TContext>();
  private currentSnapshot: HsmSnapshot<TContext> | null = null;

  public constructor(config: HsmMachineConfig<TContext>) {
    this.id = config.id;
    this.initialStateKey = config.initial;
    this.contextSource = config.context;
    this.tree = new StateTree(config);
    this.guards = new GuardRegistry(config.guards);
    this.actions = new ActionRegistry(config.actions);
    this.loaders = new LoaderRegistry(config.loaders);
    this.resolver = new StateResolver(this.tree, this.guards);
    this.snapshots = new SnapshotFactory(this.id);
    this.routeTable = new RouteTable(this.tree);
    this.urlState = new UrlStateProjector(config.query);
    this.policy = new PolicyEngine(this.tree, this.guards, config.policies);

    const planner = new TransitionPlanner(this.tree);
    const lifecycle = new TransitionLifecycle(this.guards, this.actions);
    const loaderRunner = new LoaderRunner(this.loaders);
    this.transitions = new TransitionManager(planner, lifecycle, loaderRunner, this.snapshots, this.results);
    this.events = new EventDispatcher(this.tree, this.guards);
  }

  public get current(): HsmSnapshot<TContext> | null {
    return this.currentSnapshot;
  }

  public async start(options: HsmResolveOptions<TContext> = {}): Promise<HsmSnapshot<TContext>> {
    const context = await this.getContext(options.context);
    const resolveOptions: { params?: AnyRecord; expandInitial?: boolean } = {};
    if (options.params) resolveOptions.params = options.params;
    if (options.expandInitial !== undefined) resolveOptions.expandInitial = options.expandInitial;

    const resolved = await this.resolver.resolveInitial(this.initialStateKey, context, resolveOptions);
    const snapshot = await this.createSnapshot(this.attachProjectedUrlState(resolved, {}, context));
    this.currentSnapshot = snapshot;
    return snapshot;
  }

  public async resolve(
    stateId: string,
    options: HsmResolveOptions<TContext> = {}
  ): Promise<HsmSnapshot<TContext>> {
    const context = await this.getContext(options.context);
    const resolved = await this.resolver.resolve(stateId, context, options);
    return this.createSnapshot(this.attachProjectedUrlState(resolved, {}, context));
  }

  public async transition(
    stateId: string,
    options: HsmTransitionOptions<TContext> = {}
  ): Promise<HsmTransitionResult<TContext>> {
    const cause = options.cause ?? "state";
    const controller = this.transitionAbort.next(options.signal);

    try {
      const context = deepMerge(await this.getRuntimeContext(options.context), options.contextPatch);
      const resolveOptions: HsmResolveOptions<TContext> = { context };
      if (options.params !== undefined) Object.assign(resolveOptions, { params: options.params });
      if (options.expandInitial !== undefined) Object.assign(resolveOptions, { expandInitial: options.expandInitial });
      const resolved = await this.resolver.resolve(stateId, context, resolveOptions);
      const result = await this.transitions.run({
        from: this.currentSnapshot,
        resolved: await this.withPolicy(this.attachProjectedUrlState(resolved, {}, context)),
        signal: controller.signal,
        cause,
        ...(options.event ? { event: options.event } : {}),
        ...(options.skipLifecycle !== undefined ? { skipLifecycle: options.skipLifecycle } : {}),
        commit: (snapshot) => {
          this.currentSnapshot = snapshot;
        }
      });
      return this.finishTransitionResult(result, options.strict);
    } catch (error) {
      return this.finishTransitionResult(
        this.results.failure({ cause, from: this.currentSnapshot, targetStateId: stateId, error }),
        options.strict
      );
    } finally {
      this.transitionAbort.clear(controller);
    }
  }

  public async resolveUrl(
    input: string,
    options: HsmUrlResolveOptions<TContext> = {}
  ): Promise<HsmSnapshot<TContext>> {
    const followRedirects = options.followRedirects ?? true;
    const maxRedirects = options.maxRedirects ?? 10;
    const baseContext = await this.getContext(options.context);

    let current = input;
    let redirects = 0;

    while (true) {
      const attempt = await this.resolveAcceptedRoute(current, baseContext, options);

      if (attempt.redirect) {
        if (!followRedirects) {
          return this.createSnapshot(
            this.attachUrlState(attempt.resolved, attempt.hydration.urlState),
            attempt.redirect
          );
        }

        redirects += 1;
        if (redirects > maxRedirects) {
          throw new HsmRedirectLoopError(input, maxRedirects);
        }
        current = attempt.redirect.to;
        continue;
      }

      return this.createSnapshot(this.attachUrlState(attempt.resolved, attempt.hydration.urlState));
    }
  }

  public async transitionUrl(
    input: string,
    options: HsmUrlTransitionOptions<TContext> = {}
  ): Promise<HsmTransitionResult<TContext>> {
    const cause = options.cause ?? "url";
    const controller = this.transitionAbort.next(options.signal);

    try {
      const followRedirects = options.followRedirects ?? true;
      const maxRedirects = options.maxRedirects ?? 10;
      const baseContext = deepMerge(await this.getRuntimeContext(options.context), options.contextPatch);
      let current = input;
      let redirects = 0;

      while (true) {
        const attempt = await this.resolveAcceptedRoute(current, baseContext, options);
        if (attempt.redirect && followRedirects) {
          redirects += 1;
          if (redirects > maxRedirects) throw new HsmRedirectLoopError(input, maxRedirects);
          current = attempt.redirect.to;
          continue;
        }

        const result = await this.transitions.run({
          from: this.currentSnapshot,
          resolved: await this.withPolicy(this.attachUrlState(attempt.resolved, attempt.hydration.urlState)),
          signal: controller.signal,
          cause,
          ...(options.event ? { event: options.event } : {}),
          ...(options.skipLifecycle !== undefined ? { skipLifecycle: options.skipLifecycle } : {}),
          ...(attempt.redirect ? { redirect: attempt.redirect } : {}),
          commit: (snapshot) => {
            this.currentSnapshot = snapshot;
          }
        });
        return this.finishTransitionResult(result, options.strict);
      }
    } catch (error) {
      return this.finishTransitionResult(
        this.results.failure({ cause, from: this.currentSnapshot, error }),
        options.strict
      );
    } finally {
      this.transitionAbort.clear(controller);
    }
  }

  public async navigate(
    input: string,
    options: HsmUrlTransitionOptions<TContext> = {}
  ): Promise<HsmSnapshot<TContext>> {
    const result = await this.transitionUrl(input, { ...options, strict: true, cause: options.cause ?? "url" });
    if (!result.ok) throw result.error;
    return result.snapshot;
  }

  public async send(
    eventOrType: HsmEvent | string,
    payloadOrOptions?: unknown,
    maybeOptions: HsmTransitionOptions<TContext> = {}
  ): Promise<HsmTransitionResult<TContext>> {
    const { event, options } = this.normalizeSendArgs(eventOrType, payloadOrOptions, maybeOptions);
    const cause = options.cause ?? "event";

    try {
      if (!this.currentSnapshot) {
        const startOptions: HsmResolveOptions<TContext> = {};
        if (options.context !== undefined) Object.assign(startOptions, { context: options.context });
        if (options.expandInitial !== undefined) Object.assign(startOptions, { expandInitial: options.expandInitial });
        await this.start(startOptions);
      }
      const from = this.currentSnapshot;
      if (!from) throw new Error("HSM failed to initialize before event dispatch.");

      const context = deepMerge(await this.getRuntimeContext(options.context), options.contextPatch);
      const resolvedEvent = await this.events.resolve(from, event, context);
      if (!resolvedEvent) {
        return this.finishTransitionResult(
          this.results.failure({
            cause,
            from,
            error: new Error(`Event "${event.type}" is not handled by active state "${from.stateId}".`),
            reason: "event_not_handled"
          }),
          options.strict
        );
      }

      if (resolvedEvent.actions) {
        const origin = this.tree.get(resolvedEvent.originStateId);
        await this.actions.runAll(
          {
            context,
            state: origin,
            stateId: origin.id,
            params: resolvedEvent.params,
            meta: origin.meta,
            event,
            fromStateId: from.stateId,
            toStateId: resolvedEvent.target
          },
          resolvedEvent.actions
        );
      }

      const transitionOptions: HsmTransitionOptions<TContext> = {
        ...options,
        cause,
        event,
        params: resolvedEvent.params,
        context
      };
      if (resolvedEvent.contextPatch !== undefined) {
        Object.assign(transitionOptions, { contextPatch: resolvedEvent.contextPatch });
      }
      return this.transition(resolvedEvent.target, transitionOptions);
    } catch (error) {
      return this.finishTransitionResult(
        this.results.failure({ cause, from: this.currentSnapshot, error }),
        options.strict
      );
    }
  }

  public cancelTransition(reason?: unknown): void {
    this.transitionAbort.cancel(reason);
  }

  public async can(key: string, options: HsmResolveOptions<TContext> = {}): Promise<boolean> {
    if (this.tree.has(key)) return this.canState(key, options);
    const snapshot = await this.policySnapshot(options);
    return this.policy.isAllowed(snapshot, "permission", key);
  }

  public async canState(stateId: string, options: HsmResolveOptions<TContext> = {}): Promise<boolean> {
    try {
      await this.resolve(stateId, options);
      return true;
    } catch {
      return false;
    }
  }

  public async cannot(permission: string, options: HsmResolveOptions<TContext> = {}): Promise<boolean> {
    return !(await this.can(permission, options));
  }

  public async canUse(capability: string, options: HsmResolveOptions<TContext> = {}): Promise<boolean> {
    const snapshot = await this.policySnapshot(options);
    return this.policy.isAllowed(snapshot, "capability", capability);
  }

  public async feature(feature: string, options: HsmResolveOptions<TContext> = {}): Promise<boolean> {
    const snapshot = await this.policySnapshot(options);
    return this.policy.isAllowed(snapshot, "feature", feature);
  }

  public async isFeatureEnabled(feature: string, options: HsmResolveOptions<TContext> = {}): Promise<boolean> {
    return this.feature(feature, options);
  }

  public permissions(): readonly string[] {
    return this.policy.list(this.currentSnapshot, "permission");
  }

  public capabilities(): readonly string[] {
    return this.policy.list(this.currentSnapshot, "capability");
  }

  public features(): readonly string[] {
    return this.policy.list(this.currentSnapshot, "feature");
  }

  public deniedPermissions(): readonly string[] {
    return this.policy.denied(this.currentSnapshot, "permission");
  }

  public deniedCapabilities(): readonly string[] {
    return this.policy.denied(this.currentSnapshot, "capability");
  }

  public deniedFeatures(): readonly string[] {
    return this.policy.denied(this.currentSnapshot, "feature");
  }

  public layout(): string | undefined {
    return this.policy.layout(this.currentSnapshot);
  }

  public async explainPermission(permission: string, options: HsmResolveOptions<TContext> = {}): Promise<HsmPolicyDecision> {
    return this.policy.explain("permission", permission, await this.policySnapshot(options));
  }

  public async explainCapability(capability: string, options: HsmResolveOptions<TContext> = {}): Promise<HsmPolicyDecision> {
    return this.policy.explain("capability", capability, await this.policySnapshot(options));
  }

  public async explainFeature(feature: string, options: HsmResolveOptions<TContext> = {}): Promise<HsmPolicyDecision> {
    return this.policy.explain("feature", feature, await this.policySnapshot(options));
  }

  public has(stateId: string): boolean {
    return this.tree.has(stateId);
  }

  public states(): readonly string[] {
    return this.tree.all.map((node) => node.id);
  }

  public routes(): readonly HsmRouteEntry<TContext>[] {
    return this.routeTable.entries;
  }

  public matchUrl(input: string, baseUrl?: string): HsmRouteMatch<TContext> {
    return this.routeTable.match(input, baseUrl);
  }

  public matchUrls(input: string, baseUrl?: string): readonly HsmRouteMatch<TContext>[] {
    return this.routeTable.matchAll(input, baseUrl);
  }

  public href(
    stateId: string,
    params: AnyRecord = {},
    options: HsmHrefOptions<TContext> = {}
  ): string {
    const query = this.buildHrefQuery(options);
    const hrefOptions: HsmHrefOptions = {};
    if (query !== undefined) Object.assign(hrefOptions, { query });
    if (options.hash !== undefined) Object.assign(hrefOptions, { hash: options.hash });
    return this.routeTable.href(stateId, params, hrefOptions);
  }

  public projectQuery(context: TContext, preserveQuery?: AnyRecord): AnyRecord {
    return preserveQuery
      ? this.urlState.project(context, { preserveQuery })
      : this.urlState.project(context);
  }

  public async hydrateQuery(rawQuery: AnyRecord, context?: TContext): Promise<QueryHydrationResult<TContext>> {
    const baseContext = await this.getContext(context);
    return this.urlState.hydrate(rawQuery, baseContext);
  }

  public syncUrl(input: string, context: TContext, options: HsmUrlSyncOptions<TContext> = {}): string {
    const parsed = UrlTools.parse(input, options.baseUrl);
    const preserveQuery = options.preserveUnknownQuery ? this.urlState.unknown(parsed.query) : undefined;
    const projected = preserveQuery
      ? this.urlState.project(options.context ?? context, { preserveQuery })
      : this.urlState.project(options.context ?? context);
    const query = this.applyQueryOverride(projected, options.query);
    const hash = options.hash ?? parsed.hash;
    const pathname = options.canonicalizePath ? this.canonicalPathnameFor(input, options.baseUrl) : parsed.pathname;
    return PathComposer.appendSearchAndHash(pathname, query, hash);
  }

  private async createSnapshot(
    resolved: HsmResolvedState<TContext>,
    redirect?: HsmResolvedRedirect
  ): Promise<HsmSnapshot<TContext>> {
    return this.snapshots.create(await this.withPolicy(resolved), redirect);
  }

  private async withPolicy(resolved: HsmResolvedState<TContext>): Promise<HsmResolvedState<TContext>> {
    return this.policy.enrich(resolved);
  }

  private async policySnapshot(options: HsmResolveOptions<TContext>): Promise<HsmSnapshot<TContext>> {
    if (this.currentSnapshot && !options.context && !options.params && options.expandInitial === undefined) {
      return this.currentSnapshot;
    }
    return this.start(options);
  }

  private async resolveAcceptedRoute(
    input: string,
    baseContext: TContext,
    options: HsmUrlResolveOptions<TContext>
  ): Promise<{
    readonly match: HsmRouteMatch<TContext>;
    readonly hydration: QueryHydrationResult<TContext>;
    readonly resolved: HsmResolvedState<TContext>;
    readonly redirect: HsmResolvedRedirect | null;
  }> {
    const matches = this.routeTable.matchAll(input, options.baseUrl);
    if (matches.length === 0) {
      const parsed = UrlTools.parse(input, options.baseUrl);
      throw new HsmRouteNotFoundError(parsed.pathname);
    }

    let lastRecoverableError: unknown;

    for (const match of matches) {
      try {
        const hydration = this.hydrateMatchedQuery(match.query, baseContext, options);
        const resolved = await this.resolveMatchedState(match, hydration.context, options);
        const routeRedirect = await this.resolveRedirect(match, hydration.context);
        const redirect = this.resolveCanonicalRedirect(match, options) ?? routeRedirect;

        return { match, hydration, resolved, redirect };
      } catch (error) {
        if (!this.isRouteSelectionRecoverable(error)) throw error;
        lastRecoverableError = error;
      }
    }

    if (lastRecoverableError) throw lastRecoverableError;
    const parsed = UrlTools.parse(input, options.baseUrl);
    throw new HsmRouteNotFoundError(parsed.pathname);
  }

  private async resolveMatchedState(
    match: HsmRouteMatch<TContext>,
    context: TContext,
    options: HsmUrlResolveOptions<TContext>
  ): Promise<HsmResolvedState<TContext>> {
    const resolveOptions: HsmResolveOptions<TContext> = { context, params: match.params };
    if (options.expandInitial !== undefined) {
      Object.assign(resolveOptions, { expandInitial: options.expandInitial });
    }
    return this.resolver.resolve(match.stateId, context, resolveOptions, match);
  }

  private hydrateMatchedQuery(
    rawQuery: AnyRecord,
    context: TContext,
    options: HsmUrlResolveOptions<TContext>
  ): QueryHydrationResult<TContext> {
    if (options.hydrateQuery === false) {
      const preserveQuery = options.preserveUnknownQuery ? rawQuery : undefined;
      const projected = preserveQuery
        ? this.urlState.project(context, { preserveQuery })
        : this.urlState.project(context);
      return {
        context,
        urlState: Object.freeze({
          raw: Object.freeze({ ...rawQuery }),
          decoded: Object.freeze({}),
          unknown: Object.freeze(this.urlState.unknown(rawQuery)),
          projected: Object.freeze(projected),
          context: Object.freeze({ ...context })
        })
      };
    }

    const hydration = this.urlState.hydrate(rawQuery, context);
    if (!options.preserveUnknownQuery) return hydration;

    const projected = this.urlState.project(hydration.context, {
      preserveQuery: hydration.urlState.unknown
    });

    return {
      context: hydration.context,
      urlState: Object.freeze({
        raw: hydration.urlState.raw,
        decoded: hydration.urlState.decoded,
        unknown: hydration.urlState.unknown,
        projected: Object.freeze(projected),
        context: hydration.urlState.context
      })
    };
  }

  private buildHrefQuery(options: HsmHrefOptions<TContext>): AnyRecord | undefined {
    const includeQueryState = options.includeQueryState ?? Boolean(options.context);
    const projected = includeQueryState && options.context
      ? options.preserveQuery
        ? this.urlState.project(options.context, { preserveQuery: options.preserveQuery })
        : this.urlState.project(options.context)
      : options.preserveQuery
        ? { ...options.preserveQuery }
        : undefined;

    return this.applyQueryOverride(projected, options.query);
  }

  private applyQueryOverride(base: AnyRecord | undefined, override: AnyRecord | undefined): AnyRecord | undefined {
    if (!base && !override) return undefined;
    const output: AnyRecord = base ? { ...base } : {};
    if (!override) return output;

    for (const [key, value] of Object.entries(override)) {
      if (value === undefined || value === null) {
        delete output[key];
      } else {
        output[key] = value;
      }
    }
    return output;
  }

  private attachProjectedUrlState(
    resolved: HsmResolvedState<TContext>,
    rawQuery: AnyRecord,
    context: TContext
  ): HsmResolvedState<TContext> {
    if (!this.urlState.enabled) return resolved;
    const projected = this.urlState.project(context);
    const urlState: HsmUrlState<TContext> = Object.freeze({
      raw: Object.freeze({ ...rawQuery }),
      decoded: Object.freeze({}),
      unknown: Object.freeze({}),
      projected: Object.freeze(projected),
      context: Object.freeze({ ...context })
    });
    return this.attachUrlState(resolved, urlState);
  }

  private attachUrlState(
    resolved: HsmResolvedState<TContext>,
    urlState: HsmUrlState<TContext>
  ): HsmResolvedState<TContext> {
    if (!this.urlState.enabled) return resolved;
    return { ...resolved, urlState };
  }

  private resolveCanonicalRedirect(
    match: HsmRouteMatch<TContext>,
    options: HsmUrlResolveOptions<TContext>
  ): HsmResolvedRedirect | null {
    const shouldCanonicalize = options.canonicalizeAliases === true || match.entry.redirectToCanonical;
    if (!shouldCanonicalize || match.isCanonical) return null;

    return Object.freeze({
      to: PathComposer.appendSearchAndHash(match.canonicalPathname, match.query, match.hash),
      from: match.pathname,
      stateId: match.stateId
    });
  }

  private canonicalPathnameFor(input: string, baseUrl?: string): string {
    try {
      return this.routeTable.match(input, baseUrl).canonicalPathname;
    } catch {
      return UrlTools.parse(input, baseUrl).pathname;
    }
  }

  private isRouteSelectionRecoverable(error: unknown): boolean {
    return error instanceof HsmGuardRejectedError || error instanceof HsmUnresolvedStateError;
  }

  private async resolveRedirect(
    match: HsmRouteMatch<TContext>,
    context: TContext
  ): Promise<HsmResolvedRedirect | null> {
    const redirect = match.state.config.redirect;
    if (!redirect) return null;

    const rawTarget = typeof redirect === "function"
      ? await redirect({
          context,
          state: match.state,
          stateId: match.stateId,
          params: match.params,
          pathname: match.pathname,
          query: match.query,
          hash: match.hash
        })
      : redirect;

    const target = this.normalizeRedirectTarget(rawTarget, match.params);
    return Object.freeze({
      to: target,
      from: match.pathname,
      stateId: match.stateId
    });
  }

  private normalizeRedirectTarget(target: string, params: AnyRecord): string {
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(target)) {
      throw new HsmRouteBuildError(`External redirects are not allowed by panom-hsm: ${target}`);
    }

    if (this.tree.has(target)) {
      return this.href(target, params);
    }

    return UrlTools.normalizePathname(target);
  }

  private normalizeSendArgs(
    eventOrType: HsmEvent | string,
    payloadOrOptions: unknown,
    maybeOptions: HsmTransitionOptions<TContext>
  ): { readonly event: HsmEvent; readonly options: HsmTransitionOptions<TContext> } {
    if (typeof eventOrType === "string") {
      const looksLikeOptions = this.isTransitionOptions(payloadOrOptions);
      return {
        event: looksLikeOptions ? { type: eventOrType } : { type: eventOrType, payload: payloadOrOptions },
        options: looksLikeOptions ? payloadOrOptions as HsmTransitionOptions<TContext> : maybeOptions
      };
    }

    return { event: eventOrType, options: this.isTransitionOptions(payloadOrOptions) ? payloadOrOptions as HsmTransitionOptions<TContext> : maybeOptions };
  }

  private isTransitionOptions(value: unknown): value is HsmTransitionOptions<TContext> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = new Set(Object.keys(value));
    return ["context", "contextPatch", "params", "expandInitial", "signal", "strict", "skipLifecycle", "cause"].some((key) => keys.has(key));
  }

  private async getRuntimeContext(override: TContext | undefined): Promise<TContext> {
    if (override) return override;
    if (this.currentSnapshot) return this.currentSnapshot.context as TContext;
    return this.getContext(undefined);
  }

  private async getContext(override: TContext | undefined): Promise<TContext> {
    if (override) return override;
    if (typeof this.contextSource === "function") {
      return this.contextSource();
    }
    return (this.contextSource ?? {}) as TContext;
  }

  private finishTransitionResult(
    result: HsmTransitionResult<TContext>,
    strict: boolean | undefined
  ): HsmTransitionResult<TContext> {
    if (!result.ok && strict) throw result.error;
    return result;
  }
}
