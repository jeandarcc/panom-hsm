import type { AnyRecord } from "../../core/types.js";
import type { HsmSchema } from "../../schema/HsmSchema.js";
import type { HsmFinding, HsmProbeContext, HsmSecurityProbe } from "../types.js";
import { buildFinding, buildSamplePath, wildcardMatch } from "./ProbeUtils.js";

export interface UnauthenticatedAccessProbeOptions<TContext extends AnyRecord = AnyRecord> {
  readonly protectedStates: readonly string[];
  readonly publicStates?: readonly string[];
  readonly unauthContext?: TContext;
}

export class UnauthenticatedAccessProbe implements HsmSecurityProbe {
  public readonly name = "unauthenticated_access";
  public readonly description = "Detect protected states reachable without authentication context.";
  public readonly defaultSeverity = "high" as const;

  public constructor(private readonly options: UnauthenticatedAccessProbeOptions) {}

  public async run(context: HsmProbeContext): Promise<readonly HsmFinding[]> {
    const findings: HsmFinding[] = [];
    const schema = context.schema as HsmSchema | undefined;
    const protectedStates = this.options.protectedStates;
    const publicStates = this.options.publicStates ?? [];
    const unauthContext = this.options.unauthContext ?? context.contextProfiles.anonymous;

    const routeEntries = context.adapter.routes() as readonly AnyRecord[];
    const routeByState = new Map(routeEntries.map((entry) => [entry.stateId, entry]));

    for (const stateId of context.adapter.states()) {
      if (!protectedStates.some((pattern) => wildcardMatch(stateId, pattern))) continue;
      if (publicStates.some((pattern) => wildcardMatch(stateId, pattern))) continue;

      const route = routeByState.get(stateId);
      if (!route) {
        findings.push(buildFinding({
          id: `unauthenticated_access:unroutable:${stateId}`,
          title: "Protected state has no public route",
          severity: "medium",
          category: "security",
          message: "Protected state is not routable but may still be reachable via direct transitions.",
          recommendation: "Ensure guards prevent direct transitions or mark state as virtual.",
          probeName: this.name,
          stateId
        }));
        continue;
      }

      const url = buildSamplePath(route.canonicalPattern ?? route.pattern ?? "/");

      try {
        const snapshot = await context.adapter.resolveUrl(url, {
          context: unauthContext,
          canonicalizeAliases: true
        });
        if (snapshot.stateId === stateId || snapshot.activePath.includes(stateId)) {
          const severity = stateId.startsWith("admin") || stateId.startsWith("cloud") ? "critical" : "high";
          findings.push(buildFinding({
            id: `unauthenticated_access:${stateId}`,
            title: "Protected state reachable anonymously",
            severity,
            category: "security",
            message: "Anonymous context resolved a protected state without denial.",
            recommendation: "Add auth-required guards or backend policy enforcement.",
            probeName: this.name,
            stateId,
            route: url,
            url
          }));
        }
      } catch {
        // Guard or route failure indicates access is blocked.
      }
    }

    if (schema && protectedStates.length === 0) {
      findings.push(buildFinding({
        id: "unauthenticated_access:missing_protected",
        title: "Protected states not configured",
        severity: "low",
        category: "configuration",
        message: "Unauthenticated access probe ran without protected state configuration.",
        recommendation: "Provide protectedStates to ensure coverage.",
        probeName: this.name
      }));
    }

    return findings;
  }
}

export function unauthenticatedAccess<TContext extends AnyRecord = AnyRecord>(
  options: UnauthenticatedAccessProbeOptions<TContext>
): UnauthenticatedAccessProbe {
  return new UnauthenticatedAccessProbe(options);
}
