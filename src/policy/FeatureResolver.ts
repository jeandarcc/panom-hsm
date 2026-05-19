import type { AnyRecord, HsmPolicyDecision, HsmSnapshot } from "../core/types.js";
import { PolicyEngine } from "./PolicyEngine.js";

export class FeatureResolver<TContext extends AnyRecord = AnyRecord> {
  public constructor(private readonly engine: PolicyEngine<TContext>) {}
  public enabled(snapshot: HsmSnapshot<TContext> | null | undefined, feature: string): boolean {
    return this.engine.isAllowed(snapshot, "feature", feature);
  }
  public list(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[] {
    return this.engine.list(snapshot, "feature");
  }
  public denied(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[] {
    return this.engine.denied(snapshot, "feature");
  }
  public async explain(snapshot: HsmSnapshot<TContext>, feature: string): Promise<HsmPolicyDecision> {
    return this.engine.explain("feature", feature, snapshot);
  }
}
