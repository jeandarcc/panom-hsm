import type { AnyRecord, HsmEvent, HsmResolvedState, HsmSnapshot, HsmTransitionLifecycleRecord } from "../core/types.js";
import type { StateNode } from "../core/StateNode.js";
import { LoaderRegistry } from "./LoaderRegistry.js";

export interface LoaderRunInput<TContext extends AnyRecord = AnyRecord> {
  readonly from: HsmSnapshot<TContext> | null;
  readonly to: HsmResolvedState<TContext>;
  readonly entering: readonly StateNode<TContext>[];
  readonly signal: AbortSignal;
  readonly event?: HsmEvent;
  readonly lifecycle: HsmTransitionLifecycleRecord[];
}

export class LoaderRunner<TContext extends AnyRecord = AnyRecord> {
  public constructor(private readonly loaders: LoaderRegistry<TContext>) {}

  public async run(input: LoaderRunInput<TContext>): Promise<AnyRecord> {
    const data: AnyRecord = {};
    const existing = input.from?.data;
    if (existing) Object.assign(data, existing);

    const statesToLoad = this.statesWithLoaders(input.to.activePath, input.entering);

    for (const state of statesToLoad) {
      const value = await this.loaders.runAll(
        {
          context: input.to.context,
          state,
          stateId: state.id,
          params: input.to.params,
          meta: state.meta,
          signal: input.signal,
          ...(input.event ? { event: input.event } : {}),
          ...(input.from ? { fromStateId: input.from.stateId } : {}),
          toStateId: input.to.node.id
        },
        state.config.loader
      );

      if (value !== undefined) {
        data[state.id] = value;
        input.lifecycle.push(Object.freeze({ phase: "load", stateId: state.id }));
      }
    }

    return Object.freeze(data);
  }

  private statesWithLoaders(
    activePath: readonly StateNode<TContext>[],
    entering: readonly StateNode<TContext>[]
  ): readonly StateNode<TContext>[] {
    const enteringIds = new Set(entering.map((state) => state.id));
    return activePath.filter((state) => state.config.loader && enteringIds.has(state.id));
  }
}
