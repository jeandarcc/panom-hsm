import { S as SnapshotFactory } from './SnapshotFactory-BynYGQMT.js';
export { c as createHsm } from './SnapshotFactory-BynYGQMT.js';
import { a as AnyRecord, aj as LoaderRegistry, a0 as HsmSnapshot, W as HsmResolvedState, aq as StateNode, f as HsmEvent, aa as HsmTransitionLifecycleRecord, ar as StateTree, G as GuardRegistry, U as HsmResolvedEventTransition, T as HsmResolveOptions, _ as HsmRouteMatch, ae as HsmUrlMode, A as ActionRegistry, a7 as HsmTransitionCause, V as HsmResolvedRedirect, ac as HsmTransitionResult, a9 as HsmTransitionFailureReason, Q as HsmQueryType, O as HsmQueryInvalidPolicy, J as HsmQueryBinding, C as HsmPolicyKind, z as HsmPolicyDefinition, y as HsmPolicyDecision, am as PolicyEngine } from './HsmMachine-CnF_DNIZ.js';
export { H as HsmActionFn, b as HsmActionInput, c as HsmActionMap, d as HsmActionRef, e as HsmContextFactory, g as HsmEventContextFactory, h as HsmEventMap, i as HsmEventParamsFactory, j as HsmEventTransitionConfig, k as HsmEventTransitionInput, l as HsmEventTransitionRef, m as HsmGuardFn, n as HsmGuardInput, o as HsmGuardMap, p as HsmGuardRef, q as HsmHrefOptions, r as HsmLoaderFn, s as HsmLoaderInput, t as HsmLoaderMap, u as HsmLoaderRef, v as HsmMachine, w as HsmMachineConfig, x as HsmMeta, B as HsmPolicyDefinitions, D as HsmPolicyMap, E as HsmPolicyRule, F as HsmPolicySnapshot, I as HsmPolicySource, K as HsmQueryCodecInput, L as HsmQueryCodecOutput, M as HsmQueryDecodeFn, N as HsmQueryEncodeFn, P as HsmQuerySchema, R as HsmQueryValidateFn, S as HsmRedirectTarget, X as HsmRouteContext, Y as HsmRouteEntry, Z as HsmRouteEntryKind, $ as HsmSelectionRule, a1 as HsmStateBackendConfig, a2 as HsmStateConfig, a3 as HsmStateId, a4 as HsmStateUrlConfig, a5 as HsmStateValue, a8 as HsmTransitionFailure, ab as HsmTransitionOptions, ad as HsmTransitionSuccess, af as HsmUrlResolveOptions, ag as HsmUrlState, ah as HsmUrlSyncOptions, ai as HsmUrlTransitionOptions, ak as MaybePromise, al as PathPattern, an as QueryHydrationResult, ao as QueryProjectionOptions, ap as RouteTable, as as UrlStateProjector } from './HsmMachine-CnF_DNIZ.js';
export { BackendGuardRegistry, BackendPolicyEnforcer, HsmBackendContextFactory, HsmBackendContextInput, HsmBackendMiddleware, HsmBackendMiddlewareOptions, HsmBackendNext, HsmBackendRequest, HsmBackendResolveFailure, HsmBackendResolveFailureReason, HsmBackendResolveOptions, HsmBackendResolveResult, HsmBackendResolveSuccess, HsmBackendResponse, HsmBackendRuntime, HsmBackendRuntimeConfig, RequestResolver, createHsmBackend, fromNodeRequest, hsmExpressMiddleware, requireHsmCapability, requireHsmFeature, requireHsmPermission, requireHsmState, requireHsmTag } from './backend/index.js';
export { H as HsmConfigurationError, a as HsmDuplicateStateError, b as HsmError, c as HsmGuardRejectedError, d as HsmMissingGuardError, e as HsmMissingStateError, f as HsmQueryParseError, g as HsmRedirectLoopError, h as HsmRouteBuildError, i as HsmRouteNotFoundError, j as HsmSchemaError, k as HsmSchemaFunctionError, l as HsmSchemaParseError, m as HsmSchemaValidationError, n as HsmUnresolvedStateError, S as SchemaCompiler, o as SchemaConfigFactory, p as SchemaSerializer, q as SchemaValidator, r as assertValidSchema, s as compileSchema, t as createHsmFromSchema, u as defineHsm, v as schemaFromJson, w as schemaToJson, x as validateSchema } from './index-oISDwmPq.js';
export { H as HsmSchema, a as HsmSchemaActionProbe, b as HsmSchemaBackendPolicy, c as HsmSchemaCompileOptions, d as HsmSchemaEventMap, e as HsmSchemaEventTransition, f as HsmSchemaGuardProbe, g as HsmSchemaIndex, h as HsmSchemaLoaderProbe, i as HsmSchemaMetadata, j as HsmSchemaPolicyDefinitions, k as HsmSchemaPolicyMap, l as HsmSchemaPolicyRule, m as HsmSchemaPolicySet, n as HsmSchemaQuery, o as HsmSchemaQueryBinding, p as HsmSchemaRefList, q as HsmSchemaRouteIndexEntry, r as HsmSchemaRuntimeOptions, s as HsmSchemaSelectionRule, t as HsmSchemaStateIndexEntry, u as HsmSchemaStateNode, v as HsmSchemaTransitionHint, w as HsmSchemaValidationIssue, x as HsmSchemaValidationResult, y as HsmSchemaVersion, J as JsonPrimitive, A as JsonValue } from './HsmSchema-CS9uvZAj.js';
export { BrowserDebugLogger, BrowserHistoryAdapter, BrowserHistoryAdapterOptions, BrowserHistoryLike, BrowserHistoryLocation, BrowserLocationLike, BrowserNavigationCommit, BrowserNavigationMode, BrowserNavigationSource, BrowserPopstateUnsubscribe, BrowserUrlRuntime, BrowserWindowLike, CanonicalNavigation, CanonicalNavigationOptions, HostPolicyAdapter, HostPolicyAdapterOptions, HsmBrowserNavigateOptions, HsmBrowserRuntimeOptions, HsmBrowserStartOptions, HsmBrowserSyncOptions, PopstateListener, RedirectSafety, RedirectSafetyFailure, RedirectSafetyFailureReason, RedirectSafetyOptions, RedirectSafetyResult, RedirectSafetySuccess, UrlSyncController, createHostPolicyAdapter, createHsmBrowserRuntime, createRedirectSafety } from './browser/index.js';
export { HsmVuePluginOptions, HsmVueRuntime, MachineOutlet, MachineOutletSlotProps, createHsmVue, createHsmVueRuntime, useHsm, useHsmPolicy, useHsmRuntime, useHsmState } from './vue/index.js';
export { DebugEventBus, DevtoolsTimeline, DevtoolsTimelineOptions, HsmDebugEvent, HsmDebugEventType, HsmDebugListener, HsmDevtools, HsmDevtoolsOptions, SnapshotInspection, SnapshotInspector, TransitionTrace, TransitionTraceEntry, attachHsmDevtools, createHsmDevtools } from './devtools/index.js';
export { NavigationTarget, SubdomainPolicyRuntime, SubdomainPolicyRuntimeDependencies } from '@panomapp/subdomain-policy/runtime';
import '@panomapp/subdomain-policy';
import 'vue';

interface LoaderRunInput<TContext extends AnyRecord = AnyRecord> {
    readonly from: HsmSnapshot<TContext> | null;
    readonly to: HsmResolvedState<TContext>;
    readonly entering: readonly StateNode<TContext>[];
    readonly signal: AbortSignal;
    readonly event?: HsmEvent;
    readonly lifecycle: HsmTransitionLifecycleRecord[];
}
declare class LoaderRunner<TContext extends AnyRecord = AnyRecord> {
    private readonly loaders;
    constructor(loaders: LoaderRegistry<TContext>);
    run(input: LoaderRunInput<TContext>): Promise<AnyRecord>;
    private statesWithLoaders;
}

declare class EventDispatcher<TContext extends AnyRecord = AnyRecord> {
    private readonly tree;
    private readonly guards;
    constructor(tree: StateTree<TContext>, guards: GuardRegistry<TContext>);
    resolve(from: HsmSnapshot<TContext>, event: HsmEvent, context: TContext): Promise<HsmResolvedEventTransition<TContext> | null>;
    private eventRefs;
    private normalize;
    private resolveTarget;
    private resolveParams;
    private resolveContextPatch;
}

declare class StateResolver<TContext extends AnyRecord = AnyRecord> {
    private readonly tree;
    private readonly guards;
    constructor(tree: StateTree<TContext>, guards: GuardRegistry<TContext>);
    resolve(stateId: string, fallbackContext: TContext, options?: HsmResolveOptions<TContext>, route?: HsmRouteMatch<TContext>): Promise<HsmResolvedState<TContext>>;
    resolveInitial(rootInitial: string | undefined, context: TContext, options?: Omit<HsmResolveOptions<TContext>, "context">): Promise<HsmResolvedState<TContext>>;
    private expandSemanticNode;
    private selectChild;
    private resolveTargetNode;
    private mergeMeta;
}

declare class PathComposer {
    private constructor();
    static join(fragments: readonly (string | undefined)[]): string | null;
    static appendSearchAndHash(pathname: string, query?: AnyRecord, hash?: string): string;
    static assertRelativeOrAbsolutePath(path: string): void;
}

interface ParsedHsmUrl {
    readonly pathname: string;
    readonly query: AnyRecord;
    readonly hash: string;
}
declare class UrlTools {
    private constructor();
    static parse(input: string, baseUrl?: string): ParsedHsmUrl;
    static normalizePathname(pathname: string): string;
    static encodeQuery(query: AnyRecord | undefined): string;
    static encodeHash(hash: string | undefined): string;
    private static searchParamsToRecord;
}

interface RouteSegmentProjection {
    readonly stateId: string;
    readonly mode: HsmUrlMode;
    readonly canonicalFragment?: string;
    readonly aliases: readonly string[];
    readonly redirectAliases: boolean;
    readonly priority: number;
}
interface ProjectedRoutePattern {
    readonly pattern: string;
    readonly canonicalPattern: string;
    readonly isAlias: boolean;
    readonly redirectToCanonical: boolean;
    readonly priority: number;
}
/**
 * Converts semantic StateNode paths into public URL projections.
 *
 * A node can remain part of the state graph while its path segment is hidden from the URL.
 * This keeps HSM ids semantic (`app.profile.owner`) without forcing architectural nodes
 * into public URLs (`/profile/yusuf` instead of `/app/profile/yusuf`).
 */
declare class RouteProjection<TContext extends AnyRecord = AnyRecord> {
    private constructor();
    static mode(node: StateNode<any>): HsmUrlMode;
    static canonicalFragment(node: StateNode<any>): string | undefined;
    static aliases(node: StateNode<any>): readonly string[];
    static priority(node: StateNode<any>): number;
    static redirectsAliases(node: StateNode<any>): boolean;
    static isSelfRoutable(node: StateNode<any>): boolean;
    static segment(node: StateNode<any>): RouteSegmentProjection;
    static canonicalPattern(node: StateNode<any>): string | null;
    static projectedPatterns(node: StateNode<any>): readonly ProjectedRoutePattern[];
    private static buildVariants;
    private static fragmentChoices;
    private static preferPattern;
}

interface HsmTransitionPlan<TContext extends AnyRecord = AnyRecord> {
    readonly from: HsmSnapshot<TContext> | null;
    readonly to: HsmResolvedState<TContext>;
    readonly leaving: readonly StateNode<TContext>[];
    readonly entering: readonly StateNode<TContext>[];
    readonly common: readonly StateNode<TContext>[];
}
declare class TransitionPlanner<TContext extends AnyRecord = AnyRecord> {
    private readonly tree;
    constructor(tree: StateTree<TContext>);
    plan(from: HsmSnapshot<TContext> | null, to: HsmResolvedState<TContext>): HsmTransitionPlan<TContext>;
}

interface LifecycleInput<TContext extends AnyRecord = AnyRecord> {
    readonly plan: HsmTransitionPlan<TContext>;
    readonly signal: AbortSignal;
    readonly event?: HsmEvent;
    readonly data?: Readonly<AnyRecord>;
    readonly lifecycle: HsmTransitionLifecycleRecord[];
}
declare class TransitionLifecycle<TContext extends AnyRecord = AnyRecord> {
    private readonly guards;
    private readonly actions;
    constructor(guards: GuardRegistry<TContext>, actions: ActionRegistry<TContext>);
    runBefore(input: LifecycleInput<TContext>): Promise<void>;
    runLeave(input: LifecycleInput<TContext>): Promise<void>;
    runEnter(input: LifecycleInput<TContext>): Promise<void>;
    runAfterEnter(input: LifecycleInput<TContext>): Promise<void>;
    private guardInput;
    private actionInput;
    private assertNotAborted;
}

declare class TransitionResultFactory<TContext extends AnyRecord = AnyRecord> {
    success(args: {
        readonly cause: HsmTransitionCause;
        readonly from: HsmSnapshot<TContext> | null;
        readonly snapshot: HsmSnapshot<TContext>;
        readonly data: Readonly<AnyRecord>;
        readonly lifecycle: readonly HsmTransitionLifecycleRecord[];
        readonly redirect?: HsmResolvedRedirect;
    }): HsmTransitionResult<TContext>;
    failure(args: {
        readonly cause: HsmTransitionCause;
        readonly from: HsmSnapshot<TContext> | null;
        readonly targetStateId?: string;
        readonly error: unknown;
        readonly reason?: HsmTransitionFailureReason;
    }): HsmTransitionResult<TContext>;
    private reasonFor;
    private isAbortError;
}

interface TransitionRunInput<TContext extends AnyRecord = AnyRecord> {
    readonly from: HsmSnapshot<TContext> | null;
    readonly resolved: HsmResolvedState<TContext>;
    readonly signal: AbortSignal;
    readonly cause: HsmTransitionCause;
    readonly event?: HsmEvent;
    readonly skipLifecycle?: boolean;
    readonly redirect?: HsmResolvedRedirect;
    readonly commit: (snapshot: HsmSnapshot<TContext>) => void;
}
declare class TransitionManager<TContext extends AnyRecord = AnyRecord> {
    private readonly planner;
    private readonly lifecycle;
    private readonly loaders;
    private readonly snapshots;
    private readonly results;
    constructor(planner: TransitionPlanner<TContext>, lifecycle: TransitionLifecycle<TContext>, loaders: LoaderRunner<TContext>, snapshots: SnapshotFactory<TContext>, results: TransitionResultFactory<TContext>);
    run(input: TransitionRunInput<TContext>): Promise<HsmTransitionResult<TContext>>;
    private assertNotAborted;
    private reasonForStage;
}

declare class TransitionAbortController {
    private active;
    next(externalSignal?: AbortSignal): AbortController;
    clear(controller: AbortController): void;
    cancel(reason?: unknown): void;
}

declare class ObjectPath {
    readonly raw: string;
    readonly parts: readonly string[];
    constructor(raw: string);
    static normalize(raw: string | undefined, fallback: string): string;
    static normalize(raw: string): string;
    get(input: AnyRecord): unknown;
    set<TContext extends AnyRecord>(input: TContext, value: unknown): TContext;
    private setAt;
    private static isRecord;
}

interface QueryDecodeResult {
    readonly accepted: boolean;
    readonly value?: unknown;
}
interface QueryProjectionResult {
    readonly key: string;
    readonly value: string | readonly string[] | null;
}
declare class QueryBinding<TContext extends AnyRecord = AnyRecord> {
    readonly schemaKey: string;
    readonly queryKey: string;
    readonly source: ObjectPath;
    readonly type: HsmQueryType;
    readonly expose: boolean;
    readonly omitDefault: boolean;
    readonly invalid: HsmQueryInvalidPolicy;
    readonly defaultValue: unknown;
    private readonly config;
    constructor(schemaKey: string, config: HsmQueryBinding<TContext>);
    readContext(context: TContext): unknown;
    writeContext(context: TContext, value: unknown): TContext;
    decode(rawQuery: AnyRecord, context: TContext): QueryDecodeResult;
    project(context: TContext): QueryProjectionResult | null;
    private isValid;
    private inferType;
}

declare class QueryCodec {
    private constructor();
    static decode(raw: unknown, type: HsmQueryType): unknown;
    static encode(value: unknown, type: HsmQueryType): string | readonly string[] | null;
    private static toSingleString;
    private static toNumber;
    private static toBoolean;
    private static toJson;
    private static toArray;
    private static expectArray;
}

type QueryHelperOptions<TContext extends AnyRecord = AnyRecord> = Omit<HsmQueryBinding<TContext>, "type" | "default">;
declare const query: Readonly<{
    string<TContext extends AnyRecord = AnyRecord>(defaultValue?: string, options?: QueryHelperOptions<TContext>): HsmQueryBinding<TContext>;
    number<TContext extends AnyRecord = AnyRecord>(defaultValue?: number, options?: QueryHelperOptions<TContext>): HsmQueryBinding<TContext>;
    boolean<TContext extends AnyRecord = AnyRecord>(defaultValue?: boolean, options?: QueryHelperOptions<TContext>): HsmQueryBinding<TContext>;
    stringArray<TContext extends AnyRecord = AnyRecord>(defaultValue?: readonly string[], options?: QueryHelperOptions<TContext>): HsmQueryBinding<TContext>;
    numberArray<TContext extends AnyRecord = AnyRecord>(defaultValue?: readonly number[], options?: QueryHelperOptions<TContext>): HsmQueryBinding<TContext>;
    booleanArray<TContext extends AnyRecord = AnyRecord>(defaultValue?: readonly boolean[], options?: QueryHelperOptions<TContext>): HsmQueryBinding<TContext>;
    json<TContext extends AnyRecord = AnyRecord>(defaultValue: unknown, options?: QueryHelperOptions<TContext>): HsmQueryBinding<TContext>;
}>;

interface PolicyEvaluationInput<TContext extends AnyRecord = AnyRecord> {
    readonly key: string;
    readonly kind: HsmPolicyKind;
    readonly state: StateNode<TContext>;
    readonly activePath: readonly StateNode<TContext>[];
    readonly context: TContext;
    readonly params: AnyRecord;
    readonly rule?: HsmPolicyDefinition<TContext>;
    readonly inheritedFrom: readonly string[];
    readonly deniedBy: readonly string[];
}
declare class PolicyEvaluator<TContext extends AnyRecord = AnyRecord> {
    private readonly guards;
    constructor(guards: GuardRegistry<TContext>);
    evaluate(input: PolicyEvaluationInput<TContext>): Promise<HsmPolicyDecision>;
    private guardInput;
    private normalizeRule;
    private firstGuardName;
    private decision;
}

interface PolicyInheritanceSet {
    readonly allowed: ReadonlyMap<string, readonly string[]>;
    readonly denied: ReadonlyMap<string, readonly string[]>;
}
interface PolicyInheritanceSnapshot {
    readonly permissions: PolicyInheritanceSet;
    readonly capabilities: PolicyInheritanceSet;
    readonly features: PolicyInheritanceSet;
    readonly layout?: string;
}
declare class PolicyInheritance<TContext extends AnyRecord = AnyRecord> {
    collect(activePath: readonly StateNode<TContext>[]): PolicyInheritanceSnapshot;
    private collectKind;
    private resolveLayout;
    private push;
    private freezeMap;
}

declare class PermissionResolver<TContext extends AnyRecord = AnyRecord> {
    private readonly engine;
    constructor(engine: PolicyEngine<TContext>);
    can(snapshot: HsmSnapshot<TContext> | null | undefined, permission: string): boolean;
    list(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[];
    denied(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[];
    explain(snapshot: HsmSnapshot<TContext>, permission: string): Promise<HsmPolicyDecision>;
}

declare class CapabilityResolver<TContext extends AnyRecord = AnyRecord> {
    private readonly engine;
    constructor(engine: PolicyEngine<TContext>);
    canUse(snapshot: HsmSnapshot<TContext> | null | undefined, capability: string): boolean;
    list(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[];
    denied(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[];
    explain(snapshot: HsmSnapshot<TContext>, capability: string): Promise<HsmPolicyDecision>;
}

declare class FeatureResolver<TContext extends AnyRecord = AnyRecord> {
    private readonly engine;
    constructor(engine: PolicyEngine<TContext>);
    enabled(snapshot: HsmSnapshot<TContext> | null | undefined, feature: string): boolean;
    list(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[];
    denied(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[];
    explain(snapshot: HsmSnapshot<TContext>, feature: string): Promise<HsmPolicyDecision>;
}

declare class LayoutResolver<TContext extends AnyRecord = AnyRecord> {
    resolve(activePath: readonly StateNode<TContext>[]): string | undefined;
}

export { ActionRegistry, AnyRecord, CapabilityResolver, EventDispatcher, FeatureResolver, GuardRegistry, HsmEvent, HsmPolicyDecision, HsmPolicyDefinition, HsmPolicyKind, HsmQueryBinding, HsmQueryInvalidPolicy, HsmQueryType, HsmResolveOptions, HsmResolvedEventTransition, HsmResolvedRedirect, HsmResolvedState, HsmRouteMatch, HsmSnapshot, HsmTransitionCause, HsmTransitionFailureReason, HsmTransitionLifecycleRecord, HsmTransitionResult, HsmUrlMode, LayoutResolver, LoaderRegistry, LoaderRunner, ObjectPath, PathComposer, PermissionResolver, PolicyEngine, PolicyEvaluator, PolicyInheritance, QueryBinding, QueryCodec, RouteProjection, StateNode, StateResolver, StateTree, TransitionAbortController, TransitionLifecycle, TransitionManager, TransitionPlanner, TransitionResultFactory, UrlTools, query };
