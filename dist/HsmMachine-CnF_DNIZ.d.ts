declare class StateNode<TContext extends AnyRecord = AnyRecord> {
    private readonly childrenByKey;
    readonly key: string;
    readonly id: HsmStateId;
    readonly parent: StateNode<TContext> | null;
    readonly config: HsmStateConfig<TContext>;
    readonly depth: number;
    constructor(args: {
        key: string;
        id: HsmStateId;
        parent: StateNode<TContext> | null;
        config: HsmStateConfig<TContext>;
    });
    get path(): string | undefined;
    get url(): HsmStateUrlConfig | undefined;
    get initial(): string | undefined;
    get meta(): HsmMeta;
    get tags(): readonly string[];
    get children(): readonly StateNode<TContext>[];
    addChild(child: StateNode<TContext>): void;
    hasChild(key: string): boolean;
    child(key: string): StateNode<TContext>;
    ancestors(): readonly StateNode<TContext>[];
    activePath(): readonly StateNode<TContext>[];
    is(stateId: HsmStateId): boolean;
    toString(): string;
}

type MaybePromise<T> = T | Promise<T>;
type AnyRecord = Record<string, any>;
type HsmStateId = string;
type HsmStateValue = string | HsmStateValueObject;
interface HsmStateValueObject {
    readonly [key: string]: HsmStateValue;
}
type HsmContextFactory<TContext extends AnyRecord> = () => MaybePromise<TContext>;
interface HsmMeta extends AnyRecord {
    readonly title?: string;
    readonly description?: string;
    readonly layout?: string;
    readonly path?: string;
}
interface HsmGuardInput<TContext extends AnyRecord = AnyRecord> {
    readonly context: Readonly<TContext>;
    readonly state: StateNode<TContext>;
    readonly stateId: HsmStateId;
    readonly params: Readonly<AnyRecord>;
    readonly meta: Readonly<HsmMeta>;
    readonly signal?: AbortSignal;
    readonly event?: HsmEvent;
    readonly fromStateId?: HsmStateId;
    readonly toStateId?: HsmStateId;
}
type HsmGuardFn<TContext extends AnyRecord = AnyRecord> = (input: HsmGuardInput<TContext>) => MaybePromise<boolean>;
type HsmGuardRef<TContext extends AnyRecord = AnyRecord> = string | HsmGuardFn<TContext> | readonly (string | HsmGuardFn<TContext>)[];
type HsmGuardMap<TContext extends AnyRecord = AnyRecord> = Record<string, HsmGuardFn<TContext>>;
interface HsmActionInput<TContext extends AnyRecord = AnyRecord> {
    readonly context: Readonly<TContext>;
    readonly state: StateNode<TContext>;
    readonly stateId: HsmStateId;
    readonly params: Readonly<AnyRecord>;
    readonly meta: Readonly<HsmMeta>;
    readonly signal?: AbortSignal;
    readonly event?: HsmEvent;
    readonly fromStateId?: HsmStateId;
    readonly toStateId?: HsmStateId;
    readonly data?: Readonly<AnyRecord>;
}
type HsmActionFn<TContext extends AnyRecord = AnyRecord> = (input: HsmActionInput<TContext>) => MaybePromise<void>;
type HsmActionRef<TContext extends AnyRecord = AnyRecord> = string | HsmActionFn<TContext> | readonly (string | HsmActionFn<TContext>)[];
type HsmActionMap<TContext extends AnyRecord = AnyRecord> = Record<string, HsmActionFn<TContext>>;
interface HsmLoaderInput<TContext extends AnyRecord = AnyRecord> {
    readonly context: Readonly<TContext>;
    readonly state: StateNode<TContext>;
    readonly stateId: HsmStateId;
    readonly params: Readonly<AnyRecord>;
    readonly meta: Readonly<HsmMeta>;
    readonly signal: AbortSignal;
    readonly event?: HsmEvent;
    readonly fromStateId?: HsmStateId;
    readonly toStateId?: HsmStateId;
}
type HsmLoaderFn<TContext extends AnyRecord = AnyRecord> = (input: HsmLoaderInput<TContext>) => MaybePromise<unknown>;
type HsmLoaderRef<TContext extends AnyRecord = AnyRecord> = string | HsmLoaderFn<TContext> | readonly (string | HsmLoaderFn<TContext>)[];
type HsmLoaderMap<TContext extends AnyRecord = AnyRecord> = Record<string, HsmLoaderFn<TContext>>;
interface HsmEvent<TType extends string = string, TPayload = unknown> {
    readonly type: TType;
    readonly payload?: TPayload;
}
interface HsmEventTransitionInput<TContext extends AnyRecord = AnyRecord> {
    readonly event: HsmEvent;
    readonly context: Readonly<TContext>;
    readonly from: HsmSnapshot<TContext>;
    readonly state: StateNode<TContext>;
}
type HsmEventParamsFactory<TContext extends AnyRecord = AnyRecord> = (input: HsmEventTransitionInput<TContext>) => MaybePromise<AnyRecord>;
type HsmEventContextFactory<TContext extends AnyRecord = AnyRecord> = (input: HsmEventTransitionInput<TContext>) => MaybePromise<Partial<TContext>>;
interface HsmEventTransitionConfig<TContext extends AnyRecord = AnyRecord> {
    readonly target: HsmStateId;
    readonly guard?: HsmGuardRef<TContext>;
    readonly params?: AnyRecord | HsmEventParamsFactory<TContext>;
    readonly context?: Partial<TContext> | HsmEventContextFactory<TContext>;
    readonly actions?: HsmActionRef<TContext>;
}
type HsmEventTransitionRef<TContext extends AnyRecord = AnyRecord> = HsmStateId | HsmEventTransitionConfig<TContext>;
type HsmEventMap<TContext extends AnyRecord = AnyRecord> = Record<string, HsmEventTransitionRef<TContext> | readonly HsmEventTransitionRef<TContext>[]>;
interface HsmSelectionRule<TContext extends AnyRecord = AnyRecord> {
    readonly target: HsmStateId;
    readonly guard?: HsmGuardRef<TContext>;
}
type HsmRedirectTarget<TContext extends AnyRecord = AnyRecord> = string | ((input: HsmRouteContext<TContext>) => MaybePromise<string>);
type HsmUrlMode = "visible" | "hidden" | "virtual";
type HsmRouteEntryKind = "canonical" | "alias";
interface HsmStateUrlConfig {
    /** Segment projection mode. Defaults to "visible". */
    readonly mode?: HsmUrlMode;
    /** Shorthand for mode: "hidden". */
    readonly hide?: boolean;
    /** Public path override for this state segment. */
    readonly path?: string;
    /** Alternate public segment(s) for backwards-compatible matching. */
    readonly aliases?: readonly string[];
    /** Hidden states are not self-routable by default; set true to expose the parent path. */
    readonly route?: boolean;
    /** When an alias is matched, emit/follow a canonical redirect for the accepted route. */
    readonly redirectAliases?: boolean;
    /** Tie-breaker for ambiguous projected routes. Higher wins. */
    readonly priority?: number;
}
interface HsmStateBackendConfig<TContext extends AnyRecord = AnyRecord> {
    readonly routes?: readonly string[];
    readonly methods?: readonly string[];
    readonly guards?: HsmGuardRef<TContext>;
    readonly meta?: AnyRecord;
}
type HsmPolicyKind = "permission" | "capability" | "feature";
interface HsmPolicyRule<TContext extends AnyRecord = AnyRecord> {
    readonly guard?: HsmGuardRef<TContext>;
    readonly description?: string;
    readonly tags?: readonly string[];
    readonly meta?: AnyRecord;
}
type HsmPolicyDefinition<TContext extends AnyRecord = AnyRecord> = boolean | HsmGuardRef<TContext> | HsmPolicyRule<TContext>;
type HsmPolicyMap<TContext extends AnyRecord = AnyRecord> = Record<string, HsmPolicyDefinition<TContext>>;
interface HsmPolicyDefinitions<TContext extends AnyRecord = AnyRecord> {
    readonly permissions?: HsmPolicyMap<TContext>;
    readonly capabilities?: HsmPolicyMap<TContext>;
    readonly features?: HsmPolicyMap<TContext>;
}
interface HsmPolicySource {
    readonly stateId: HsmStateId;
    readonly action: "allow" | "deny";
}
interface HsmPolicyDecision {
    readonly key: string;
    readonly kind: HsmPolicyKind;
    readonly allowed: boolean;
    readonly reason: "allowed" | "not_declared" | "state_denied" | "rule_denied" | "guard_failed" | "guard_missing" | "error";
    readonly guard?: string;
    readonly inheritedFrom: readonly string[];
    readonly deniedBy: readonly string[];
    readonly stateId: HsmStateId;
    readonly error?: unknown;
}
interface HsmPolicySnapshot {
    readonly permissions: readonly string[];
    readonly capabilities: readonly string[];
    readonly features: readonly string[];
    readonly deniedPermissions: readonly string[];
    readonly deniedCapabilities: readonly string[];
    readonly deniedFeatures: readonly string[];
    readonly layout?: string;
    readonly decisions: Readonly<{
        readonly permissions: Readonly<Record<string, HsmPolicyDecision>>;
        readonly capabilities: Readonly<Record<string, HsmPolicyDecision>>;
        readonly features: Readonly<Record<string, HsmPolicyDecision>>;
    }>;
}
interface HsmStateConfig<TContext extends AnyRecord = AnyRecord> {
    readonly path?: string;
    readonly url?: HsmStateUrlConfig;
    readonly initial?: string;
    readonly guard?: HsmGuardRef<TContext>;
    readonly resolve?: readonly HsmSelectionRule<TContext>[];
    readonly redirect?: HsmRedirectTarget<TContext>;
    /** Guard(s) checked before a transition may leave this state. Runs from leaf to root. */
    readonly beforeLeave?: HsmGuardRef<TContext>;
    /** Guard(s) checked before a transition may enter this state. Runs from root to leaf. */
    readonly beforeEnter?: HsmGuardRef<TContext>;
    /** Backwards-compatible alias for onEnter actions. */
    readonly entry?: HsmActionRef<TContext>;
    /** Backwards-compatible alias for onLeave actions. */
    readonly exit?: HsmActionRef<TContext>;
    readonly onEnter?: HsmActionRef<TContext>;
    readonly onLeave?: HsmActionRef<TContext>;
    readonly afterEnter?: HsmActionRef<TContext>;
    readonly loader?: HsmLoaderRef<TContext>;
    readonly on?: HsmEventMap<TContext>;
    readonly tags?: readonly string[];
    readonly meta?: HsmMeta;
    readonly permissions?: readonly string[];
    readonly denyPermissions?: readonly string[];
    readonly capabilities?: readonly string[];
    readonly denyCapabilities?: readonly string[];
    readonly features?: readonly string[];
    readonly denyFeatures?: readonly string[];
    readonly layout?: string;
    readonly backend?: HsmStateBackendConfig<TContext>;
    readonly states?: Record<string, HsmStateConfig<TContext>>;
}
type HsmQueryType = "string" | "number" | "boolean" | "string[]" | "number[]" | "boolean[]" | "json";
type HsmQueryInvalidPolicy = "default" | "ignore" | "throw";
interface HsmQueryCodecInput<TContext extends AnyRecord = AnyRecord> {
    readonly key: string;
    readonly raw: unknown;
    readonly context: Readonly<TContext>;
}
interface HsmQueryCodecOutput<TContext extends AnyRecord = AnyRecord> {
    readonly key: string;
    readonly value: unknown;
    readonly context: Readonly<TContext>;
}
type HsmQueryDecodeFn<TContext extends AnyRecord = AnyRecord> = (input: HsmQueryCodecInput<TContext>) => unknown;
type HsmQueryEncodeFn<TContext extends AnyRecord = AnyRecord> = (input: HsmQueryCodecOutput<TContext>) => string | readonly string[] | null | undefined;
type HsmQueryValidateFn<TContext extends AnyRecord = AnyRecord> = (input: HsmQueryCodecOutput<TContext>) => boolean;
interface HsmQueryBinding<TContext extends AnyRecord = AnyRecord> {
    /** Context path. "tab" and "context.tab" both point to context.tab. */
    readonly source?: string;
    /** Query param key. Defaults to the schema key. */
    readonly key?: string;
    readonly type?: HsmQueryType;
    readonly default?: unknown;
    /** Whether this binding is projected into URLs. Defaults to true. */
    readonly expose?: boolean;
    /** Whether default-equivalent values are omitted from URLs. Defaults to true. */
    readonly omitDefault?: boolean;
    /** How invalid incoming query values are handled. Defaults to "default". */
    readonly invalid?: HsmQueryInvalidPolicy;
    readonly encode?: HsmQueryEncodeFn<TContext>;
    readonly decode?: HsmQueryDecodeFn<TContext>;
    readonly validate?: HsmQueryValidateFn<TContext>;
}
type HsmQuerySchema<TContext extends AnyRecord = AnyRecord> = Record<string, HsmQueryBinding<TContext>>;
interface HsmMachineConfig<TContext extends AnyRecord = AnyRecord> {
    readonly id: string;
    readonly version?: string;
    readonly initial?: string;
    readonly context?: TContext | HsmContextFactory<TContext>;
    readonly guards?: HsmGuardMap<TContext>;
    readonly actions?: HsmActionMap<TContext>;
    readonly loaders?: HsmLoaderMap<TContext>;
    readonly query?: HsmQuerySchema<TContext>;
    readonly policies?: HsmPolicyDefinitions<TContext>;
    readonly states: Record<string, HsmStateConfig<TContext>>;
}
interface HsmResolveOptions<TContext extends AnyRecord = AnyRecord> {
    readonly context?: TContext;
    readonly params?: AnyRecord;
    readonly expandInitial?: boolean;
}
interface HsmResolvedState<TContext extends AnyRecord = AnyRecord> {
    readonly node: StateNode<TContext>;
    readonly context: TContext;
    readonly params: AnyRecord;
    readonly activePath: readonly StateNode<TContext>[];
    readonly meta: HsmMeta;
    readonly tags: readonly string[];
    readonly route?: HsmRouteMatch<TContext>;
    readonly urlState?: HsmUrlState<TContext>;
    readonly data?: AnyRecord;
    readonly policy?: HsmPolicySnapshot;
}
interface HsmRouteContext<TContext extends AnyRecord = AnyRecord> {
    readonly context: Readonly<TContext>;
    readonly state: StateNode<TContext>;
    readonly stateId: HsmStateId;
    readonly params: Readonly<AnyRecord>;
    readonly pathname: string;
    readonly query: Readonly<AnyRecord>;
    readonly hash: string;
}
interface HsmRouteEntry<TContext extends AnyRecord = AnyRecord> {
    readonly state: StateNode<TContext>;
    readonly stateId: HsmStateId;
    /** Pattern used for matching this exact public route entry. */
    readonly pattern: string;
    /** Canonical public pattern used by href() and canonical redirects. */
    readonly canonicalPattern: string;
    readonly kind: HsmRouteEntryKind;
    readonly isAlias: boolean;
    readonly redirectToCanonical: boolean;
    readonly priority: number;
    readonly score: number;
}
interface HsmRouteMatch<TContext extends AnyRecord = AnyRecord> {
    readonly entry: HsmRouteEntry<TContext>;
    readonly state: StateNode<TContext>;
    readonly stateId: HsmStateId;
    readonly params: AnyRecord;
    readonly pathname: string;
    readonly canonicalPathname: string;
    readonly query: AnyRecord;
    readonly hash: string;
    readonly pattern: string;
    readonly canonicalPattern: string;
    readonly kind: HsmRouteEntryKind;
    readonly isCanonical: boolean;
}
interface HsmResolvedRedirect {
    readonly to: string;
    readonly from: string;
    readonly stateId: HsmStateId;
}
interface HsmUrlState<TContext extends AnyRecord = AnyRecord> {
    /** Raw query object parsed from the URL before HSM decoding. */
    readonly raw: Readonly<AnyRecord>;
    /** Typed query values accepted by registered bindings, keyed by query param name. */
    readonly decoded: Readonly<AnyRecord>;
    /** Query params not owned by the HSM query schema. */
    readonly unknown: Readonly<AnyRecord>;
    /** Query object produced from the current context, keyed by query param name. */
    readonly projected: Readonly<AnyRecord>;
    /** Final context after URL query hydration. */
    readonly context: Readonly<TContext>;
}
interface HsmUrlResolveOptions<TContext extends AnyRecord = AnyRecord> {
    readonly context?: TContext;
    readonly baseUrl?: string;
    readonly expandInitial?: boolean;
    readonly followRedirects?: boolean;
    readonly maxRedirects?: number;
    /** Defaults to true. Turns URL query -> context hydration on/off. */
    readonly hydrateQuery?: boolean;
    /** Defaults to false. Preserves unknown query params during projected URL generation. */
    readonly preserveUnknownQuery?: boolean;
    /** Defaults to false. If true, accepted alias routes redirect to the canonical projected URL. */
    readonly canonicalizeAliases?: boolean;
}
interface HsmHrefOptions<TContext extends AnyRecord = AnyRecord> {
    /** Manual query override. Applied after query-state projection. */
    readonly query?: AnyRecord;
    readonly hash?: string;
    /** Context used to project query-bound state into the generated href. */
    readonly context?: TContext;
    /** Defaults to true when context is provided, false otherwise. */
    readonly includeQueryState?: boolean;
    /** Unknown/current query params to preserve before projection. */
    readonly preserveQuery?: AnyRecord;
}
interface HsmUrlSyncOptions<TContext extends AnyRecord = AnyRecord> {
    readonly context?: TContext;
    readonly baseUrl?: string;
    readonly preserveUnknownQuery?: boolean;
    readonly query?: AnyRecord;
    readonly hash?: string;
    /** Defaults to false. If true, alias/hidden legacy paths are rewritten to canonical projected paths. */
    readonly canonicalizePath?: boolean;
}
type HsmTransitionCause = "start" | "state" | "url" | "event";
type HsmTransitionFailureReason = "guard_failed" | "loader_failed" | "action_failed" | "route_not_found" | "unresolved_state" | "event_not_handled" | "aborted" | "error";
interface HsmTransitionOptions<TContext extends AnyRecord = AnyRecord> extends HsmResolveOptions<TContext> {
    readonly contextPatch?: Partial<TContext>;
    readonly signal?: AbortSignal;
    readonly strict?: boolean;
    readonly skipLifecycle?: boolean;
    readonly cause?: HsmTransitionCause;
    readonly event?: HsmEvent;
}
interface HsmUrlTransitionOptions<TContext extends AnyRecord = AnyRecord> extends HsmUrlResolveOptions<TContext> {
    readonly contextPatch?: Partial<TContext>;
    readonly signal?: AbortSignal;
    readonly strict?: boolean;
    readonly skipLifecycle?: boolean;
    readonly cause?: HsmTransitionCause;
    readonly event?: HsmEvent;
}
interface HsmTransitionLifecycleRecord {
    readonly phase: "beforeLeave" | "beforeEnter" | "load" | "onLeave" | "onEnter" | "afterEnter";
    readonly stateId: HsmStateId;
}
interface HsmTransitionSuccess<TContext extends AnyRecord = AnyRecord> {
    readonly ok: true;
    readonly cause: HsmTransitionCause;
    readonly from: HsmSnapshot<TContext> | null;
    readonly to: HsmSnapshot<TContext>;
    readonly snapshot: HsmSnapshot<TContext>;
    readonly data: Readonly<AnyRecord>;
    readonly lifecycle: readonly HsmTransitionLifecycleRecord[];
    readonly redirect?: HsmResolvedRedirect;
}
interface HsmTransitionFailure<TContext extends AnyRecord = AnyRecord> {
    readonly ok: false;
    readonly cause: HsmTransitionCause;
    readonly reason: HsmTransitionFailureReason;
    readonly from: HsmSnapshot<TContext> | null;
    readonly targetStateId?: HsmStateId;
    readonly error: unknown;
    readonly aborted: boolean;
}
type HsmTransitionResult<TContext extends AnyRecord = AnyRecord> = HsmTransitionSuccess<TContext> | HsmTransitionFailure<TContext>;
interface HsmResolvedEventTransition<TContext extends AnyRecord = AnyRecord> {
    readonly target: HsmStateId;
    readonly params: AnyRecord;
    readonly contextPatch?: Partial<TContext>;
    readonly actions?: HsmActionRef<TContext>;
    readonly originStateId: HsmStateId;
}
interface HsmSnapshot<TContext extends AnyRecord = AnyRecord> {
    readonly machineId: string;
    readonly stateId: HsmStateId;
    readonly value: HsmStateValue;
    readonly context: Readonly<TContext>;
    readonly params: Readonly<AnyRecord>;
    readonly meta: Readonly<HsmMeta>;
    readonly tags: readonly string[];
    readonly activePath: readonly HsmStateId[];
    readonly route?: {
        readonly pattern: string;
        readonly canonicalPattern: string;
        readonly pathname: string;
        readonly canonicalPathname: string;
        readonly query: Readonly<AnyRecord>;
        readonly hash: string;
        readonly matchedStateId: HsmStateId;
        readonly kind: HsmRouteEntryKind;
        readonly isCanonical: boolean;
    };
    readonly urlState?: HsmUrlState<TContext>;
    readonly data?: Readonly<AnyRecord>;
    readonly policy?: HsmPolicySnapshot;
    readonly redirect?: HsmResolvedRedirect;
    readonly is: (stateId: HsmStateId) => boolean;
    readonly hasTag: (tag: string) => boolean;
    readonly can: (permission: string) => boolean;
    readonly canUse: (capability: string) => boolean;
    readonly feature: (feature: string) => boolean;
}

declare class StateTree<TContext extends AnyRecord = AnyRecord> {
    private readonly nodesById;
    private readonly rootNodes;
    constructor(config: HsmMachineConfig<TContext>);
    get roots(): readonly StateNode<TContext>[];
    get all(): readonly StateNode<TContext>[];
    get(stateId: HsmStateId): StateNode<TContext>;
    has(stateId: HsmStateId): boolean;
    firstRoot(): StateNode<TContext>;
    rootByKey(key: string): StateNode<TContext>;
    expandInitial(node: StateNode<TContext>): StateNode<TContext>;
    private buildNode;
    private validateInitial;
}

declare class GuardRegistry<TContext extends AnyRecord = AnyRecord> {
    private readonly guards;
    constructor(guards?: HsmGuardMap<TContext>);
    register(name: string, guard: HsmGuardFn<TContext>): void;
    has(name: string): boolean;
    get(name: string, stateId: string): HsmGuardFn<TContext>;
    accepts(input: HsmGuardInput<TContext>, ref: HsmGuardRef<TContext> | undefined): Promise<boolean>;
    assertAll(input: HsmGuardInput<TContext>, ref: HsmGuardRef<TContext> | undefined): Promise<void>;
    private normalize;
}

declare class ActionRegistry<TContext extends AnyRecord = AnyRecord> {
    private readonly actions;
    constructor(actions?: HsmActionMap<TContext>);
    register(name: string, action: HsmActionFn<TContext>): void;
    has(name: string): boolean;
    get(name: string, stateId: string): HsmActionFn<TContext>;
    runAll(input: HsmActionInput<TContext>, ref: HsmActionRef<TContext> | undefined): Promise<void>;
    private normalize;
}

interface NamedLoader<TContext extends AnyRecord = AnyRecord> {
    readonly name: string;
    readonly run: HsmLoaderFn<TContext>;
}
declare class LoaderRegistry<TContext extends AnyRecord = AnyRecord> {
    private readonly loaders;
    constructor(loaders?: HsmLoaderMap<TContext>);
    register(name: string, loader: HsmLoaderFn<TContext>): void;
    has(name: string): boolean;
    get(name: string, stateId: string): HsmLoaderFn<TContext>;
    normalize(ref: HsmLoaderRef<TContext> | undefined, stateId: string): readonly NamedLoader<TContext>[];
    runAll(input: HsmLoaderInput<TContext>, ref: HsmLoaderRef<TContext> | undefined): Promise<unknown>;
}

interface PathMatchResult {
    readonly params: AnyRecord;
    readonly score: number;
}
declare class PathPattern {
    readonly pattern: string;
    readonly score: number;
    private readonly segments;
    constructor(pattern: string);
    match(pathname: string): PathMatchResult | null;
    build(params?: AnyRecord): string;
    private compile;
    private computeScore;
    private split;
}

interface InternalRouteEntry<TContext extends AnyRecord = AnyRecord> extends HsmRouteEntry<TContext> {
    readonly compiled: PathPattern;
    readonly canonicalCompiled: PathPattern;
}
/**
 * Public URL index generated from the semantic state tree.
 *
 * The table stores canonical route entries for href generation and also alias entries for
 * backwards-compatible matching. A state can therefore keep an internal id such as
 * `app.profile.owner` while exposing `/profile/:username` as the canonical public URL.
 */
declare class RouteTable<TContext extends AnyRecord = AnyRecord> {
    private readonly tree;
    private readonly canonicalByStateId;
    private readonly orderedEntries;
    constructor(tree: StateTree<TContext>);
    get entries(): readonly HsmRouteEntry<TContext>[];
    match(input: string, baseUrl?: string): HsmRouteMatch<TContext>;
    matchAll(input: string, baseUrl?: string): readonly HsmRouteMatch<TContext>[];
    href(stateId: string, params?: AnyRecord, options?: HsmHrefOptions): string;
    routeForState(stateId: string): InternalRouteEntry<TContext>;
    private buildEntries;
}

interface QueryHydrationResult<TContext extends AnyRecord = AnyRecord> {
    readonly context: TContext;
    readonly urlState: HsmUrlState<TContext>;
}
interface QueryProjectionOptions {
    readonly preserveQuery?: AnyRecord;
}
declare class UrlStateProjector<TContext extends AnyRecord = AnyRecord> {
    private readonly bindings;
    private readonly ownedKeys;
    constructor(schema: HsmQuerySchema<TContext> | undefined);
    get enabled(): boolean;
    hydrate(rawQuery: AnyRecord, baseContext: TContext): QueryHydrationResult<TContext>;
    project(context: TContext, options?: QueryProjectionOptions): AnyRecord;
    unknown(rawQuery: AnyRecord): AnyRecord;
    private compile;
}

declare class PolicyEngine<TContext extends AnyRecord = AnyRecord> {
    private readonly tree;
    private readonly definitions;
    private readonly inheritance;
    private readonly evaluator;
    constructor(tree: StateTree<TContext>, guards: GuardRegistry<TContext>, definitions?: HsmPolicyDefinitions<TContext>);
    enrich(resolved: HsmResolvedState<TContext>): Promise<HsmResolvedState<TContext>>;
    resolve(resolved: HsmResolvedState<TContext>): Promise<HsmPolicySnapshot>;
    explain(kind: HsmPolicyKind, key: string, target: HsmResolvedState<TContext> | HsmSnapshot<TContext>): Promise<HsmPolicyDecision>;
    isAllowed(snapshot: HsmSnapshot<TContext> | null | undefined, kind: HsmPolicyKind, key: string): boolean;
    list(snapshot: HsmSnapshot<TContext> | null | undefined, kind: HsmPolicyKind): readonly string[];
    denied(snapshot: HsmSnapshot<TContext> | null | undefined, kind: HsmPolicyKind): readonly string[];
    layout(snapshot: HsmSnapshot<TContext> | null | undefined): string | undefined;
    private resolveKind;
    private evaluateOne;
    private ruleFor;
    private allowedKeys;
    private deniedKeys;
    private isSnapshot;
}

declare class HsmMachine<TContext extends AnyRecord = AnyRecord> {
    readonly id: string;
    readonly tree: StateTree<TContext>;
    readonly guards: GuardRegistry<TContext>;
    readonly actions: ActionRegistry<TContext>;
    readonly loaders: LoaderRegistry<TContext>;
    readonly routeTable: RouteTable<TContext>;
    readonly urlState: UrlStateProjector<TContext>;
    readonly policy: PolicyEngine<TContext>;
    private readonly resolver;
    private readonly snapshots;
    private readonly initialStateKey;
    private readonly contextSource;
    private readonly transitionAbort;
    private readonly transitions;
    private readonly events;
    private readonly results;
    private currentSnapshot;
    constructor(config: HsmMachineConfig<TContext>);
    get current(): HsmSnapshot<TContext> | null;
    start(options?: HsmResolveOptions<TContext>): Promise<HsmSnapshot<TContext>>;
    resolve(stateId: string, options?: HsmResolveOptions<TContext>): Promise<HsmSnapshot<TContext>>;
    transition(stateId: string, options?: HsmTransitionOptions<TContext>): Promise<HsmTransitionResult<TContext>>;
    resolveUrl(input: string, options?: HsmUrlResolveOptions<TContext>): Promise<HsmSnapshot<TContext>>;
    transitionUrl(input: string, options?: HsmUrlTransitionOptions<TContext>): Promise<HsmTransitionResult<TContext>>;
    navigate(input: string, options?: HsmUrlTransitionOptions<TContext>): Promise<HsmSnapshot<TContext>>;
    send(eventOrType: HsmEvent | string, payloadOrOptions?: unknown, maybeOptions?: HsmTransitionOptions<TContext>): Promise<HsmTransitionResult<TContext>>;
    cancelTransition(reason?: unknown): void;
    can(key: string, options?: HsmResolveOptions<TContext>): Promise<boolean>;
    canState(stateId: string, options?: HsmResolveOptions<TContext>): Promise<boolean>;
    cannot(permission: string, options?: HsmResolveOptions<TContext>): Promise<boolean>;
    canUse(capability: string, options?: HsmResolveOptions<TContext>): Promise<boolean>;
    feature(feature: string, options?: HsmResolveOptions<TContext>): Promise<boolean>;
    isFeatureEnabled(feature: string, options?: HsmResolveOptions<TContext>): Promise<boolean>;
    permissions(): readonly string[];
    capabilities(): readonly string[];
    features(): readonly string[];
    deniedPermissions(): readonly string[];
    deniedCapabilities(): readonly string[];
    deniedFeatures(): readonly string[];
    layout(): string | undefined;
    explainPermission(permission: string, options?: HsmResolveOptions<TContext>): Promise<HsmPolicyDecision>;
    explainCapability(capability: string, options?: HsmResolveOptions<TContext>): Promise<HsmPolicyDecision>;
    explainFeature(feature: string, options?: HsmResolveOptions<TContext>): Promise<HsmPolicyDecision>;
    has(stateId: string): boolean;
    states(): readonly string[];
    routes(): readonly HsmRouteEntry<TContext>[];
    matchUrl(input: string, baseUrl?: string): HsmRouteMatch<TContext>;
    matchUrls(input: string, baseUrl?: string): readonly HsmRouteMatch<TContext>[];
    href(stateId: string, params?: AnyRecord, options?: HsmHrefOptions<TContext>): string;
    projectQuery(context: TContext, preserveQuery?: AnyRecord): AnyRecord;
    hydrateQuery(rawQuery: AnyRecord, context?: TContext): Promise<QueryHydrationResult<TContext>>;
    syncUrl(input: string, context: TContext, options?: HsmUrlSyncOptions<TContext>): string;
    private createSnapshot;
    private withPolicy;
    private policySnapshot;
    private resolveAcceptedRoute;
    private resolveMatchedState;
    private hydrateMatchedQuery;
    private buildHrefQuery;
    private applyQueryOverride;
    private attachProjectedUrlState;
    private attachUrlState;
    private resolveCanonicalRedirect;
    private canonicalPathnameFor;
    private isRouteSelectionRecoverable;
    private resolveRedirect;
    private normalizeRedirectTarget;
    private normalizeSendArgs;
    private isTransitionOptions;
    private getRuntimeContext;
    private getContext;
    private finishTransitionResult;
}

export { type HsmSelectionRule as $, ActionRegistry as A, type HsmPolicyDefinitions as B, type HsmPolicyKind as C, type HsmPolicyMap as D, type HsmPolicyRule as E, type HsmPolicySnapshot as F, GuardRegistry as G, type HsmActionFn as H, type HsmPolicySource as I, type HsmQueryBinding as J, type HsmQueryCodecInput as K, type HsmQueryCodecOutput as L, type HsmQueryDecodeFn as M, type HsmQueryEncodeFn as N, type HsmQueryInvalidPolicy as O, type HsmQuerySchema as P, type HsmQueryType as Q, type HsmQueryValidateFn as R, type HsmRedirectTarget as S, type HsmResolveOptions as T, type HsmResolvedEventTransition as U, type HsmResolvedRedirect as V, type HsmResolvedState as W, type HsmRouteContext as X, type HsmRouteEntry as Y, type HsmRouteEntryKind as Z, type HsmRouteMatch as _, type AnyRecord as a, type HsmSnapshot as a0, type HsmStateBackendConfig as a1, type HsmStateConfig as a2, type HsmStateId as a3, type HsmStateUrlConfig as a4, type HsmStateValue as a5, type HsmStateValueObject as a6, type HsmTransitionCause as a7, type HsmTransitionFailure as a8, type HsmTransitionFailureReason as a9, type HsmTransitionLifecycleRecord as aa, type HsmTransitionOptions as ab, type HsmTransitionResult as ac, type HsmTransitionSuccess as ad, type HsmUrlMode as ae, type HsmUrlResolveOptions as af, type HsmUrlState as ag, type HsmUrlSyncOptions as ah, type HsmUrlTransitionOptions as ai, LoaderRegistry as aj, type MaybePromise as ak, PathPattern as al, PolicyEngine as am, type QueryHydrationResult as an, type QueryProjectionOptions as ao, RouteTable as ap, StateNode as aq, StateTree as ar, UrlStateProjector as as, type HsmActionInput as b, type HsmActionMap as c, type HsmActionRef as d, type HsmContextFactory as e, type HsmEvent as f, type HsmEventContextFactory as g, type HsmEventMap as h, type HsmEventParamsFactory as i, type HsmEventTransitionConfig as j, type HsmEventTransitionInput as k, type HsmEventTransitionRef as l, type HsmGuardFn as m, type HsmGuardInput as n, type HsmGuardMap as o, type HsmGuardRef as p, type HsmHrefOptions as q, type HsmLoaderFn as r, type HsmLoaderInput as s, type HsmLoaderMap as t, type HsmLoaderRef as u, HsmMachine as v, type HsmMachineConfig as w, type HsmMeta as x, type HsmPolicyDecision as y, type HsmPolicyDefinition as z };
