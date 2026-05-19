import type { AnyRecord, HsmPolicyKind } from "../core/types.js";
import type { StateNode } from "../core/StateNode.js";

export interface PolicyInheritanceSet {
  readonly allowed: ReadonlyMap<string, readonly string[]>;
  readonly denied: ReadonlyMap<string, readonly string[]>;
}

export interface PolicyInheritanceSnapshot {
  readonly permissions: PolicyInheritanceSet;
  readonly capabilities: PolicyInheritanceSet;
  readonly features: PolicyInheritanceSet;
  readonly layout?: string;
}

const POLICY_FIELDS: Record<
  HsmPolicyKind,
  { readonly allow: "permissions" | "capabilities" | "features"; readonly deny: "denyPermissions" | "denyCapabilities" | "denyFeatures" }
> = {
  permission: { allow: "permissions", deny: "denyPermissions" },
  capability: { allow: "capabilities", deny: "denyCapabilities" },
  feature: { allow: "features", deny: "denyFeatures" }
};

export class PolicyInheritance<TContext extends AnyRecord = AnyRecord> {
  public collect(activePath: readonly StateNode<TContext>[]): PolicyInheritanceSnapshot {
    const permissions = this.collectKind(activePath, "permission");
    const capabilities = this.collectKind(activePath, "capability");
    const features = this.collectKind(activePath, "feature");
    const layout = this.resolveLayout(activePath);

    return Object.freeze({
      permissions,
      capabilities,
      features,
      ...(layout ? { layout } : {})
    });
  }

  private collectKind(activePath: readonly StateNode<TContext>[], kind: HsmPolicyKind): PolicyInheritanceSet {
    const fields = POLICY_FIELDS[kind];
    const allowed = new Map<string, string[]>();
    const denied = new Map<string, string[]>();

    for (const state of activePath) {
      for (const key of state.config[fields.allow] ?? []) this.push(allowed, key, state.id);
      for (const key of state.config[fields.deny] ?? []) this.push(denied, key, state.id);
    }

    return Object.freeze({
      allowed: this.freezeMap(allowed),
      denied: this.freezeMap(denied)
    });
  }

  private resolveLayout(activePath: readonly StateNode<TContext>[]): string | undefined {
    let layout: string | undefined;
    for (const state of activePath) {
      const explicit = state.config.layout ?? state.config.meta?.layout;
      if (typeof explicit === "string" && explicit.length > 0) layout = explicit;
    }
    return layout;
  }

  private push(map: Map<string, string[]>, key: string, stateId: string): void {
    const current = map.get(key) ?? [];
    current.push(stateId);
    map.set(key, current);
  }

  private freezeMap(map: Map<string, string[]>): ReadonlyMap<string, readonly string[]> {
    const output = new Map<string, readonly string[]>();
    for (const [key, value] of map.entries()) output.set(key, Object.freeze([...value]));
    return output;
  }
}
