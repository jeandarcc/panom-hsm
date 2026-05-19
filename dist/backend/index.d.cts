import { a as AnyRecord, ak as MaybePromise, af as HsmUrlResolveOptions, a0 as HsmSnapshot, o as HsmGuardMap, w as HsmMachineConfig, C as HsmPolicyKind, v as HsmMachine, G as GuardRegistry } from '../HsmMachine-CnF_DNIZ.cjs';
import { H as HsmSchema, t as HsmSchemaStateIndexEntry } from '../HsmSchema-B7viIf6x.cjs';

interface HsmBackendRequest {
    readonly method?: string;
    readonly url?: string;
    readonly originalUrl?: string;
    readonly path?: string;
    readonly query?: AnyRecord;
    readonly headers?: Record<string, string | readonly string[] | undefined>;
    readonly body?: unknown;
    readonly params?: AnyRecord;
    readonly user?: unknown;
    readonly [key: string]: unknown;
}
interface HsmBackendContextInput<TRequest extends HsmBackendRequest = HsmBackendRequest> {
    readonly request: TRequest;
    readonly url: string;
    readonly method: string;
    readonly schema: HsmSchema;
}
type HsmBackendContextFactory<TContext extends AnyRecord = AnyRecord, TRequest extends HsmBackendRequest = HsmBackendRequest> = (input: HsmBackendContextInput<TRequest>) => MaybePromise<TContext>;
interface HsmBackendRuntimeConfig<TContext extends AnyRecord = AnyRecord, TRequest extends HsmBackendRequest = HsmBackendRequest> {
    readonly schema: HsmSchema;
    readonly context?: TContext | HsmBackendContextFactory<TContext, TRequest>;
    readonly guards?: HsmGuardMap<TContext>;
    readonly actions?: HsmMachineConfig<TContext>["actions"];
    readonly loaders?: HsmMachineConfig<TContext>["loaders"];
    readonly baseUrl?: string;
    readonly resolveOptions?: Omit<HsmUrlResolveOptions<TContext>, "context" | "baseUrl">;
}
type HsmBackendResolveFailureReason = "route_not_found" | "method_not_allowed" | "backend_guard_failed" | "guard_failed" | "query_invalid" | "schema_invalid" | "permission_denied" | "capability_unavailable" | "feature_disabled" | "error";
interface HsmBackendResolveSuccess<TContext extends AnyRecord = AnyRecord> {
    readonly ok: true;
    readonly request: HsmBackendRequest;
    readonly method: string;
    readonly url: string;
    readonly snapshot: HsmSnapshot<TContext>;
    readonly state: HsmSchemaStateIndexEntry;
    readonly canonicalUrl: string;
}
interface HsmBackendResolveFailure {
    readonly ok: false;
    readonly request: HsmBackendRequest;
    readonly method: string;
    readonly url: string;
    readonly reason: HsmBackendResolveFailureReason;
    readonly status: number;
    readonly error: unknown;
}
type HsmBackendResolveResult<TContext extends AnyRecord = AnyRecord> = HsmBackendResolveSuccess<TContext> | HsmBackendResolveFailure;
interface HsmBackendResolveOptions<TContext extends AnyRecord = AnyRecord> {
    readonly context?: TContext;
    readonly baseUrl?: string;
    readonly requireState?: string | readonly string[];
    readonly requireTag?: string | readonly string[];
    readonly requirePermission?: string | readonly string[];
    readonly requireCapability?: string | readonly string[];
    readonly requireFeature?: string | readonly string[];
    readonly strict?: boolean;
    readonly resolveOptions?: Omit<HsmUrlResolveOptions<TContext>, "context" | "baseUrl">;
}
interface HsmBackendMiddlewareOptions<TContext extends AnyRecord = AnyRecord> extends HsmBackendResolveOptions<TContext> {
    readonly attachTo?: string;
    readonly exposeErrorBody?: boolean;
}
type HsmBackendNext = (error?: unknown) => void;
interface HsmBackendResponse {
    status?: (code: number) => HsmBackendResponse;
    json?: (body: unknown) => unknown;
    send?: (body: unknown) => unknown;
    end?: () => unknown;
    [key: string]: unknown;
}
type HsmBackendMiddleware<TRequest extends HsmBackendRequest = HsmBackendRequest> = (req: TRequest, res: HsmBackendResponse, next: HsmBackendNext) => unknown;

interface BackendPolicyFailure {
    readonly reason: HsmBackendResolveFailureReason;
    readonly status: number;
    readonly message: string;
    readonly kind: HsmPolicyKind;
    readonly key: string;
}
declare class BackendPolicyEnforcer<TContext extends AnyRecord = AnyRecord> {
    checkAll(snapshot: HsmSnapshot<TContext>, requirements: {
        readonly permissions?: string | readonly string[];
        readonly capabilities?: string | readonly string[];
        readonly features?: string | readonly string[];
    }): BackendPolicyFailure | null;
    private check;
    private failure;
}

declare class HsmBackendRuntime<TContext extends AnyRecord = AnyRecord, TRequest extends HsmBackendRequest = HsmBackendRequest> {
    readonly schema: HsmSchema;
    readonly hsm: HsmMachine<TContext>;
    private readonly requestResolver;
    private readonly policyEnforcer;
    private readonly stateIndex;
    private readonly config;
    constructor(config: HsmBackendRuntimeConfig<TContext, TRequest>);
    resolveRequest(request: TRequest, options?: HsmBackendResolveOptions<TContext>): Promise<HsmBackendResolveResult<TContext>>;
    assertRequest(request: TRequest, options?: HsmBackendResolveOptions<TContext>): Promise<Extract<HsmBackendResolveResult<TContext>, {
        ok: true;
    }>>;
    middleware(options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;
    requireState(state: string | readonly string[], options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;
    requireTag(tag: string | readonly string[], options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;
    requirePermission(permission: string | readonly string[], options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;
    requireCapability(capability: string | readonly string[], options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;
    requireFeature(feature: string | readonly string[], options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;
    assertPermission(request: TRequest, permission: string | readonly string[], options?: HsmBackendResolveOptions<TContext>): Promise<Extract<HsmBackendResolveResult<TContext>, {
        ok: true;
    }>>;
    private contextFor;
    private isMethodAllowed;
    private runBackendGuards;
    private matchesRequiredState;
    private matchesRequiredTag;
    private fail;
}
declare function createHsmBackend<TContext extends AnyRecord = AnyRecord, TRequest extends HsmBackendRequest = HsmBackendRequest>(config: HsmBackendRuntimeConfig<TContext, TRequest>): HsmBackendRuntime<TContext, TRequest>;

interface NormalizedBackendRequest {
    readonly method: string;
    readonly url: string;
}
declare class RequestResolver {
    normalize(request: HsmBackendRequest): NormalizedBackendRequest;
    private composePathAndQuery;
}

declare class BackendGuardRegistry<TContext extends AnyRecord = AnyRecord> extends GuardRegistry<TContext> {
    constructor(guards?: HsmGuardMap<TContext>);
}

declare function hsmExpressMiddleware<TContext extends AnyRecord = AnyRecord, TRequest extends HsmBackendRequest = HsmBackendRequest>(runtime: HsmBackendRuntime<TContext, TRequest>, options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;
declare function requireHsmState<TContext extends AnyRecord = AnyRecord, TRequest extends HsmBackendRequest = HsmBackendRequest>(runtime: HsmBackendRuntime<TContext, TRequest>, state: string | readonly string[], options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;
declare function requireHsmTag<TContext extends AnyRecord = AnyRecord, TRequest extends HsmBackendRequest = HsmBackendRequest>(runtime: HsmBackendRuntime<TContext, TRequest>, tag: string | readonly string[], options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;
declare function requireHsmPermission<TContext extends AnyRecord = AnyRecord, TRequest extends HsmBackendRequest = HsmBackendRequest>(runtime: HsmBackendRuntime<TContext, TRequest>, permission: string | readonly string[], options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;
declare function requireHsmCapability<TContext extends AnyRecord = AnyRecord, TRequest extends HsmBackendRequest = HsmBackendRequest>(runtime: HsmBackendRuntime<TContext, TRequest>, capability: string | readonly string[], options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;
declare function requireHsmFeature<TContext extends AnyRecord = AnyRecord, TRequest extends HsmBackendRequest = HsmBackendRequest>(runtime: HsmBackendRuntime<TContext, TRequest>, feature: string | readonly string[], options?: HsmBackendMiddlewareOptions<TContext>): HsmBackendMiddleware<TRequest>;

interface NodeLikeIncomingMessage {
    readonly method?: string;
    readonly url?: string;
    readonly headers?: Record<string, string | readonly string[] | undefined>;
    readonly [key: string]: unknown;
}
declare function fromNodeRequest(request: NodeLikeIncomingMessage): HsmBackendRequest;

export { BackendGuardRegistry, BackendPolicyEnforcer, type HsmBackendContextFactory, type HsmBackendContextInput, type HsmBackendMiddleware, type HsmBackendMiddlewareOptions, type HsmBackendNext, type HsmBackendRequest, type HsmBackendResolveFailure, type HsmBackendResolveFailureReason, type HsmBackendResolveOptions, type HsmBackendResolveResult, type HsmBackendResolveSuccess, type HsmBackendResponse, HsmBackendRuntime, type HsmBackendRuntimeConfig, RequestResolver, createHsmBackend, fromNodeRequest, hsmExpressMiddleware, requireHsmCapability, requireHsmFeature, requireHsmPermission, requireHsmState, requireHsmTag };
