import type {
  AnyRecord,
  HsmEvent,
  HsmEventTransitionConfig,
  HsmEventTransitionInput,
  HsmEventTransitionRef,
  HsmResolvedEventTransition,
  HsmSnapshot
} from "../core/types.js";
import { StateTree } from "../core/StateTree.js";
import type { StateNode } from "../core/StateNode.js";
import { GuardRegistry } from "../guards/GuardRegistry.js";

export class EventDispatcher<TContext extends AnyRecord = AnyRecord> {
  public constructor(
    private readonly tree: StateTree<TContext>,
    private readonly guards: GuardRegistry<TContext>
  ) {}

  public async resolve(
    from: HsmSnapshot<TContext>,
    event: HsmEvent,
    context: TContext
  ): Promise<HsmResolvedEventTransition<TContext> | null> {
    const path = from.activePath.map((stateId) => this.tree.get(stateId)).reverse();

    for (const origin of path) {
      const refs = this.eventRefs(origin, event.type);
      for (const ref of refs) {
        const config = this.normalize(ref);
        const target = this.resolveTarget(origin, config.target);
        const input: HsmEventTransitionInput<TContext> = { event, context, from, state: origin };
        const params = await this.resolveParams(config, input);
        const accepted = await this.guards.accepts(
          {
            context,
            state: target,
            stateId: target.id,
            params,
            meta: target.meta,
            event,
            fromStateId: origin.id,
            toStateId: target.id
          },
          config.guard
        );

        if (!accepted) continue;

        const patch = await this.resolveContextPatch(config, input);
        return Object.freeze({
          target: target.id,
          params: Object.freeze(params),
          ...(patch ? { contextPatch: Object.freeze(patch) as Partial<TContext> } : {}),
          ...(config.actions ? { actions: config.actions } : {}),
          originStateId: origin.id
        });
      }
    }

    return null;
  }

  private eventRefs(
    state: StateNode<TContext>,
    type: string
  ): readonly HsmEventTransitionRef<TContext>[] {
    const ref = state.config.on?.[type];
    if (!ref) return [];
    return Array.isArray(ref)
      ? ref as readonly HsmEventTransitionRef<TContext>[]
      : [ref as HsmEventTransitionRef<TContext>];
  }

  private normalize(ref: HsmEventTransitionRef<TContext>): HsmEventTransitionConfig<TContext> {
    if (typeof ref === "string") return { target: ref };
    return ref;
  }

  private resolveTarget(origin: StateNode<TContext>, target: string): StateNode<TContext> {
    if (this.tree.has(target)) return this.tree.get(target);
    return origin.parent?.child(target) ?? origin.child(target);
  }

  private async resolveParams(
    config: HsmEventTransitionConfig<TContext>,
    input: HsmEventTransitionInput<TContext>
  ): Promise<AnyRecord> {
    if (!config.params) return {};
    if (typeof config.params === "function") return config.params(input);
    return { ...config.params };
  }

  private async resolveContextPatch(
    config: HsmEventTransitionConfig<TContext>,
    input: HsmEventTransitionInput<TContext>
  ): Promise<Partial<TContext> | undefined> {
    if (!config.context) return undefined;
    if (typeof config.context === "function") return config.context(input);
    return { ...config.context };
  }
}
