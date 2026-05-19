import type {
  AnyRecord,
  HsmActionInput,
  HsmEvent,
  HsmGuardInput,
  HsmResolvedState,
  HsmSnapshot,
  HsmTransitionLifecycleRecord
} from "../core/types.js";
import type { StateNode } from "../core/StateNode.js";
import { ActionRegistry } from "../actions/ActionRegistry.js";
import { GuardRegistry } from "../guards/GuardRegistry.js";
import type { HsmTransitionPlan } from "./TransitionPlanner.js";

export interface LifecycleInput<TContext extends AnyRecord = AnyRecord> {
  readonly plan: HsmTransitionPlan<TContext>;
  readonly signal: AbortSignal;
  readonly event?: HsmEvent;
  readonly data?: Readonly<AnyRecord>;
  readonly lifecycle: HsmTransitionLifecycleRecord[];
}

export class TransitionLifecycle<TContext extends AnyRecord = AnyRecord> {
  public constructor(
    private readonly guards: GuardRegistry<TContext>,
    private readonly actions: ActionRegistry<TContext>
  ) {}

  public async runBefore(input: LifecycleInput<TContext>): Promise<void> {
    for (const state of input.plan.leaving) {
      this.assertNotAborted(input.signal);
      await this.guards.assertAll(this.guardInput(state, input.plan.to, input.signal, input.event, input.plan.from), state.config.beforeLeave);
      if (state.config.beforeLeave) input.lifecycle.push(Object.freeze({ phase: "beforeLeave", stateId: state.id }));
    }

    for (const state of input.plan.entering) {
      this.assertNotAborted(input.signal);
      await this.guards.assertAll(this.guardInput(state, input.plan.to, input.signal, input.event, input.plan.from), state.config.beforeEnter);
      if (state.config.beforeEnter) input.lifecycle.push(Object.freeze({ phase: "beforeEnter", stateId: state.id }));
    }
  }

  public async runLeave(input: LifecycleInput<TContext>): Promise<void> {
    for (const state of input.plan.leaving) {
      this.assertNotAborted(input.signal);
      const actionInput = this.actionInput(state, input.plan.to, input.signal, input.event, input.plan.from, input.data);
      await this.actions.runAll(actionInput, state.config.onLeave);
      await this.actions.runAll(actionInput, state.config.exit);
      if (state.config.onLeave || state.config.exit) {
        input.lifecycle.push(Object.freeze({ phase: "onLeave", stateId: state.id }));
      }
    }
  }

  public async runEnter(input: LifecycleInput<TContext>): Promise<void> {
    for (const state of input.plan.entering) {
      this.assertNotAborted(input.signal);
      const actionInput = this.actionInput(state, input.plan.to, input.signal, input.event, input.plan.from, input.data);
      await this.actions.runAll(actionInput, state.config.entry);
      await this.actions.runAll(actionInput, state.config.onEnter);
      if (state.config.entry || state.config.onEnter) {
        input.lifecycle.push(Object.freeze({ phase: "onEnter", stateId: state.id }));
      }
    }
  }

  public async runAfterEnter(input: LifecycleInput<TContext>): Promise<void> {
    for (const state of input.plan.entering) {
      this.assertNotAborted(input.signal);
      const actionInput = this.actionInput(state, input.plan.to, input.signal, input.event, input.plan.from, input.data);
      await this.actions.runAll(actionInput, state.config.afterEnter);
      if (state.config.afterEnter) {
        input.lifecycle.push(Object.freeze({ phase: "afterEnter", stateId: state.id }));
      }
    }
  }

  private guardInput(
    state: StateNode<TContext>,
    to: HsmResolvedState<TContext>,
    signal: AbortSignal,
    event: HsmEvent | undefined,
    from: HsmSnapshot<TContext> | null
  ): HsmGuardInput<TContext> {
    return {
      context: to.context,
      state,
      stateId: state.id,
      params: to.params,
      meta: state.meta,
      signal,
      ...(event ? { event } : {}),
      ...(from ? { fromStateId: from.stateId } : {}),
      toStateId: to.node.id
    };
  }

  private actionInput(
    state: StateNode<TContext>,
    to: HsmResolvedState<TContext>,
    signal: AbortSignal,
    event: HsmEvent | undefined,
    from: HsmSnapshot<TContext> | null,
    data: Readonly<AnyRecord> | undefined
  ): HsmActionInput<TContext> {
    return {
      context: to.context,
      state,
      stateId: state.id,
      params: to.params,
      meta: state.meta,
      signal,
      ...(event ? { event } : {}),
      ...(from ? { fromStateId: from.stateId } : {}),
      toStateId: to.node.id,
      ...(data ? { data } : {})
    };
  }

  private assertNotAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new DOMException("Transition aborted.", "AbortError");
    }
  }
}
