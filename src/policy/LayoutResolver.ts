import type { AnyRecord } from "../core/types.js";
import type { StateNode } from "../core/StateNode.js";

export class LayoutResolver<TContext extends AnyRecord = AnyRecord> {
  public resolve(activePath: readonly StateNode<TContext>[]): string | undefined {
    let layout: string | undefined;
    for (const state of activePath) {
      const explicit = state.config.layout ?? state.config.meta?.layout;
      if (typeof explicit === "string" && explicit.length > 0) layout = explicit;
    }
    return layout;
  }
}
