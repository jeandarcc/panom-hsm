import type { AnyRecord } from "../../core/types.js";
import type { HsmBackendRuntime } from "../HsmBackendRuntime.js";
import type {
  HsmBackendMiddleware,
  HsmBackendMiddlewareOptions,
  HsmBackendRequest
} from "../types.js";

export function hsmExpressMiddleware<
  TContext extends AnyRecord = AnyRecord,
  TRequest extends HsmBackendRequest = HsmBackendRequest
>(
  runtime: HsmBackendRuntime<TContext, TRequest>,
  options: HsmBackendMiddlewareOptions<TContext> = {}
): HsmBackendMiddleware<TRequest> {
  return runtime.middleware(options);
}

export function requireHsmState<
  TContext extends AnyRecord = AnyRecord,
  TRequest extends HsmBackendRequest = HsmBackendRequest
>(
  runtime: HsmBackendRuntime<TContext, TRequest>,
  state: string | readonly string[],
  options: HsmBackendMiddlewareOptions<TContext> = {}
): HsmBackendMiddleware<TRequest> {
  return runtime.requireState(state, options);
}

export function requireHsmTag<
  TContext extends AnyRecord = AnyRecord,
  TRequest extends HsmBackendRequest = HsmBackendRequest
>(
  runtime: HsmBackendRuntime<TContext, TRequest>,
  tag: string | readonly string[],
  options: HsmBackendMiddlewareOptions<TContext> = {}
): HsmBackendMiddleware<TRequest> {
  return runtime.requireTag(tag, options);
}

export function requireHsmPermission<
  TContext extends AnyRecord = AnyRecord,
  TRequest extends HsmBackendRequest = HsmBackendRequest
>(
  runtime: HsmBackendRuntime<TContext, TRequest>,
  permission: string | readonly string[],
  options: HsmBackendMiddlewareOptions<TContext> = {}
): HsmBackendMiddleware<TRequest> {
  return runtime.requirePermission(permission, options);
}

export function requireHsmCapability<
  TContext extends AnyRecord = AnyRecord,
  TRequest extends HsmBackendRequest = HsmBackendRequest
>(
  runtime: HsmBackendRuntime<TContext, TRequest>,
  capability: string | readonly string[],
  options: HsmBackendMiddlewareOptions<TContext> = {}
): HsmBackendMiddleware<TRequest> {
  return runtime.requireCapability(capability, options);
}

export function requireHsmFeature<
  TContext extends AnyRecord = AnyRecord,
  TRequest extends HsmBackendRequest = HsmBackendRequest
>(
  runtime: HsmBackendRuntime<TContext, TRequest>,
  feature: string | readonly string[],
  options: HsmBackendMiddlewareOptions<TContext> = {}
): HsmBackendMiddleware<TRequest> {
  return runtime.requireFeature(feature, options);
}
