import type { HsmSchema } from "../../schema/HsmSchema.js";
import type { HsmFinding, HsmProbeContext, HsmSecurityProbe } from "../types.js";
import { buildFinding, isDangerousPermission, severityForPermission } from "./ProbeUtils.js";

const DANGEROUS_PERMISSION_HINTS = [".delete", ".write", ".update", ".admin", "billing.", "media.delete", "user.ban"];

export class BackendPolicyMismatchProbe implements HsmSecurityProbe {
  public readonly name = "backend_policy_mismatch";
  public readonly description = "Detect missing backend enforcement for protected permissions.";
  public readonly defaultSeverity = "high" as const;

  public async run(context: HsmProbeContext): Promise<readonly HsmFinding[]> {
    const schema = context.schema as HsmSchema | undefined;
    if (!schema) {
      return [
        buildFinding({
          id: "backend_policy_mismatch:missing_schema",
          title: "Backend policy schema unavailable",
          severity: "low",
          category: "backend",
          message: "Backend policy mismatch probe requires schema metadata.",
          recommendation: "Provide schema when running audits.",
          probeName: this.name
        })
      ];
    }

    const findings: HsmFinding[] = [];
    const index = new Map(schema.index.states.map((state) => [state.id, state]));

    for (const state of schema.index.states) {
      const permissions = state.policies?.permissions ?? [];
      if (permissions.length === 0) continue;

      const hasBackendPolicy = Boolean(state.backend?.methods?.length || state.backend?.routes?.length || state.backend?.guards?.refs?.length);
      if (!hasBackendPolicy) {
        const dangerous = permissions.filter((perm) => isDangerousPermission(perm));
        if (dangerous.length > 0) {
          for (const perm of dangerous) {
            findings.push(buildFinding({
              id: `backend_policy_mismatch:${state.id}:${perm}`,
              title: "Dangerous permission lacks backend policy",
              severity: severityForPermission(perm),
              category: "backend",
              message: `State "${state.id}" exposes permission "${perm}" without backend enforcement metadata.`,
              recommendation: "Add backend policy methods or guards for destructive permissions.",
              probeName: this.name,
              stateId: state.id,
              expected: "backend policy",
              actual: "none"
            }));
          }
        } else {
          findings.push(buildFinding({
            id: `backend_policy_mismatch:${state.id}`,
            title: "State permissions missing backend policy",
            severity: "medium",
            category: "backend",
            message: `State "${state.id}" has permissions but no backend policy metadata.`,
            recommendation: "Ensure backend policies mirror permission boundaries.",
            probeName: this.name,
            stateId: state.id
          }));
        }
      }

      const policyTags = permissions.filter((perm) => DANGEROUS_PERMISSION_HINTS.some((hint) => perm.includes(hint)));
      if (policyTags.length > 0 && !hasBackendPolicy) {
        findings.push(buildFinding({
          id: `backend_policy_mismatch:danger:${state.id}`,
          title: "Potential backend policy drift",
          severity: "high",
          category: "backend",
          message: "Destructive permissions detected without backend enforcement metadata.",
          recommendation: "Confirm backend authorization matches frontend policy.",
          probeName: this.name,
          stateId: state.id,
          evidence: { permissions }
        }));
      }

      const backendMethods = state.backend?.methods;
      if (backendMethods && backendMethods.length > 0 && permissions.length === 0) {
        findings.push(buildFinding({
          id: `backend_policy_mismatch:methods:${state.id}`,
          title: "Backend methods without permissions",
          severity: "medium",
          category: "backend",
          message: "Backend methods are declared without explicit permissions.",
          recommendation: "Consider adding permissions to align frontend policy with backend endpoints.",
          probeName: this.name,
          stateId: state.id,
          evidence: { backendMethods }
        }));
      }

      const parentId = state.parentId;
      if (parentId && index.get(parentId)?.policies?.denyPermissions?.length) {
        const denied = index.get(parentId)?.policies?.denyPermissions ?? [];
        const overlap = permissions.filter((perm) => denied.includes(perm));
        if (overlap.length > 0) {
          findings.push(buildFinding({
            id: `backend_policy_mismatch:denied:${state.id}`,
            title: "Permission denied in ancestor but allowed in child",
            severity: "high",
            category: "policy",
            message: "Child state reintroduces permissions denied by ancestor; ensure backend enforcement remains consistent.",
            recommendation: "Verify policy inheritance aligns with backend expectations.",
            probeName: this.name,
            stateId: state.id,
            evidence: { overlap }
          }));
        }
      }
    }

    return findings;
  }
}

export function backendPolicyMismatch(): BackendPolicyMismatchProbe {
  return new BackendPolicyMismatchProbe();
}
