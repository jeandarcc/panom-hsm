import type {
  AnyRecord,
  HsmMeta,
  HsmResolvedState,
  HsmResolveOptions,
  HsmRouteMatch
} from "../core/types.js";
import { StateNode } from "../core/StateNode.js";
import { StateTree } from "../core/StateTree.js";
import { GuardRegistry } from "../guards/GuardRegistry.js";
import { HsmUnresolvedStateError } from "../errors/HsmErrors.js";
import { shallowMerge, unique } from "../utils/merge.js";

export class StateResolver<TContext extends AnyRecord = AnyRecord> {
  public constructor(
    private readonly tree: StateTree<TContext>,
    private readonly guards: GuardRegistry<TContext>
  ) {}

  public async resolve(
    stateId: string,
    fallbackContext: TContext,
    options: HsmResolveOptions<TContext> = {},
    route?: HsmRouteMatch<TContext>
  ): Promise<HsmResolvedState<TContext>> {
    const expandInitial = options.expandInitial ?? true;
    const context = options.context ?? fallbackContext;
    const params = options.params ?? {};

    const baseNode = this.tree.get(stateId);
    const node = await this.expandSemanticNode(baseNode, context, params, expandInitial);
    const activePath = node.activePath();
    const meta = this.mergeMeta(activePath);
    const tags = unique(activePath.flatMap((item) => [...item.tags]));

    for (const state of activePath) {
      await this.guards.assertAll(
        {
          context,
          state,
          stateId: state.id,
          params,
          meta: state.meta
        },
        state.config.guard
      );
    }

    return {
      node,
      context,
      params,
      activePath,
      meta,
      tags,
      ...(route ? { route } : {})
    };
  }

  public async resolveInitial(
    rootInitial: string | undefined,
    context: TContext,
    options: Omit<HsmResolveOptions<TContext>, "context"> = {}
  ): Promise<HsmResolvedState<TContext>> {
    const root = rootInitial ? this.tree.rootByKey(rootInitial) : this.tree.firstRoot();
    return this.resolve(root.id, context, { ...options, context });
  }

  private async expandSemanticNode(
    start: StateNode<TContext>,
    context: TContext,
    params: AnyRecord,
    expandInitial: boolean
  ): Promise<StateNode<TContext>> {
    let cursor = start;
    const visited = new Set<string>();

    while (true) {
      if (visited.has(cursor.id)) {
        throw new HsmUnresolvedStateError(cursor.id);
      }
      visited.add(cursor.id);

      const selected = await this.selectChild(cursor, context, params);
      if (selected) {
        cursor = selected;
        continue;
      }

      if (expandInitial && cursor.initial) {
        cursor = cursor.child(cursor.initial);
        continue;
      }

      return cursor;
    }
  }

  private async selectChild(
    node: StateNode<TContext>,
    context: TContext,
    params: AnyRecord
  ): Promise<StateNode<TContext> | null> {
    const rules = node.config.resolve ?? [];
    if (rules.length === 0) return null;

    for (const rule of rules) {
      const target = this.resolveTargetNode(node, rule.target);
      const accepted = await this.guards.accepts(
        {
          context,
          state: target,
          stateId: target.id,
          params,
          meta: target.meta
        },
        rule.guard
      );

      if (accepted) return target;
    }

    throw new HsmUnresolvedStateError(node.id);
  }

  private resolveTargetNode(origin: StateNode<TContext>, target: string): StateNode<TContext> {
    if (this.tree.has(target)) return this.tree.get(target);
    return origin.child(target);
  }

  private mergeMeta(activePath: readonly StateNode<TContext>[]): HsmMeta {
    return shallowMerge(activePath.map((node) => node.meta));
  }
}
