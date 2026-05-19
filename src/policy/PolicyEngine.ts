import type {
  AnyRecord,
  HsmPolicyDecision,
  HsmPolicyDefinitions,
  HsmPolicyDefinition,
  HsmPolicyKind,
  HsmPolicySnapshot,
  HsmResolvedState,
  HsmSnapshot
} from "../core/types.js";
import type { StateNode } from "../core/StateNode.js";
import { StateTree } from "../core/StateTree.js";
import { GuardRegistry } from "../guards/GuardRegistry.js";
import { PolicyInheritance, type PolicyInheritanceSet } from "./PolicyInheritance.js";
import { PolicyEvaluator } from "./PolicyEvaluator.js";

type DecisionBucket = Record<string, HsmPolicyDecision>;

type PluralKind = "permissions" | "capabilities" | "features";

type DeniedPluralKind = "deniedPermissions" | "deniedCapabilities" | "deniedFeatures";

const KIND_TO_PLURAL: Record<HsmPolicyKind, PluralKind> = {
  permission: "permissions",
  capability: "capabilities",
  feature: "features"
};

const KIND_TO_DENIED_PLURAL: Record<HsmPolicyKind, DeniedPluralKind> = {
  permission: "deniedPermissions",
  capability: "deniedCapabilities",
  feature: "deniedFeatures"
};

export class PolicyEngine<TContext extends AnyRecord = AnyRecord> {
  private readonly inheritance = new PolicyInheritance<TContext>();
  private readonly evaluator: PolicyEvaluator<TContext>;

  public constructor(
    private readonly tree: StateTree<TContext>,
    guards: GuardRegistry<TContext>,
    private readonly definitions: HsmPolicyDefinitions<TContext> = {}
  ) {
    this.evaluator = new PolicyEvaluator(guards);
  }

  public async enrich(resolved: HsmResolvedState<TContext>): Promise<HsmResolvedState<TContext>> {
    const policy = await this.resolve(resolved);
    return Object.freeze({ ...resolved, policy });
  }

  public async resolve(resolved: HsmResolvedState<TContext>): Promise<HsmPolicySnapshot> {
    const inherited = this.inheritance.collect(resolved.activePath);
    const permissions = await this.resolveKind("permission", inherited.permissions, resolved);
    const capabilities = await this.resolveKind("capability", inherited.capabilities, resolved);
    const features = await this.resolveKind("feature", inherited.features, resolved);

    const snapshot: HsmPolicySnapshot = {
      permissions: Object.freeze(this.allowedKeys(permissions)),
      capabilities: Object.freeze(this.allowedKeys(capabilities)),
      features: Object.freeze(this.allowedKeys(features)),
      deniedPermissions: Object.freeze(this.deniedKeys(permissions)),
      deniedCapabilities: Object.freeze(this.deniedKeys(capabilities)),
      deniedFeatures: Object.freeze(this.deniedKeys(features)),
      decisions: Object.freeze({
        permissions: Object.freeze(permissions),
        capabilities: Object.freeze(capabilities),
        features: Object.freeze(features)
      }),
      ...(inherited.layout ? { layout: inherited.layout } : {})
    };

    return Object.freeze(snapshot);
  }

  public async explain(
    kind: HsmPolicyKind,
    key: string,
    target: HsmResolvedState<TContext> | HsmSnapshot<TContext>
  ): Promise<HsmPolicyDecision> {
    if (this.isSnapshot(target)) {
      const plural = KIND_TO_PLURAL[kind];
      const cached = target.policy?.decisions[plural][key];
      if (cached) return cached;
      const activePath = target.activePath.map((stateId) => this.tree.get(stateId));
      return this.evaluateOne(kind, key, activePath, target.context as TContext, target.params as AnyRecord);
    }
    return this.evaluateOne(kind, key, target.activePath, target.context, target.params);
  }

  public isAllowed(snapshot: HsmSnapshot<TContext> | null | undefined, kind: HsmPolicyKind, key: string): boolean {
    if (!snapshot?.policy) return false;
    const plural = KIND_TO_PLURAL[kind];
    return snapshot.policy.decisions[plural][key]?.allowed ?? false;
  }

  public list(snapshot: HsmSnapshot<TContext> | null | undefined, kind: HsmPolicyKind): readonly string[] {
    if (!snapshot?.policy) return Object.freeze([]);
    return snapshot.policy[KIND_TO_PLURAL[kind]];
  }

  public denied(snapshot: HsmSnapshot<TContext> | null | undefined, kind: HsmPolicyKind): readonly string[] {
    if (!snapshot?.policy) return Object.freeze([]);
    return snapshot.policy[KIND_TO_DENIED_PLURAL[kind]];
  }

  public layout(snapshot: HsmSnapshot<TContext> | null | undefined): string | undefined {
    return snapshot?.policy?.layout;
  }

  private async resolveKind(
    kind: HsmPolicyKind,
    inherited: PolicyInheritanceSet,
    resolved: HsmResolvedState<TContext>
  ): Promise<DecisionBucket> {
    const keys = new Set<string>([
      ...inherited.allowed.keys(),
      ...inherited.denied.keys()
    ]);
    const output: DecisionBucket = {};
    for (const key of [...keys].sort()) {
      output[key] = await this.evaluateOne(kind, key, resolved.activePath, resolved.context, resolved.params, inherited);
    }
    return output;
  }

  private async evaluateOne(
    kind: HsmPolicyKind,
    key: string,
    activePath: readonly StateNode<TContext>[],
    context: TContext,
    params: AnyRecord,
    inherited?: PolicyInheritanceSet
  ): Promise<HsmPolicyDecision> {
    const set = inherited ?? this.inheritance.collect(activePath)[KIND_TO_PLURAL[kind]];
    const state = activePath[activePath.length - 1];
    if (!state) throw new Error("Policy evaluation requires an active state path.");
    const rule = this.ruleFor(kind, key);
    return this.evaluator.evaluate({
      key,
      kind,
      state,
      activePath,
      context,
      params,
      ...(rule !== undefined ? { rule } : {}),
      inheritedFrom: set.allowed.get(key) ?? Object.freeze([]),
      deniedBy: set.denied.get(key) ?? Object.freeze([])
    });
  }

  private ruleFor(kind: HsmPolicyKind, key: string): HsmPolicyDefinition<TContext> | undefined {
    if (kind === "permission") return this.definitions.permissions?.[key];
    if (kind === "capability") return this.definitions.capabilities?.[key];
    return this.definitions.features?.[key];
  }

  private allowedKeys(bucket: DecisionBucket): string[] {
    return Object.keys(bucket).filter((key) => bucket[key]?.allowed).sort();
  }

  private deniedKeys(bucket: DecisionBucket): string[] {
    return Object.keys(bucket).filter((key) => !bucket[key]?.allowed).sort();
  }

  private isSnapshot(value: HsmResolvedState<TContext> | HsmSnapshot<TContext>): value is HsmSnapshot<TContext> {
    return "machineId" in value;
  }
}
