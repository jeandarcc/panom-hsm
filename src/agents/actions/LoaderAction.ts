import type { HsmSchema, HsmSchemaStateNode } from "../../schema/HsmSchema.js";
import type { HsmAgentAction, HsmAgentActionResult, HsmAgentFinding } from "../types.js";
import type { HsmAgentContext } from "../HsmAgentContext.js";
import { createTraceEventId } from "./ActionUtils.js";

export class LoaderAction implements HsmAgentAction {
  public readonly name = "loader";
  public readonly category = "loaders";
  public readonly risk = "medium" as const;
  public readonly weight = 1;

  public canRun(context: HsmAgentContext): boolean {
    return Boolean(context.schema && findLoaderStates(context.schema).length > 0);
  }

  public async run(context: HsmAgentContext): Promise<HsmAgentActionResult> {
    const schema = context.schema as HsmSchema | undefined;
    if (!schema) return { ok: true, findings: [] };

    const loaderStates = findLoaderStates(schema);
    if (loaderStates.length === 0) return { ok: true, findings: [] };

    const target = context.random.pick(loaderStates);
    const eventId = createTraceEventId(context.agentId, context.stepIndex, this.name);
    const findings: HsmAgentFinding[] = [];

    try {
        const beforeState = context.snapshot?.stateId;
        const result = await context.adapter.transition(target.id, { context: context.profile.context });
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
          input: { target: target.id },
          hsmStateBefore: beforeState,
          hsmStateAfter: snapshot?.stateId
        }
      };
    } catch (error) {
      findings.push(context.toFinding({
        id: `loader:${target.id}`,
        title: "Loader transition failed",
        severity: "high",
        category: "runtime",
        message: "State loader threw during transition.",
        actual: error instanceof Error ? error.message : String(error),
        stateId: target.id
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
          input: { target: target.id },
          findings
        }
      };
    }
  }
}

function findLoaderStates(schema: HsmSchema): readonly HsmSchemaStateNode[] {
  const found: HsmSchemaStateNode[] = [];
  const walk = (node: HsmSchemaStateNode) => {
    if (node.loader) found.push(node);
    if (node.states) {
      for (const child of Object.values(node.states)) {
        walk(child);
      }
    }
  };
  for (const state of Object.values(schema.states)) {
    walk(state);
  }
  return found;
}

export function runLoaders(): LoaderAction {
  return new LoaderAction();
}
