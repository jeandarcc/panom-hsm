import type {
  AnyRecord,
  HsmEvent,
  HsmResolvedRedirect,
  HsmResolvedState,
  HsmSnapshot,
  HsmTransitionCause,
  HsmTransitionFailureReason,
  HsmTransitionLifecycleRecord,
  HsmTransitionResult
} from "../core/types.js";
import { SnapshotFactory } from "../core/SnapshotFactory.js";
import { LoaderRunner } from "../loaders/LoaderRunner.js";
import { TransitionLifecycle } from "./TransitionLifecycle.js";
import { TransitionPlanner } from "./TransitionPlanner.js";
import { TransitionResultFactory } from "./TransitionResultFactory.js";

export interface TransitionRunInput<TContext extends AnyRecord = AnyRecord> {
  readonly from: HsmSnapshot<TContext> | null;
  readonly resolved: HsmResolvedState<TContext>;
  readonly signal: AbortSignal;
  readonly cause: HsmTransitionCause;
  readonly event?: HsmEvent;
  readonly skipLifecycle?: boolean;
  readonly redirect?: HsmResolvedRedirect;
  readonly commit: (snapshot: HsmSnapshot<TContext>) => void;
}

export class TransitionManager<TContext extends AnyRecord = AnyRecord> {
  public constructor(
    private readonly planner: TransitionPlanner<TContext>,
    private readonly lifecycle: TransitionLifecycle<TContext>,
    private readonly loaders: LoaderRunner<TContext>,
    private readonly snapshots: SnapshotFactory<TContext>,
    private readonly results: TransitionResultFactory<TContext>
  ) {}

  public async run(input: TransitionRunInput<TContext>): Promise<HsmTransitionResult<TContext>> {
    const lifecycle: HsmTransitionLifecycleRecord[] = [];
    let stage: "guards" | "loaders" | "leave" | "enter" | "afterEnter" | "commit" = "guards";

    try {
      this.assertNotAborted(input.signal);
      const plan = this.planner.plan(input.from, input.resolved);

      if (!input.skipLifecycle) {
        await this.lifecycle.runBefore({
          plan,
          signal: input.signal,
          ...(input.event ? { event: input.event } : {}),
          lifecycle
        });
      }

      stage = "loaders";
      const data = await this.loaders.run({
        from: input.from,
        to: input.resolved,
        entering: plan.entering,
        signal: input.signal,
        ...(input.event ? { event: input.event } : {}),
        lifecycle
      });

      const resolvedWithData: HsmResolvedState<TContext> = Object.freeze({
        ...input.resolved,
        data
      });

      if (!input.skipLifecycle) {
        stage = "leave";
        await this.lifecycle.runLeave({
          plan,
          signal: input.signal,
          ...(input.event ? { event: input.event } : {}),
          data,
          lifecycle
        });
      }

      stage = "commit";
      const snapshot = this.snapshots.create(resolvedWithData, input.redirect);
      input.commit(snapshot);

      if (!input.skipLifecycle) {
        stage = "enter";
        await this.lifecycle.runEnter({
          plan,
          signal: input.signal,
          ...(input.event ? { event: input.event } : {}),
          data,
          lifecycle
        });

        stage = "afterEnter";
        await this.lifecycle.runAfterEnter({
          plan,
          signal: input.signal,
          ...(input.event ? { event: input.event } : {}),
          data,
          lifecycle
        });
      }

      return this.results.success({
        cause: input.cause,
        from: input.from,
        snapshot,
        data,
        lifecycle,
        ...(input.redirect ? { redirect: input.redirect } : {})
      });
    } catch (error) {
      const reason = this.reasonForStage(stage, error);
      return this.results.failure({
        cause: input.cause,
        from: input.from,
        targetStateId: input.resolved.node.id,
        error,
        ...(reason ? { reason } : {})
      });
    }
  }

  private assertNotAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new DOMException("Transition aborted.", "AbortError");
    }
  }

  private reasonForStage(stage: string, error: unknown): HsmTransitionFailureReason | undefined {
    if (error instanceof DOMException && error.name === "AbortError") return "aborted";
    if (stage === "loaders") return "loader_failed";
    if (stage === "leave" || stage === "enter" || stage === "afterEnter") return "action_failed";
    return undefined;
  }
}
