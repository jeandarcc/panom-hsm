import type { AnyRecord } from "../../core/types.js";
import type { HsmAgentAction, HsmAgentActionResult, HsmAgentFinding } from "../types.js";
import type { HsmAgentContext } from "../HsmAgentContext.js";
import { createTraceEventId, samplePath } from "./ActionUtils.js";

export class VisitRoutesAction implements HsmAgentAction {
  public readonly name = "visit_routes";
  public readonly category = "routing";
  public readonly risk = "low" as const;
  public readonly weight = 3;

  public canRun(context: HsmAgentContext): boolean {
    return context.adapter.routes().length > 0;
  }

  public async run(context: HsmAgentContext): Promise<HsmAgentActionResult> {
    const routes = context.adapter.routes() as readonly AnyRecord[];
    const route = context.random.pick(routes);
    const url = samplePath(route);
    const eventId = createTraceEventId(context.agentId, context.stepIndex, this.name);
    const findings: HsmAgentFinding[] = [];

    try {
      const beforeState = context.snapshot?.stateId;
      const beforePermissions = context.snapshot?.policy?.permissions ?? [];
      const snapshot = await context.adapter.resolveUrl(url, { context: context.profile.context });
      context.setSnapshot(snapshot);

      if (!snapshot.stateId) {
        findings.push(context.toFinding({
          id: `visit_routes:${route.stateId ?? "unknown"}`,
          title: "Route resolution missing state",
          severity: "medium",
          category: "routing",
          message: "Route resolved without a state id.",
          expected: "stateId",
          actual: snapshot.stateId,
          url
        }, { action: this.name }));
      }

      return {
        ok: findings.length === 0,
        findings,
        snapshot,
        trace: {
          id: eventId,
          agentId: context.agentId,
          sequence: context.stepIndex,
          timestamp: new Date().toISOString(),
          actionName: this.name,
          actionType: this.category,
          url,
          hsmStateBefore: beforeState,
          hsmStateAfter: snapshot.stateId,
          permissionsBefore: beforePermissions,
          permissionsAfter: snapshot.policy?.permissions ?? [],
          input: { route: route.pattern, canonical: route.canonicalPattern }
        }
      };
    } catch (error) {
      findings.push(context.toFinding({
        id: `visit_routes:error:${route.stateId ?? "unknown"}`,
        title: "Route visit failed",
        severity: "high",
        category: "runtime",
        message: "Route visit threw an error during resolution.",
        expected: "route resolves",
        actual: error instanceof Error ? error.message : String(error),
        url
      }, { action: this.name }));

      return {
        ok: false,
        findings,
        trace: {
          id: eventId,
          agentId: context.agentId,
          sequence: context.stepIndex,
          timestamp: new Date().toISOString(),
          actionName: this.name,
          actionType: this.category,
          url,
          input: { route: route.pattern, canonical: route.canonicalPattern }
        }
      };
    }
  }
}

export function visitRoutes(): VisitRoutesAction {
  return new VisitRoutesAction();
}
