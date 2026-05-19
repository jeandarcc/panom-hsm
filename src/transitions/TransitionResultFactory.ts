import type {
  AnyRecord,
  HsmResolvedRedirect,
  HsmSnapshot,
  HsmTransitionCause,
  HsmTransitionFailureReason,
  HsmTransitionLifecycleRecord,
  HsmTransitionResult
} from "../core/types.js";
import {
  HsmGuardRejectedError,
  HsmRouteNotFoundError,
  HsmUnresolvedStateError
} from "../errors/HsmErrors.js";

export class TransitionResultFactory<TContext extends AnyRecord = AnyRecord> {
  public success(args: {
    readonly cause: HsmTransitionCause;
    readonly from: HsmSnapshot<TContext> | null;
    readonly snapshot: HsmSnapshot<TContext>;
    readonly data: Readonly<AnyRecord>;
    readonly lifecycle: readonly HsmTransitionLifecycleRecord[];
    readonly redirect?: HsmResolvedRedirect;
  }): HsmTransitionResult<TContext> {
    const result = {
      ok: true as const,
      cause: args.cause,
      from: args.from,
      to: args.snapshot,
      snapshot: args.snapshot,
      data: Object.freeze({ ...args.data }),
      lifecycle: Object.freeze([...args.lifecycle]),
      ...(args.redirect ? { redirect: args.redirect } : {})
    };
    return Object.freeze(result);
  }

  public failure(args: {
    readonly cause: HsmTransitionCause;
    readonly from: HsmSnapshot<TContext> | null;
    readonly targetStateId?: string;
    readonly error: unknown;
    readonly reason?: HsmTransitionFailureReason;
  }): HsmTransitionResult<TContext> {
    const reason = args.reason ?? this.reasonFor(args.error);
    return Object.freeze({
      ok: false as const,
      cause: args.cause,
      reason,
      from: args.from,
      ...(args.targetStateId ? { targetStateId: args.targetStateId } : {}),
      error: args.error,
      aborted: reason === "aborted"
    });
  }

  private reasonFor(error: unknown): HsmTransitionFailureReason {
    if (this.isAbortError(error)) return "aborted";
    if (error instanceof HsmGuardRejectedError) return "guard_failed";
    if (error instanceof HsmRouteNotFoundError) return "route_not_found";
    if (error instanceof HsmUnresolvedStateError) return "unresolved_state";
    return "error";
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
  }
}
