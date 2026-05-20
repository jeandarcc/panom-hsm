import type { AnyRecord } from "../../core/types.js";
import { createHsmBackend } from "../../backend/HsmBackendRuntime.js";
import type { HsmSchema } from "../../schema/HsmSchema.js";
import type { HsmAgentAction, HsmAgentActionResult, HsmAgentFinding } from "../types.js";
import type { HsmAgentContext } from "../HsmAgentContext.js";
import { createTraceEventId } from "./ActionUtils.js";
import { buildSamplePath } from "../../testing/probes/ProbeUtils.js";

export class BackendRouteAction implements HsmAgentAction {
  public readonly name = "backend_routes";
  public readonly category = "backend";
  public readonly risk = "high" as const;
  public readonly weight = 1;

  public canRun(context: HsmAgentContext): boolean {
    return Boolean(context.schema?.index?.states?.some((state: AnyRecord) => state.backend?.methods?.length));
  }

  public async run(context: HsmAgentContext): Promise<HsmAgentActionResult> {
    const schema = context.schema as HsmSchema | undefined;
    if (!schema) return { ok: true, findings: [] };

    const states = schema.index.states.filter((state) => state.backend?.methods?.length || state.backend?.routes?.length);
    if (states.length === 0) return { ok: true, findings: [] };

    const state = context.random.pick(states);
    const route = schema.index.routes.find((entry) => entry.stateId === state.id);
    const url = route ? buildSamplePath(route.canonicalPattern) : "/";
    const methods = state.backend?.methods ?? ["GET"];
    const method = context.random.pick(methods);
    const eventId = createTraceEventId(context.agentId, context.stepIndex, this.name);
    const findings: HsmAgentFinding[] = [];

    if (context.safety.isDestructiveMethod(method) && !context.safety.isDestructiveAllowed()) {
      return {
        ok: true,
        findings: [],
        trace: {
          id: eventId,
          agentId: context.agentId,
          sequence: context.stepIndex,
          timestamp: new Date().toISOString(),
          actionName: this.name,
          actionType: this.category,
          url,
          method,
          input: { stateId: state.id, skipped: "destructive_blocked" }
        }
      };
    }

    let ok = true;
    let responseStatus: number | undefined;

    if (context.mode === "http") {
      const target = context.suite.target.origin;
      const requestUrl = new URL(url, target).toString();
      if (context.safety.shouldBlockUrl(url)) {
        ok = false;
      } else {
        const rawHeaders = context.account?.auth?.headers ? { ...context.account.auth.headers } : undefined;
        const res = await fetch(requestUrl, { method, headers: rawHeaders });
        responseStatus = res.status;
        ok = res.status < 400;
      }
    } else {
      const backend = createHsmBackend({
        schema,
        context: () => context.profile.context as AnyRecord
      });
      const result = await backend.resolveRequest({ method, url });
      ok = result.ok;
      responseStatus = result.ok ? 200 : (result as any).status;
    }

    context.lastBackendResult = {
      ok,
      stateId: state.id,
      method,
      url,
      permissions: state.policies?.permissions ?? []
    };

    if (ok && (state.policies?.permissions?.length ?? 0) > 0) {
      findings.push(context.toFinding({
        id: `backend_routes:${state.id}:${method}`,
        title: "Backend route allowed with protected permissions",
        severity: "high",
        category: "backend",
        message: "Backend route resolved successfully with permissions present.",
        recommendation: "Ensure backend policy enforces permissions for protected routes.",
        stateId: state.id,
        url,
        actual: { status: responseStatus }
      }, { action: this.name, method }));
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
        url,
        method,
        request: {
          method,
          url,
          headers: context.safety.redactHeaders(context.account?.auth?.headers ? { ...context.account.auth.headers } : undefined)
        },
        response: { status: responseStatus },
        hsmStateBefore: context.snapshot?.stateId,
        hsmStateAfter: context.snapshot?.stateId,
        findings
      }
    };
  }
}

export function callBackendRoutes(): BackendRouteAction {
  return new BackendRouteAction();
}
