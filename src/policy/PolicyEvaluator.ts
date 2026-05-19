import type {
  AnyRecord,
  HsmGuardInput,
  HsmGuardRef,
  HsmPolicyDecision,
  HsmPolicyDefinition,
  HsmPolicyKind,
  HsmPolicyRule
} from "../core/types.js";
import type { StateNode } from "../core/StateNode.js";
import { GuardRegistry } from "../guards/GuardRegistry.js";
import { HsmGuardRejectedError, HsmMissingGuardError } from "../errors/HsmErrors.js";

export interface PolicyEvaluationInput<TContext extends AnyRecord = AnyRecord> {
  readonly key: string;
  readonly kind: HsmPolicyKind;
  readonly state: StateNode<TContext>;
  readonly activePath: readonly StateNode<TContext>[];
  readonly context: TContext;
  readonly params: AnyRecord;
  readonly rule?: HsmPolicyDefinition<TContext>;
  readonly inheritedFrom: readonly string[];
  readonly deniedBy: readonly string[];
}

export class PolicyEvaluator<TContext extends AnyRecord = AnyRecord> {
  public constructor(private readonly guards: GuardRegistry<TContext>) {}

  public async evaluate(input: PolicyEvaluationInput<TContext>): Promise<HsmPolicyDecision> {
    if (input.deniedBy.length > 0) {
      return this.decision(input, false, "state_denied");
    }

    if (input.inheritedFrom.length === 0) {
      return this.decision(input, false, "not_declared");
    }

    const rule = this.normalizeRule(input.rule);
    if (rule === false) return this.decision(input, false, "rule_denied");
    if (rule === true || !rule?.guard) return this.decision(input, true, "allowed");

    try {
      await this.guards.assertAll(this.guardInput(input), rule.guard);
      return this.decision(input, true, "allowed", this.firstGuardName(rule.guard));
    } catch (error) {
      if (error instanceof HsmMissingGuardError) {
        return this.decision(input, false, "guard_missing", this.firstGuardName(rule.guard), error);
      }
      if (error instanceof HsmGuardRejectedError) {
        return this.decision(input, false, "guard_failed", error.guardName, error);
      }
      return this.decision(input, false, "error", this.firstGuardName(rule.guard), error);
    }
  }

  private guardInput(input: PolicyEvaluationInput<TContext>): HsmGuardInput<TContext> {
    return {
      context: input.context,
      state: input.state,
      stateId: input.state.id,
      params: input.params,
      meta: input.state.meta,
      toStateId: input.state.id,
      event: { type: `policy.${input.kind}.${input.key}` }
    };
  }

  private normalizeRule(rule: HsmPolicyDefinition<TContext> | undefined): boolean | HsmPolicyRule<TContext> | undefined {
    if (rule === undefined) return undefined;
    if (typeof rule === "boolean") return rule;
    if (typeof rule === "string" || typeof rule === "function" || Array.isArray(rule)) {
      return { guard: rule as HsmGuardRef<TContext> };
    }
    return rule as HsmPolicyRule<TContext>;
  }

  private firstGuardName(ref: HsmGuardRef<TContext> | undefined): string | undefined {
    if (!ref) return undefined;
    const first = Array.isArray(ref) ? ref[0] : ref;
    return typeof first === "string" ? first : "inline:0";
  }

  private decision(
    input: PolicyEvaluationInput<TContext>,
    allowed: boolean,
    reason: HsmPolicyDecision["reason"],
    guard?: string,
    error?: unknown
  ): HsmPolicyDecision {
    return Object.freeze({
      key: input.key,
      kind: input.kind,
      allowed,
      reason,
      inheritedFrom: Object.freeze([...input.inheritedFrom]),
      deniedBy: Object.freeze([...input.deniedBy]),
      stateId: input.state.id,
      ...(guard ? { guard } : {}),
      ...(error ? { error } : {})
    });
  }
}
