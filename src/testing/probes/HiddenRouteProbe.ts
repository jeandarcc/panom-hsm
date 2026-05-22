import type { AnyRecord } from "../../core/types.js";
import { RouteProjection } from "../../routing/RouteProjection.js";
import type { HsmFinding, HsmProbeContextRef, HsmSecurityProbe } from "../types.js";
import { buildFinding } from "./ProbeUtils.js";

export class HiddenRouteProbe implements HsmSecurityProbe {
  public readonly name = "hidden_route";
  public readonly description = "Ensure hidden/virtual routes are not directly routable.";
  public readonly defaultSeverity = "medium" as const;

  public async run(context: HsmProbeContextRef): Promise<readonly HsmFinding[]> {
    const findings: HsmFinding[] = [];
    const hsm = context.adapter.hsm as AnyRecord | undefined;
    if (!hsm?.tree) return findings;

    for (const node of hsm.tree.all) {
      const url = node.config.url;
      if (!url) continue;
      const isHidden = url.mode === "hidden" || url.hide === true;
      const isVirtual = url.mode === "virtual";
      const selfRoutable = RouteProjection.isSelfRoutable(node);

      if ((isHidden || isVirtual) && selfRoutable) {
        findings.push(buildFinding({
          id: `hidden_route:${node.id}`,
          title: "Hidden/virtual state is directly routable",
          severity: isVirtual ? "high" : "medium",
          category: "routing",
          message: "State configured as hidden/virtual is still routable.",
          recommendation: "Disable routing for hidden/virtual states or adjust url.mode.",
          probeName: this.name,
          stateId: node.id
        }));
      }
    }

    return findings;
  }
}

export function hiddenRoute(): HiddenRouteProbe {
  return new HiddenRouteProbe();
}
