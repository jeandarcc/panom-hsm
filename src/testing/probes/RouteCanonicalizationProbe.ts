import type { AnyRecord } from "../../core/types.js";
import type { HsmFinding, HsmProbeContext, HsmSecurityProbe } from "../types.js";
import { buildFinding, buildSamplePath } from "./ProbeUtils.js";

export class RouteCanonicalizationProbe implements HsmSecurityProbe {
  public readonly name = "route_canonicalization";
  public readonly description = "Verify aliases and canonical routes resolve consistently.";
  public readonly defaultSeverity = "medium" as const;

  public async run(context: HsmProbeContext): Promise<readonly HsmFinding[]> {
    const findings: HsmFinding[] = [];
    const routes = context.adapter.routes() as readonly AnyRecord[];

    for (const route of routes) {
      if (!route.isAlias) continue;
      const aliasPath = buildSamplePath(route.pattern ?? "/");
      try {
        const snapshot = await context.adapter.resolveUrl(aliasPath, {
          context: context.contextProfiles.anonymous,
          canonicalizeAliases: true,
          followRedirects: false
        });
        const redirect = snapshot.redirect;
        if (!redirect) {
          findings.push(buildFinding({
            id: `route_canonicalization:${route.stateId}`,
            title: "Alias did not redirect to canonical route",
            severity: route.redirectToCanonical ? "high" : "medium",
            category: "routing",
            message: "Alias route resolved without emitting canonical redirect.",
            recommendation: "Enable redirectAliases or canonicalize alias routes.",
            probeName: this.name,
            stateId: route.stateId,
            route: aliasPath,
            url: aliasPath
          }));
        }
      } catch {
        // Ignore matching failures; alias is not reachable.
      }
    }

    return findings;
  }
}

export function routeCanonicalization(): RouteCanonicalizationProbe {
  return new RouteCanonicalizationProbe();
}
