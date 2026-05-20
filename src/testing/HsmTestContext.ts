import type { AnyRecord, HsmSnapshot, HsmTransitionResult } from "../core/types.js";
import type { HsmRuntimeAdapter } from "./types.js";
import { deepMerge } from "../utils/merge.js";

export class HsmTestContext<TContext extends AnyRecord = AnyRecord> {
  public constructor(
    public readonly adapter: HsmRuntimeAdapter<TContext>,
    public readonly initialContext: TContext
  ) {
    this.currentContext = initialContext;
  }

  public currentContext: TContext;
  public currentSnapshot: HsmSnapshot<TContext> | null = null;
  public lastTransition: HsmTransitionResult<TContext> | null = null;
  public lastUrl: string | null = null;

  public patchContext(patch: Partial<TContext>): void {
    this.currentContext = deepMerge(this.currentContext, patch);
  }
}
