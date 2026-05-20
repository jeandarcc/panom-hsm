import type { HsmAgentInvariant, HsmAgentInvariantResult } from "../types.js";
import type { HsmAgentContext } from "../HsmAgentContext.js";

export class ViewerOwnerInvariant implements HsmAgentInvariant {
  public readonly name = "viewer_owner_permissions";
  public readonly description = "Viewer profiles must not gain owner/admin permissions.";
  public readonly severity = "high" as const;

  public async run(context: HsmAgentContext): Promise<HsmAgentInvariantResult> {
    const findings = [] as any[];
    if (!isViewerProfile(context.profile.name)) return { ok: true, findings };

    const permissions = context.snapshot?.policy?.permissions ?? [];
    const suspicious = permissions.filter((perm: string) => /(owner|admin)/i.test(perm));
    if (suspicious.length > 0) {
      findings.push(context.toFinding({
        id: "viewer_owner_permissions",
        title: "Viewer gained owner/admin permissions",
        severity: "high",
        category: "security",
        message: "Low privilege profile received owner/admin permissions.",
        recommendation: "Review permission guards for owner/admin states.",
        actual: suspicious
      }, { action: context.lastAction }));
    }

    return { ok: findings.length === 0, findings };
  }
}

function isViewerProfile(name: string): boolean {
  return name === "viewer" || name === "lowPrivilege" || name === "anonymous";
}

export function viewerCannotGetOwnerPermissions(): ViewerOwnerInvariant {
  return new ViewerOwnerInvariant();
}
