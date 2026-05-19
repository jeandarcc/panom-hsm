import type { AnyRecord, HsmGuardMap, HsmMachineConfig, HsmSnapshot, HsmUrlResolveOptions, MaybePromise } from "../core/types.js";
import type { HsmSchema, HsmSchemaStateIndexEntry } from "../schema/HsmSchema.js";

export interface HsmBackendRequest {
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

export interface HsmBackendContextInput<TRequest extends HsmBackendRequest = HsmBackendRequest> {
  readonly request: TRequest;
  readonly url: string;
  readonly method: string;
  readonly schema: HsmSchema;
}

export type HsmBackendContextFactory<
  TContext extends AnyRecord = AnyRecord,
  TRequest extends HsmBackendRequest = HsmBackendRequest
> = (input: HsmBackendContextInput<TRequest>) => MaybePromise<TContext>;

export interface HsmBackendRuntimeConfig<
  TContext extends AnyRecord = AnyRecord,
  TRequest extends HsmBackendRequest = HsmBackendRequest
> {
  readonly schema: HsmSchema;
  readonly context?: TContext | HsmBackendContextFactory<TContext, TRequest>;
  readonly guards?: HsmGuardMap<TContext>;
  readonly actions?: HsmMachineConfig<TContext>["actions"];
  readonly loaders?: HsmMachineConfig<TContext>["loaders"];
  readonly baseUrl?: string;
  readonly resolveOptions?: Omit<HsmUrlResolveOptions<TContext>, "context" | "baseUrl">;
}

export type HsmBackendResolveFailureReason =
  | "route_not_found"
  | "method_not_allowed"
  | "backend_guard_failed"
  | "guard_failed"
  | "query_invalid"
  | "schema_invalid"
  | "permission_denied"
  | "capability_unavailable"
  | "feature_disabled"
  | "error";

export interface HsmBackendResolveSuccess<TContext extends AnyRecord = AnyRecord> {
  readonly ok: true;
  readonly request: HsmBackendRequest;
  readonly method: string;
  readonly url: string;
  readonly snapshot: HsmSnapshot<TContext>;
  readonly state: HsmSchemaStateIndexEntry;
  readonly canonicalUrl: string;
}

export interface HsmBackendResolveFailure {
  readonly ok: false;
  readonly request: HsmBackendRequest;
  readonly method: string;
  readonly url: string;
  readonly reason: HsmBackendResolveFailureReason;
  readonly status: number;
  readonly error: unknown;
}

export type HsmBackendResolveResult<TContext extends AnyRecord = AnyRecord> =
  | HsmBackendResolveSuccess<TContext>
  | HsmBackendResolveFailure;

export interface HsmBackendResolveOptions<TContext extends AnyRecord = AnyRecord> {
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

export interface HsmBackendMiddlewareOptions<TContext extends AnyRecord = AnyRecord> extends HsmBackendResolveOptions<TContext> {
  readonly attachTo?: string;
  readonly exposeErrorBody?: boolean;
}

export type HsmBackendNext = (error?: unknown) => void;
export interface HsmBackendResponse {
  status?: (code: number) => HsmBackendResponse;
  json?: (body: unknown) => unknown;
  send?: (body: unknown) => unknown;
  end?: () => unknown;
  [key: string]: unknown;
}
export type HsmBackendMiddleware<TRequest extends HsmBackendRequest = HsmBackendRequest> = (
  req: TRequest,
  res: HsmBackendResponse,
  next: HsmBackendNext
) => unknown;
