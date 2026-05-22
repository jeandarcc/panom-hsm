import type { HsmSchema } from "../../schema/HsmSchema.js";
import type { HsmAgentAction, HsmAgentActionResult, HsmAgentFinding } from "../types.js";
import type { HsmAgentContextRef } from "../types.js";
import { createTraceEventId } from "./ActionUtils.js";
import { isDangerousPermission } from "../../testing/probes/ProbeUtils.js";

export class PermissionAction implements HsmAgentAction {
  public readonly name = "permission_bound_action";
  public readonly category = "policy";
  public readonly risk = "high" as const;
  public readonly weight = 1;

  public canRun(context: HsmAgentContextRef): boolean {
    return Boolean(context.schema?.index?.states?.some((state: any) => (state.policies?.permissions ?? []).length > 0));
  }

  public async run(context: HsmAgentContextRef): Promise<HsmAgentActionResult> {
    const schema = context.schema as HsmSchema | undefined;
    if (!schema) return { ok: true, findings: [] };

    const candidates = schema.index.states.filter((state) => (state.policies?.permissions ?? []).length > 0);
    if (candidates.length === 0) return { ok: true, findings: [] };

    const target = context.random.pick(candidates);
    const eventId = createTraceEventId(context.agentId, context.stepIndex, this.name);
    const findings: HsmAgentFinding[] = [];

    try {
      const beforeState = context.snapshot?.stateId;
      const result = await context.adapter.transition(target.id, { context: context.profile.context });
      const snapshot = (result as any).snapshot ?? null;
      context.setSnapshot(snapshot);

      const permissions = snapshot?.policy?.permissions ?? [];
      if (context.profile.name === "lowPrivilege" || context.profile.name === "anonymous") {
        const dangerous = permissions.filter((perm: string) => isDangerousPermission(perm));
        if (dangerous.length > 0) {
          findings.push(context.toFinding({
            id: `permission_action:${target.id}`,
            title: "Low privilege agent gained dangerous permission",
            severity: "critical",
            category: "policy",
            message: "Low privilege profile gained dangerous permissions after transition.",
            recommendation: "Review guard and permission policy for this state.",
            stateId: target.id,
            expected: "no dangerous permissions",
            actual: dangerous
          }, { action: this.name }));
        }
      }

      return {
        ok: findings.length === 0,
        findings,
        snapshot,
        transition: result,
        trace: {
          id: eventId,
          agentId: context.agentId,
          sequence: context.stepIndex,
          timestamp: new Date().toISOString(),
          actionName: this.name,
          actionType: this.category,
          input: { target: target.id },
          hsmStateBefore: beforeState,
          hsmStateAfter: snapshot?.stateId,
          permissionsAfter: permissions
        }
      };
    } catch (error) {
      findings.push(context.toFinding({
        id: `permission_action:error:${target.id}`,
        title: "Permission-bound transition failed",
        severity: "medium",
        category: "runtime",
        message: "Transition to permission-bound state failed.",
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
          input: { target: target.id }
        }
      };
    }
  }
}

export function tryPermissionBoundActions(): PermissionAction {
  return new PermissionAction();
}
