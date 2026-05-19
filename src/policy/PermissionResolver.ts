import type { AnyRecord, HsmPolicyDecision, HsmSnapshot } from "../core/types.js";
import { PolicyEngine } from "./PolicyEngine.js";

export class PermissionResolver<TContext extends AnyRecord = AnyRecord> {
  public constructor(private readonly engine: PolicyEngine<TContext>) {}
  public can(snapshot: HsmSnapshot<TContext> | null | undefined, permission: string): boolean {
    return this.engine.isAllowed(snapshot, "permission", permission);
  }
  public list(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[] {
    return this.engine.list(snapshot, "permission");
  }
  public denied(snapshot: HsmSnapshot<TContext> | null | undefined): readonly string[] {
    return this.engine.denied(snapshot, "permission");
  }
  public async explain(snapshot: HsmSnapshot<TContext>, permission: string): Promise<HsmPolicyDecision> {
    return this.engine.explain("permission", permission, snapshot);
  }
}
