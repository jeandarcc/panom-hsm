import type { AnyRecord, HsmPolicyDecision, HsmSnapshot } from "../core/types.js";
import { PolicyEngine } from "./PolicyEngine.js";

export class CapabilityResolver<TContext extends AnyRecord = AnyRecord> {
  public constructor(private readonly engine: PolicyEngine<TContext>) {}
  public canUse(snapshot: HsmSnapshot<TContext> | null | undefined, capability: string): boolean {
    return this.engine.isAllowed(snapshot, "capability", capability);
  }
  public list(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[] {
    return this.engine.list(snapshot, "capability");
  }
  public denied(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[] {
    return this.engine.denied(snapshot, "capability");
  }
  public async explain(snapshot: HsmSnapshot<TContext>, capability: string): Promise<HsmPolicyDecision> {
    return this.engine.explain("capability", capability, snapshot);
  }
}
