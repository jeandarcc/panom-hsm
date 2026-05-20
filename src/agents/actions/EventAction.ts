import type { AnyRecord } from "../../core/types.js";
import type { HsmAgentAction, HsmAgentActionResult } from "../types.js";
import type { HsmAgentContext } from "../HsmAgentContext.js";
import { createTraceEventId } from "./ActionUtils.js";

export class EventAction implements HsmAgentAction {
  public readonly name = "event";
  public readonly category = "events";
  public readonly risk = "medium" as const;
  public readonly weight = 1;

  public canRun(context: HsmAgentContext): boolean {
    const hsm = context.adapter.hsm as AnyRecord | undefined;
    return Boolean(hsm?.tree?.all?.some((node: AnyRecord) => node.config?.on));
  }

  public async run(context: HsmAgentContext): Promise<HsmAgentActionResult> {
    const hsm = context.adapter.hsm as AnyRecord | undefined;
    const eventNames = new Set<string>();
    for (const node of hsm?.tree?.all ?? []) {
      const events = node.config?.on ? Object.keys(node.config.on) : [];
      for (const event of events) eventNames.add(event);
    }
    const options = Array.from(eventNames);
    if (options.length === 0) return { ok: true, findings: [] };

    const event = context.random.pick(options);
    const eventId = createTraceEventId(context.agentId, context.stepIndex, this.name);

    const beforeState = context.snapshot?.stateId;
    const result = await context.adapter.send(event, {}, { context: context.profile.context });
    const snapshot = (result as any).snapshot ?? null;
    context.setSnapshot(snapshot);

    return {
      ok: true,
      findings: [],
      transition: result,
      snapshot,
      trace: {
        id: eventId,
        agentId: context.agentId,
        sequence: context.stepIndex,
        timestamp: new Date().toISOString(),
        actionName: this.name,
        actionType: this.category,
        input: { event },
        hsmStateBefore: beforeState,
          hsmStateAfter: snapshot?.stateId
      }
    };
  }
}

export function sendRandomEvent(): EventAction {
  return new EventAction();
}
