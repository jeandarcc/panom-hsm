import type { HsmAgentFinding, HsmAgentInvariant, HsmAgentInvariantResult } from "../types.js";
import type { HsmAgentContext } from "../HsmAgentContext.js";

export class FrontendBackendPolicyInvariant implements HsmAgentInvariant {
  public readonly name = "frontend_backend_policy";
  public readonly description = "Frontend policy should align with backend enforcement.";
  public readonly severity = "high" as const;

  public async run(context: HsmAgentContext): Promise<HsmAgentInvariantResult> {
    const findings: HsmAgentFinding[] = [];
    const backend = context.lastBackendResult as {
      ok?: boolean;
      stateId?: string;
      method?: string;
      url?: string;
      permissions?: readonly string[];
    } | undefined;

    if (backend?.ok && backend.permissions && backend.permissions.length > 0) {
      findings.push(context.toFinding({
        id: `frontend_backend_policy:${backend.stateId ?? "unknown"}`,
        title: "Backend allowed request with protected permissions",
        severity: "high",
        category: "backend",
        message: "Backend resolved a request even though frontend policy declares permissions.",
        recommendation: "Ensure backend guards and permissions enforce the same boundary.",
        stateId: backend.stateId,
        url: backend.url,
        actual: { method: backend.method, permissions: backend.permissions }
      }, { action: context.lastAction, method: backend.method }));
    }

    return { ok: findings.length === 0, findings };
  }
}

export function frontendBackendPolicyMustMatch(): FrontendBackendPolicyInvariant {
  return new FrontendBackendPolicyInvariant();
}
