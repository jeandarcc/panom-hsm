import type { StateNode } from "./StateNode.js";

export type MaybePromise<T> = T | Promise<T>;
export type AnyRecord = Record<string, any>;
export type HsmStateId = string;
export type HsmStateValue = string | HsmStateValueObject;
export interface HsmStateValueObject {
  readonly [key: string]: HsmStateValue;
}

export type HsmContextFactory<TContext extends AnyRecord> = () => MaybePromise<TContext>;

export interface HsmMeta extends AnyRecord {
  readonly title?: string;
  readonly description?: string;
  readonly layout?: string;
  readonly path?: string;
}

export interface HsmGuardInput<TContext extends AnyRecord = AnyRecord> {
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

export type HsmGuardFn<TContext extends AnyRecord = AnyRecord> = (
  input: HsmGuardInput<TContext>
) => MaybePromise<boolean>;

export type HsmGuardRef<TContext extends AnyRecord = AnyRecord> =
  | string
  | HsmGuardFn<TContext>
  | readonly (string | HsmGuardFn<TContext>)[];

export type HsmGuardMap<TContext extends AnyRecord = AnyRecord> = Record<
  string,
  HsmGuardFn<TContext>
>;

export interface HsmActionInput<TContext extends AnyRecord = AnyRecord> {
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

export type HsmActionFn<TContext extends AnyRecord = AnyRecord> = (
  input: HsmActionInput<TContext>
) => MaybePromise<void>;

export type HsmActionRef<TContext extends AnyRecord = AnyRecord> =
  | string
  | HsmActionFn<TContext>
  | readonly (string | HsmActionFn<TContext>)[];

export type HsmActionMap<TContext extends AnyRecord = AnyRecord> = Record<
  string,
  HsmActionFn<TContext>
>;

export interface HsmLoaderInput<TContext extends AnyRecord = AnyRecord> {
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

export type HsmLoaderFn<TContext extends AnyRecord = AnyRecord> = (
  input: HsmLoaderInput<TContext>
) => MaybePromise<unknown>;

export type HsmLoaderRef<TContext extends AnyRecord = AnyRecord> =
  | string
  | HsmLoaderFn<TContext>
  | readonly (string | HsmLoaderFn<TContext>)[];

export type HsmLoaderMap<TContext extends AnyRecord = AnyRecord> = Record<
  string,
  HsmLoaderFn<TContext>
>;

export interface HsmEvent<TType extends string = string, TPayload = unknown> {
  readonly type: TType;
  readonly payload?: TPayload;
}

export interface HsmEventTransitionInput<TContext extends AnyRecord = AnyRecord> {
  readonly event: HsmEvent;
  readonly context: Readonly<TContext>;
  readonly from: HsmSnapshot<TContext>;
  readonly state: StateNode<TContext>;
}

export type HsmEventParamsFactory<TContext extends AnyRecord = AnyRecord> = (
  input: HsmEventTransitionInput<TContext>
) => MaybePromise<AnyRecord>;

export type HsmEventContextFactory<TContext extends AnyRecord = AnyRecord> = (
  input: HsmEventTransitionInput<TContext>
) => MaybePromise<Partial<TContext>>;

export interface HsmEventTransitionConfig<TContext extends AnyRecord = AnyRecord> {
  readonly target: HsmStateId;
  readonly guard?: HsmGuardRef<TContext>;
  readonly params?: AnyRecord | HsmEventParamsFactory<TContext>;
  readonly context?: Partial<TContext> | HsmEventContextFactory<TContext>;
  readonly actions?: HsmActionRef<TContext>;
}

export type HsmEventTransitionRef<TContext extends AnyRecord = AnyRecord> =
  | HsmStateId
  | HsmEventTransitionConfig<TContext>;

export type HsmEventMap<TContext extends AnyRecord = AnyRecord> = Record<
  string,
  HsmEventTransitionRef<TContext> | readonly HsmEventTransitionRef<TContext>[]
>;

export interface HsmSelectionRule<TContext extends AnyRecord = AnyRecord> {
  readonly target: HsmStateId;
  readonly guard?: HsmGuardRef<TContext>;
}

export type HsmRedirectTarget<TContext extends AnyRecord = AnyRecord> =
  | string
  | ((input: HsmRouteContext<TContext>) => MaybePromise<string>);

export type HsmUrlMode = "visible" | "hidden" | "virtual";
export type HsmRouteEntryKind = "canonical" | "alias";

export interface HsmStateUrlConfig {
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

export interface HsmStateBackendConfig<TContext extends AnyRecord = AnyRecord> {
  readonly routes?: readonly string[];
  readonly methods?: readonly string[];
  readonly guards?: HsmGuardRef<TContext>;
  readonly meta?: AnyRecord;
}

export type HsmPolicyKind = "permission" | "capability" | "feature";

export interface HsmPolicyRule<TContext extends AnyRecord = AnyRecord> {
  readonly guard?: HsmGuardRef<TContext>;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly meta?: AnyRecord;
}

export type HsmPolicyDefinition<TContext extends AnyRecord = AnyRecord> =
  | boolean
  | HsmGuardRef<TContext>
  | HsmPolicyRule<TContext>;

export type HsmPolicyMap<TContext extends AnyRecord = AnyRecord> = Record<
  string,
  HsmPolicyDefinition<TContext>
>;

export interface HsmPolicyDefinitions<TContext extends AnyRecord = AnyRecord> {
  readonly permissions?: HsmPolicyMap<TContext>;
  readonly capabilities?: HsmPolicyMap<TContext>;
  readonly features?: HsmPolicyMap<TContext>;
}

export interface HsmPolicySource {
  readonly stateId: HsmStateId;
  readonly action: "allow" | "deny";
}

export interface HsmPolicyDecision {
  readonly key: string;
  readonly kind: HsmPolicyKind;
  readonly allowed: boolean;
  readonly reason:
    | "allowed"
    | "not_declared"
    | "state_denied"
    | "rule_denied"
    | "guard_failed"
    | "guard_missing"
    | "error";
  readonly guard?: string;
  readonly inheritedFrom: readonly string[];
  readonly deniedBy: readonly string[];
  readonly stateId: HsmStateId;
  readonly error?: unknown;
}

export interface HsmPolicySnapshot {
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

export interface HsmStateConfig<TContext extends AnyRecord = AnyRecord> {
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

export type HsmQueryType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "number[]"
  | "boolean[]"
  | "json";

export type HsmQueryInvalidPolicy = "default" | "ignore" | "throw";

export interface HsmQueryCodecInput<TContext extends AnyRecord = AnyRecord> {
  readonly key: string;
  readonly raw: unknown;
  readonly context: Readonly<TContext>;
}

export interface HsmQueryCodecOutput<TContext extends AnyRecord = AnyRecord> {
  readonly key: string;
  readonly value: unknown;
  readonly context: Readonly<TContext>;
}

export type HsmQueryDecodeFn<TContext extends AnyRecord = AnyRecord> = (
  input: HsmQueryCodecInput<TContext>
) => unknown;

export type HsmQueryEncodeFn<TContext extends AnyRecord = AnyRecord> = (
  input: HsmQueryCodecOutput<TContext>
) => string | readonly string[] | null | undefined;

export type HsmQueryValidateFn<TContext extends AnyRecord = AnyRecord> = (
  input: HsmQueryCodecOutput<TContext>
) => boolean;

export interface HsmQueryBinding<TContext extends AnyRecord = AnyRecord> {
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

export type HsmQuerySchema<TContext extends AnyRecord = AnyRecord> = Record<
  string,
  HsmQueryBinding<TContext>
>;

export interface HsmMachineConfig<TContext extends AnyRecord = AnyRecord> {
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

export interface HsmResolveOptions<TContext extends AnyRecord = AnyRecord> {
  readonly context?: TContext;
  readonly params?: AnyRecord;
  readonly expandInitial?: boolean;
}

export interface HsmResolvedState<TContext extends AnyRecord = AnyRecord> {
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

export interface HsmRouteContext<TContext extends AnyRecord = AnyRecord> {
  readonly context: Readonly<TContext>;
  readonly state: StateNode<TContext>;
  readonly stateId: HsmStateId;
  readonly params: Readonly<AnyRecord>;
  readonly pathname: string;
  readonly query: Readonly<AnyRecord>;
  readonly hash: string;
}

export interface HsmRouteEntry<TContext extends AnyRecord = AnyRecord> {
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

export interface HsmRouteMatch<TContext extends AnyRecord = AnyRecord> {
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

export interface HsmResolvedRedirect {
  readonly to: string;
  readonly from: string;
  readonly stateId: HsmStateId;
}

export interface HsmUrlState<TContext extends AnyRecord = AnyRecord> {
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

export interface HsmUrlResolveOptions<TContext extends AnyRecord = AnyRecord> {
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

export interface HsmHrefOptions<TContext extends AnyRecord = AnyRecord> {
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

export interface HsmUrlSyncOptions<TContext extends AnyRecord = AnyRecord> {
  readonly context?: TContext;
  readonly baseUrl?: string;
  readonly preserveUnknownQuery?: boolean;
  readonly query?: AnyRecord;
  readonly hash?: string;
  /** Defaults to false. If true, alias/hidden legacy paths are rewritten to canonical projected paths. */
  readonly canonicalizePath?: boolean;
}

export type HsmTransitionCause = "start" | "state" | "url" | "event";
export type HsmTransitionFailureReason =
  | "guard_failed"
  | "loader_failed"
  | "action_failed"
  | "route_not_found"
  | "unresolved_state"
  | "event_not_handled"
  | "aborted"
  | "error";

export interface HsmTransitionOptions<TContext extends AnyRecord = AnyRecord> extends HsmResolveOptions<TContext> {
  readonly contextPatch?: Partial<TContext>;
  readonly signal?: AbortSignal;
  readonly strict?: boolean;
  readonly skipLifecycle?: boolean;
  readonly cause?: HsmTransitionCause;
  readonly event?: HsmEvent;
}

export interface HsmUrlTransitionOptions<TContext extends AnyRecord = AnyRecord>
  extends HsmUrlResolveOptions<TContext> {
  readonly contextPatch?: Partial<TContext>;
  readonly signal?: AbortSignal;
  readonly strict?: boolean;
  readonly skipLifecycle?: boolean;
  readonly cause?: HsmTransitionCause;
  readonly event?: HsmEvent;
}

export interface HsmTransitionLifecycleRecord {
  readonly phase: "beforeLeave" | "beforeEnter" | "load" | "onLeave" | "onEnter" | "afterEnter";
  readonly stateId: HsmStateId;
}

export interface HsmTransitionSuccess<TContext extends AnyRecord = AnyRecord> {
  readonly ok: true;
  readonly cause: HsmTransitionCause;
  readonly from: HsmSnapshot<TContext> | null;
  readonly to: HsmSnapshot<TContext>;
  readonly snapshot: HsmSnapshot<TContext>;
  readonly data: Readonly<AnyRecord>;
  readonly lifecycle: readonly HsmTransitionLifecycleRecord[];
  readonly redirect?: HsmResolvedRedirect;
}

export interface HsmTransitionFailure<TContext extends AnyRecord = AnyRecord> {
  readonly ok: false;
  readonly cause: HsmTransitionCause;
  readonly reason: HsmTransitionFailureReason;
  readonly from: HsmSnapshot<TContext> | null;
  readonly targetStateId?: HsmStateId;
  readonly error: unknown;
  readonly aborted: boolean;
}

export type HsmTransitionResult<TContext extends AnyRecord = AnyRecord> =
  | HsmTransitionSuccess<TContext>
  | HsmTransitionFailure<TContext>;

export interface HsmResolvedEventTransition<TContext extends AnyRecord = AnyRecord> {
  readonly target: HsmStateId;
  readonly params: AnyRecord;
  readonly contextPatch?: Partial<TContext>;
  readonly actions?: HsmActionRef<TContext>;
  readonly originStateId: HsmStateId;
}

export interface HsmSnapshot<TContext extends AnyRecord = AnyRecord> {
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
