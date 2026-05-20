import type { AnyRecord } from "../../core/types.js";
import type { HsmFinding, HsmProbeContext, HsmSecurityProbe } from "../types.js";
import { buildFinding, isDangerousPermission } from "./ProbeUtils.js";

const SUSPICIOUS_QUERIES: ReadonlyArray<[string, string]> = [
  ["role", "admin"],
  ["admin", "true"],
  ["isAdmin", "true"],
  ["permissions", "*"],
  ["permission", "media.delete"],
  ["plan", "pro"],
  ["user.role", "admin"]
];

export class PermissionEscalationProbe implements HsmSecurityProbe {
  public readonly name = "permission_escalation";
  public readonly description = "Detect permission/capability changes caused by query tampering.";
  public readonly defaultSeverity = "high" as const;

  public async run(context: HsmProbeContext): Promise<readonly HsmFinding[]> {
    const findings: HsmFinding[] = [];
    const baseContext = context.contextProfiles.anonymous ?? ({} as AnyRecord);
    const route = context.adapter.routes()[0] as AnyRecord | undefined;
    const basePath = route?.canonicalPattern ?? route?.pattern ?? "/";

    let baselinePermissions: readonly string[] = [];
    let baselineFeatures: readonly string[] = [];
    let baselineCapabilities: readonly string[] = [];

    try {
      const snapshot = await context.adapter.resolveUrl(basePath, { context: baseContext });
      baselinePermissions = snapshot.policy?.permissions ?? [];
      baselineFeatures = snapshot.policy?.features ?? [];
      baselineCapabilities = snapshot.policy?.capabilities ?? [];
    } catch {
      // If we cannot resolve baseline, skip deep checks.
    }

    for (const [key, value] of SUSPICIOUS_QUERIES) {
      const url = `${basePath}?${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      try {
        const snapshot = await context.adapter.resolveUrl(url, { context: baseContext });
        const permissions = snapshot.policy?.permissions ?? [];
        const features = snapshot.policy?.features ?? [];
        const capabilities = snapshot.policy?.capabilities ?? [];

        const gainedPermissions = permissions.filter((perm) => !baselinePermissions.includes(perm));
        const gainedFeatures = features.filter((feature) => !baselineFeatures.includes(feature));
        const gainedCapabilities = capabilities.filter((cap) => !baselineCapabilities.includes(cap));

        for (const perm of gainedPermissions) {
          findings.push(buildFinding({
            id: `permission_escalation:${key}:${perm}`,
            title: "Permission escalated via query",
            severity: isDangerousPermission(perm) ? "critical" : "high",
            category: "security",
            message: `Query parameter "${key}" introduced permission "${perm}".`,
            recommendation: "Ensure query-bound state cannot directly grant permissions.",
            probeName: this.name,
            url,
            evidence: { key, value, permission: perm }
          }));
        }

        if (gainedFeatures.length > 0) {
          findings.push(buildFinding({
            id: `permission_escalation:${key}:features`,
            title: "Feature escalated via query",
            severity: "high",
            category: "security",
            message: `Query parameter "${key}" toggled feature flags.`,
            recommendation: "Bind features to trusted context or server-side policy.",
            probeName: this.name,
            url,
            evidence: { key, value, features: gainedFeatures }
          }));
        }

        if (gainedCapabilities.length > 0) {
          findings.push(buildFinding({
            id: `permission_escalation:${key}:capabilities`,
            title: "Capability escalated via query",
            severity: "medium",
            category: "security",
            message: `Query parameter "${key}" changed capabilities.`,
            recommendation: "Ensure capability checks rely on trusted context.",
            probeName: this.name,
            url,
            evidence: { key, value, capabilities: gainedCapabilities }
          }));
        }
      } catch {
        // ignore routing failures
      }
    }

    return findings;
  }
}

export function permissionEscalation(): PermissionEscalationProbe {
  return new PermissionEscalationProbe();
}
