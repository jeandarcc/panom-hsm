import type { HsmAgentFinding, HsmAgentInvariant, HsmAgentInvariantResult } from "../types.js";
import type { HsmAgentContextRef } from "../types.js";

export class NoUnexpectedPermissionGainInvariant implements HsmAgentInvariant {
  public readonly name = "no_unexpected_permission_gain";
  public readonly description = "Permissions should not appear unexpectedly during an agent run.";
  public readonly severity = "medium" as const;

  public async run(context: HsmAgentContextRef): Promise<HsmAgentInvariantResult> {
    const findings: HsmAgentFinding[] = [];
    const permissions = context.snapshot?.policy?.permissions ?? [];
    const gained = permissions.filter((perm: string) => !context.baselinePermissions.includes(perm));
    if (gained.length === 0) return { ok: true, findings };

    const expected = context.profile.expectedPermissions ?? [];
    const unexpected = gained.filter((perm: string) => !expected.includes(perm));
    if (unexpected.length > 0) {
      findings.push(context.toFinding({
        id: "permission_gain",
        title: "Unexpected permission gain",
        severity: "medium",
        category: "policy",
        message: "Agent gained permissions outside the expected baseline.",
        recommendation: "Review guard and policy rules for this state.",
        actual: unexpected
      }, { action: context.lastAction }));
    }

    return { ok: findings.length === 0, findings };
  }
}

export function noUnexpectedPermissionGain(): NoUnexpectedPermissionGainInvariant {
  return new NoUnexpectedPermissionGainInvariant();
}
