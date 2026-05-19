import { Q as HsmQueryType, O as HsmQueryInvalidPolicy, a4 as HsmStateUrlConfig, x as HsmMeta, Z as HsmRouteEntryKind, a as AnyRecord, a7 as HsmTransitionCause, ae as HsmUrlMode } from './HsmMachine-CnF_DNIZ.cjs';

type HsmSchemaVersion = "1.0";
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | {
    readonly [key: string]: JsonValue;
};
interface HsmSchemaRefList {
    readonly refs: readonly string[];
}
interface HsmSchemaSelectionRule {
    readonly target: string;
    readonly guard?: HsmSchemaRefList;
}
interface HsmSchemaEventTransition {
    readonly target: string;
    readonly guard?: HsmSchemaRefList;
    readonly params?: JsonValue;
    readonly context?: JsonValue;
    readonly actions?: HsmSchemaRefList;
}
type HsmSchemaEventMap = Record<string, readonly HsmSchemaEventTransition[]>;
interface HsmSchemaQueryBinding {
    readonly source?: string;
    readonly key?: string;
    readonly type?: HsmQueryType;
    readonly default?: JsonValue;
    readonly expose?: boolean;
    readonly omitDefault?: boolean;
    readonly invalid?: HsmQueryInvalidPolicy;
}
type HsmSchemaQuery = Record<string, HsmSchemaQueryBinding>;
interface HsmSchemaBackendPolicy {
    /** Explicit backend route ownership, useful when several API endpoints map to one app state. */
    readonly routes?: readonly string[];
    /** HTTP methods accepted for this state when used by backend adapters. Empty/undefined means any. */
    readonly methods?: readonly string[];
    /** Optional named guard refs that are backend-only. */
    readonly guards?: HsmSchemaRefList;
    /** Security/authorization metadata intentionally kept declarative. */
    readonly meta?: Record<string, JsonValue>;
}
interface HsmSchemaPolicySet {
    readonly permissions?: readonly string[];
    readonly denyPermissions?: readonly string[];
    readonly capabilities?: readonly string[];
    readonly denyCapabilities?: readonly string[];
    readonly features?: readonly string[];
    readonly denyFeatures?: readonly string[];
    readonly layout?: string;
}
interface HsmSchemaPolicyRule {
    readonly enabled?: boolean;
    readonly guard?: HsmSchemaRefList;
    readonly description?: string;
    readonly tags?: readonly string[];
    readonly meta?: Record<string, JsonValue>;
}
type HsmSchemaPolicyMap = Record<string, HsmSchemaPolicyRule>;
interface HsmSchemaPolicyDefinitions {
    readonly permissions?: HsmSchemaPolicyMap;
    readonly capabilities?: HsmSchemaPolicyMap;
    readonly features?: HsmSchemaPolicyMap;
}
interface HsmSchemaStateNode {
    readonly key: string;
    readonly id: string;
    readonly path?: string;
    readonly url?: HsmStateUrlConfig;
    readonly initial?: string;
    readonly guard?: HsmSchemaRefList;
    readonly resolve?: readonly HsmSchemaSelectionRule[];
    readonly redirect?: string;
    readonly beforeLeave?: HsmSchemaRefList;
    readonly beforeEnter?: HsmSchemaRefList;
    readonly entry?: HsmSchemaRefList;
    readonly exit?: HsmSchemaRefList;
    readonly onEnter?: HsmSchemaRefList;
    readonly onLeave?: HsmSchemaRefList;
    readonly afterEnter?: HsmSchemaRefList;
    readonly loader?: HsmSchemaRefList;
    readonly on?: HsmSchemaEventMap;
    readonly tags?: readonly string[];
    readonly meta?: HsmMeta;
    readonly policies?: HsmSchemaPolicySet;
    readonly backend?: HsmSchemaBackendPolicy;
    readonly states?: Record<string, HsmSchemaStateNode>;
}
interface HsmSchemaStateIndexEntry {
    readonly id: string;
    readonly key: string;
    readonly parentId: string | null;
    readonly depth: number;
    readonly initial?: string;
    readonly tags: readonly string[];
    readonly meta: HsmMeta;
    readonly policies?: HsmSchemaPolicySet;
    readonly backend?: HsmSchemaBackendPolicy;
}
interface HsmSchemaRouteIndexEntry {
    readonly stateId: string;
    readonly pattern: string;
    readonly canonicalPattern: string;
    readonly kind: HsmRouteEntryKind;
    readonly isAlias: boolean;
    readonly redirectToCanonical: boolean;
    readonly priority: number;
    readonly score: number;
}
interface HsmSchemaIndex {
    readonly states: readonly HsmSchemaStateIndexEntry[];
    readonly routes: readonly HsmSchemaRouteIndexEntry[];
    readonly guards: readonly string[];
    readonly actions: readonly string[];
    readonly loaders: readonly string[];
    readonly tags: readonly string[];
}
interface HsmSchemaMetadata {
    readonly generatedAt?: string;
    readonly source?: string;
    readonly description?: string;
    readonly checksum?: string;
    readonly [key: string]: JsonValue | undefined;
}
interface HsmSchema {
    readonly kind: "panom-hsm.schema";
    readonly schemaVersion: HsmSchemaVersion;
    readonly id: string;
    readonly version: string;
    readonly initial?: string;
    readonly query?: HsmSchemaQuery;
    readonly policies?: HsmSchemaPolicyDefinitions;
    readonly states: Record<string, HsmSchemaStateNode>;
    readonly index: HsmSchemaIndex;
    readonly metadata?: HsmSchemaMetadata;
}
interface HsmSchemaCompileOptions {
    readonly version?: string;
    readonly source?: string;
    readonly description?: string;
    readonly generatedAt?: string | false;
    /** Include literal config.context when it is JSON-safe. Disabled by design to avoid leaking user/session data. */
    readonly includeContextDefaults?: boolean;
    readonly strict?: boolean;
}
interface HsmSchemaValidationIssue {
    readonly path: string;
    readonly message: string;
    readonly severity: "error" | "warning";
}
interface HsmSchemaValidationResult {
    readonly ok: boolean;
    readonly issues: readonly HsmSchemaValidationIssue[];
}
interface HsmSchemaRuntimeOptions<TContext extends AnyRecord = AnyRecord> {
    readonly context?: TContext | (() => TContext | Promise<TContext>);
    readonly guards?: Record<string, (input: any) => boolean | Promise<boolean>>;
    readonly actions?: Record<string, (input: any) => void | Promise<void>>;
    readonly loaders?: Record<string, (input: any) => unknown | Promise<unknown>>;
}
interface HsmSchemaGuardProbe {
    readonly stateId: string;
    readonly guard: string;
    readonly phase: "guard" | "resolve" | "beforeLeave" | "beforeEnter" | "backend" | "policy";
}
interface HsmSchemaActionProbe {
    readonly stateId: string;
    readonly action: string;
    readonly phase: "entry" | "exit" | "onEnter" | "onLeave" | "afterEnter" | "event";
}
interface HsmSchemaLoaderProbe {
    readonly stateId: string;
    readonly loader: string;
}
interface HsmSchemaTransitionHint {
    readonly from?: string;
    readonly to: string;
    readonly cause: HsmTransitionCause;
}
interface HsmSerializableStateUrlConfig {
    readonly mode?: HsmUrlMode;
    readonly hide?: boolean;
    readonly path?: string;
    readonly aliases?: readonly string[];
    readonly route?: boolean;
    readonly redirectAliases?: boolean;
    readonly priority?: number;
}

export type { JsonValue as A, HsmSchema as H, JsonPrimitive as J, HsmSchemaActionProbe as a, HsmSchemaBackendPolicy as b, HsmSchemaCompileOptions as c, HsmSchemaEventMap as d, HsmSchemaEventTransition as e, HsmSchemaGuardProbe as f, HsmSchemaIndex as g, HsmSchemaLoaderProbe as h, HsmSchemaMetadata as i, HsmSchemaPolicyDefinitions as j, HsmSchemaPolicyMap as k, HsmSchemaPolicyRule as l, HsmSchemaPolicySet as m, HsmSchemaQuery as n, HsmSchemaQueryBinding as o, HsmSchemaRefList as p, HsmSchemaRouteIndexEntry as q, HsmSchemaRuntimeOptions as r, HsmSchemaSelectionRule as s, HsmSchemaStateIndexEntry as t, HsmSchemaStateNode as u, HsmSchemaTransitionHint as v, HsmSchemaValidationIssue as w, HsmSchemaValidationResult as x, HsmSchemaVersion as y, HsmSerializableStateUrlConfig as z };
