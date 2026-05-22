import type { HsmAgentAction, HsmAgentActionResult, HsmAgentFinding } from "../types.js";
import type { HsmAgentContextRef } from "../types.js";
import { createTraceEventId } from "./ActionUtils.js";
import { probes } from "../../testing/probes/index.js";

export class RedirectPayloadAction implements HsmAgentAction {
  public readonly name = "redirect_payloads";
  public readonly category = "security";
  public readonly risk = "high" as const;
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
    const probeFindings = await probes.openRedirect().run(context.toProbeContext());

    for (const finding of probeFindings) {
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
        input: { probe: "open_redirect" },
        findings
      }
    };
  }
}

export function tryRedirectPayloads(): RedirectPayloadAction {
  return new RedirectPayloadAction();
}
