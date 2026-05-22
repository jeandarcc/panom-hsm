import type { HsmAgentAction, HsmAgentActionResult, HsmAgentFinding } from "../types.js";
import type { HsmAgentContextRef } from "../types.js";
import { createTraceEventId } from "./ActionUtils.js";
import { probes } from "../../testing/probes/index.js";

export class QueryTamperingAction implements HsmAgentAction {
  public readonly name = "query_tampering";
  public readonly category = "query";
  public readonly risk = "medium" as const;
  public readonly weight = 1;

  public canRun(context: HsmAgentContextRef): boolean {
    return Boolean(context.schema?.query);
  }

  public async run(context: HsmAgentContextRef): Promise<HsmAgentActionResult> {
    if (context.flags.get(this.name)) {
      return { ok: true, findings: [] };
    }
    context.flags.set(this.name, true);

    const eventId = createTraceEventId(context.agentId, context.stepIndex, this.name);
    const findings: HsmAgentFinding[] = [];

    const probeContext = context.toProbeContext();
    const probeFindings = await probes.queryTampering().run(probeContext);
    const escalationFindings = await probes.permissionEscalation().run(probeContext);

    for (const finding of [...probeFindings, ...escalationFindings]) {
      findings.push(context.toFinding(finding, { action: this.name }));
    }

    return {
      ok: findings.length === 0,
      findings,
      trace: {
        id: eventId,
        agentId: context.agentId,
        sequence: context.stepIndex,
        timestamp: new Date().toISOString(),
        actionName: this.name,
        actionType: this.category,
        input: { probe: "query" },
        findings
      }
    };
  }
}

export function tamperQuery(): QueryTamperingAction {
  return new QueryTamperingAction();
}
