import type { AnyRecord, HsmSnapshot, HsmTransitionResult } from "../core/types.js";

export interface TransitionTraceEntry<TContext extends AnyRecord = AnyRecord> {
  readonly fromStateId: string | null;
  readonly toStateId: string | null;
  readonly ok: boolean;
  readonly cause: string;
  readonly durationMs: number;
  readonly error?: unknown;
  readonly snapshot?: HsmSnapshot<TContext>;
}

export class TransitionTrace {
  private startedAt = 0;
  private fromStateId: string | null = null;

  public start(from: HsmSnapshot | null): void {
    this.startedAt = performanceNow();
    this.fromStateId = from?.stateId ?? null;
  }

  public finish<TContext extends AnyRecord>(result: HsmTransitionResult<TContext>): TransitionTraceEntry<TContext> {
    const durationMs = Math.max(0, performanceNow() - this.startedAt);
    if (result.ok) {
      return Object.freeze({
        fromStateId: this.fromStateId,
        toStateId: result.snapshot.stateId,
        ok: true,
        cause: result.cause,
        durationMs,
        snapshot: result.snapshot
      });
    }

    return Object.freeze({
      fromStateId: result.from?.stateId ?? this.fromStateId,
      toStateId: result.targetStateId ?? null,
      ok: false,
      cause: result.cause,
      durationMs,
      error: result.error
    });
  }
}

function performanceNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}
