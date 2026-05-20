import type { AnyRecord } from "../../core/types.js";
import type { HsmSchema } from "../../schema/HsmSchema.js";
import { createHsmBackend } from "../../backend/HsmBackendRuntime.js";
import type { HsmFinding, HsmProbeContext, HsmSecurityProbe } from "../types.js";
import { buildFinding, buildSamplePath } from "./ProbeUtils.js";

const COMMON_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export class BackendMethodPolicyProbe implements HsmSecurityProbe {
  public readonly name = "backend_method_policy";
  public readonly description = "Validate backend method restrictions against the schema.";
  public readonly defaultSeverity = "high" as const;

  public async run(context: HsmProbeContext): Promise<readonly HsmFinding[]> {
    const schema = context.schema as HsmSchema | undefined;
    if (!schema) {
      return [
        buildFinding({
          id: "backend_method_policy:missing_schema",
          title: "Backend schema unavailable",
          severity: "low",
          category: "backend",
          message: "Backend method probe requires schema metadata.",
          recommendation: "Provide schema when running audits.",
          probeName: this.name
        })
      ];
    }

    const backend = createHsmBackend({
      schema,
      context: () => context.contextProfiles.anonymous as AnyRecord
    });

    const findings: HsmFinding[] = [];
    const routeIndex = new Map(schema.index.routes.map((route) => [route.stateId, route]));

    for (const state of schema.index.states) {
      const methods = state.backend?.methods;
      if (!methods || methods.length === 0) continue;

      const route = routeIndex.get(state.id);
      if (!route) continue;
      const url = buildSamplePath(route.canonicalPattern);

      for (const method of COMMON_METHODS) {
        const result = await backend.resolveRequest({ method, url });
        if (methods.includes(method) && !result.ok && result.reason === "method_not_allowed") {
          findings.push(buildFinding({
            id: `backend_method_policy:${state.id}:${method}`,
            title: "Allowed backend method was denied",
            severity: "high",
            category: "backend",
            message: `Method ${method} should be allowed for state ${state.id} but was denied.`,
            recommendation: "Align backend methods with schema policy.",
            probeName: this.name,
            stateId: state.id,
            route: url,
            url
          }));
        }

        if (!methods.includes(method) && result.ok) {
          findings.push(buildFinding({
            id: `backend_method_policy:${state.id}:${method}:allowed`,
            title: "Disallowed backend method was accepted",
            severity: "high",
            category: "backend",
            message: `Method ${method} should be denied for state ${state.id} but resolved successfully.`,
            recommendation: "Restrict backend methods or add guards.",
            probeName: this.name,
            stateId: state.id,
            route: url,
            url
          }));
        }
      }
    }

    return findings;
  }
}

export function backendMethodPolicy(): BackendMethodPolicyProbe {
  return new BackendMethodPolicyProbe();
}
