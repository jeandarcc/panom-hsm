import type { AnyRecord, HsmResolvedState, HsmSnapshot } from "../core/types.js";
import type { StateNode } from "../core/StateNode.js";
import { StateTree } from "../core/StateTree.js";

export interface HsmTransitionPlan<TContext extends AnyRecord = AnyRecord> {
  readonly from: HsmSnapshot<TContext> | null;
  readonly to: HsmResolvedState<TContext>;
  readonly leaving: readonly StateNode<TContext>[];
  readonly entering: readonly StateNode<TContext>[];
  readonly common: readonly StateNode<TContext>[];
}

export class TransitionPlanner<TContext extends AnyRecord = AnyRecord> {
  public constructor(private readonly tree: StateTree<TContext>) {}

  public plan(from: HsmSnapshot<TContext> | null, to: HsmResolvedState<TContext>): HsmTransitionPlan<TContext> {
    if (!from) {
      return Object.freeze({
        from,
        to,
        leaving: Object.freeze([]),
        entering: Object.freeze([...to.activePath]),
        common: Object.freeze([])
      });
    }

    const fromPath = from.activePath.map((stateId) => this.tree.get(stateId));
    const toPath = [...to.activePath];
    let commonLength = 0;

    while (
      commonLength < fromPath.length &&
      commonLength < toPath.length &&
      fromPath[commonLength]?.id === toPath[commonLength]?.id
    ) {
      commonLength += 1;
    }

    const common = fromPath.slice(0, commonLength);
    const leaving = fromPath.slice(commonLength).reverse();
    const entering = toPath.slice(commonLength);

    return Object.freeze({
      from,
      to,
      leaving: Object.freeze(leaving),
      entering: Object.freeze(entering),
      common: Object.freeze(common)
    });
  }
}
