import type { HsmAgentFinding, HsmAgentInvariant, HsmAgentInvariantResult } from "../types.js";
import type { HsmAgentContextRef } from "../types.js";

export class QueryCannotGrantInvariant implements HsmAgentInvariant {
  public readonly name = "query_cannot_grant";
  public readonly description = "Query tampering must not grant permissions or roles.";
  public readonly severity = "high" as const;

  public constructor(private readonly keys: readonly string[]) {}

  public async run(context: HsmAgentContextRef): Promise<HsmAgentInvariantResult> {
    const findings: HsmAgentFinding[] = [];
    const decoded = context.snapshot?.urlState?.decoded ?? {};
    const touched = this.keys.some((key) => key in decoded);
    if (!touched) return { ok: true, findings };

    const permissions = context.snapshot?.policy?.permissions ?? [];
    const features = context.snapshot?.policy?.features ?? [];
    const capabilities = context.snapshot?.policy?.capabilities ?? [];

    const gainedPermissions = permissions.filter((perm: string) => !context.baselinePermissions.includes(perm));
    const gainedFeatures = features.filter((feature: string) => !context.baselineFeatures.includes(feature));
    const gainedCapabilities = capabilities.filter((cap: string) => !context.baselineCapabilities.includes(cap));

    if (gainedPermissions.length > 0 || gainedFeatures.length > 0 || gainedCapabilities.length > 0) {
      findings.push(context.toFinding({
        id: "query_grant",
        title: "Query tampering granted policy",
        severity: "high",
        category: "security",
        message: "Query parameters appear to grant permissions or features.",
        recommendation: "Avoid binding sensitive fields from public query state.",
        expected: "no policy gain",
        actual: { permissions: gainedPermissions, features: gainedFeatures, capabilities: gainedCapabilities }
      }, { action: context.lastAction }));
    }

    return { ok: findings.length === 0, findings };
  }
}

export function queryCannotGrant(keys: readonly string[]): QueryCannotGrantInvariant {
  return new QueryCannotGrantInvariant(keys);
}
