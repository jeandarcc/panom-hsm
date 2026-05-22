import type { AnyRecord } from "../../core/types.js";
import type { HsmAgentAction, HsmAgentActionResult, HsmAgentFinding } from "../types.js";
import type { HsmAgentContextRef } from "../types.js";
import { createTraceEventId, samplePath } from "./ActionUtils.js";

export class CanonicalAliasAction implements HsmAgentAction {
  public readonly name = "canonical_alias";
  public readonly category = "routing";
  public readonly risk = "medium" as const;
  public readonly weight = 1;

  public canRun(context: HsmAgentContextRef): boolean {
    return context.adapter.routes().some((route: AnyRecord) => route.isAlias);
  }

  public async run(context: HsmAgentContextRef): Promise<HsmAgentActionResult> {
    const routes = context.adapter.routes().filter((route: AnyRecord) => route.isAlias);
    if (routes.length === 0) return { ok: true, findings: [] };

    const route = context.random.pick(routes) as AnyRecord;
    const url = samplePath(route);
    const eventId = createTraceEventId(context.agentId, context.stepIndex, this.name);
    const findings: HsmAgentFinding[] = [];

    try {
      const beforeState = context.snapshot?.stateId;
      const snapshot = await context.adapter.resolveUrl(url, {
        context: context.profile.context,
        canonicalizeAliases: true,
        followRedirects: false
      });
      context.setSnapshot(snapshot);
      const redirect = snapshot.redirect;
      if (!redirect && route.redirectToCanonical) {
        findings.push(context.toFinding({
          id: `canonical_alias:${route.stateId}`,
          title: "Alias did not redirect to canonical route",
          severity: "medium",
          category: "routing",
          message: "Alias resolved without emitting canonical redirect.",
          recommendation: "Enable redirectAliases for alias routes or ensure canonicalization.",
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
          input: { alias: route.pattern, redirectToCanonical: route.redirectToCanonical }
        }
      };
    } catch (error) {
      findings.push(context.toFinding({
        id: `canonical_alias:error:${route.stateId}`,
        title: "Alias route resolution failed",
        severity: "high",
        category: "routing",
        message: "Alias route threw an error during resolution.",
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
          url
        }
      };
    }
  }
}

export function followCanonicalAliases(): CanonicalAliasAction {
  return new CanonicalAliasAction();
}
