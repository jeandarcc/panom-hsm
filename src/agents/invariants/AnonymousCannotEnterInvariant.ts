import { wildcardMatch } from "../../testing/probes/ProbeUtils.js";
import type { HsmAgentFinding, HsmAgentInvariant, HsmAgentInvariantResult } from "../types.js";
import type { HsmAgentContextRef } from "../types.js";

export class AnonymousCannotEnterInvariant implements HsmAgentInvariant {
  public readonly name = "anonymous_cannot_enter";
  public readonly description = "Anonymous agents must not enter protected states.";
  public readonly severity = "critical" as const;

  public constructor(private readonly patterns: readonly string[]) {}

  public async run(context: HsmAgentContextRef): Promise<HsmAgentInvariantResult> {
    const findings: HsmAgentFinding[] = [];
    const isAnonymous = context.profile.name === "anonymous" || context.profile.context?.user == null;
    const stateId = context.snapshot?.stateId;
    if (isAnonymous && stateId && this.patterns.some((pattern) => wildcardMatch(stateId, pattern))) {
      findings.push(context.toFinding({
        id: `anonymous:${stateId}`,
        title: "Anonymous agent entered protected state",
        severity: "critical",
        category: "security",
        message: "Anonymous profile entered a protected state.",
        recommendation: "Add auth guard or state boundary checks.",
        stateId
      }, { action: context.lastAction }));
    }
    return { ok: findings.length === 0, findings };
  }
}

export function anonymousCannotEnter(patterns: readonly string[]): AnonymousCannotEnterInvariant {
  return new AnonymousCannotEnterInvariant(patterns);
}
