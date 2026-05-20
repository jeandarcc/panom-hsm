import type { AnyRecord, HsmQueryType } from "../../core/types.js";
import type { HsmSchema } from "../../schema/HsmSchema.js";
import type { HsmFinding, HsmProbeContext, HsmSecurityProbe } from "../types.js";
import { buildFinding } from "./ProbeUtils.js";

const INVALID_PAYLOADS: Record<HsmQueryType, readonly string[]> = {
  string: ["", "\"\"", "<script>", "a".repeat(2048)],
  number: ["-1", "NaN", "Infinity", "1e309"],
  boolean: ["maybe", "1", "yes"],
  "string[]": ["[]", "a,b", "\"x\""],
  "number[]": ["[]", "1,2", "NaN"],
  "boolean[]": ["[]", "true,false", "maybe"],
  json: ["{}", "[]", "{\"a\":1}", "null"]
};

export class QueryTamperingProbe implements HsmSecurityProbe {
  public readonly name = "query_tampering";
  public readonly description = "Audit query schema robustness against malformed inputs.";
  public readonly defaultSeverity = "medium" as const;

  public async run(context: HsmProbeContext): Promise<readonly HsmFinding[]> {
    const findings: HsmFinding[] = [];
    const schema = context.schema as HsmSchema | undefined;
    if (!schema?.query || Object.keys(schema.query).length === 0) {
      return [
        buildFinding({
          id: "query_tampering:missing_schema",
          title: "Query schema unavailable",
          severity: "low",
          category: "configuration",
          message: "Query tampering probe requires schema query metadata.",
          recommendation: "Provide schema when running audits.",
          probeName: this.name
        })
      ];
    }

    const route = context.adapter.routes()[0] as AnyRecord | undefined;
    const basePath = route?.canonicalPattern ?? route?.pattern ?? "/";

    for (const [key, binding] of Object.entries(schema.query)) {
      const type = (binding.type ?? "string") as HsmQueryType;
      const payloads = INVALID_PAYLOADS[type] ?? INVALID_PAYLOADS.string;

      for (const payload of payloads) {
        const url = `${basePath}?${encodeURIComponent(binding.key ?? key)}=${encodeURIComponent(payload)}`;
        try {
          const snapshot = await context.adapter.resolveUrl(url, { context: context.contextProfiles.anonymous });
          const decoded = snapshot.urlState?.decoded?.[binding.key ?? key];
          if (decoded !== undefined && String(decoded) === payload) {
            findings.push(buildFinding({
              id: `query_tampering:${key}:${payload}`,
              title: "Invalid query value accepted",
              severity: "medium",
              category: "query",
              message: `Query parameter "${key}" accepted a potentially invalid value.`,
              recommendation: "Add validation or stricter invalid policy for query bindings.",
              probeName: this.name,
              url,
              evidence: { key, payload, type }
            }));
          }
        } catch (error) {
          findings.push(buildFinding({
            id: `query_tampering:${key}:error`,
            title: "Query tampering caused resolution failure",
            severity: "high",
            category: "query",
            message: "Invalid query value caused HSM to throw during resolution.",
            recommendation: "Handle invalid query values with default or ignore policies.",
            probeName: this.name,
            url,
            evidence: { key, payload, error: error instanceof Error ? error.message : String(error) }
          }));
        }
      }
    }

    return findings;
  }
}

export function queryTampering(): QueryTamperingProbe {
  return new QueryTamperingProbe();
}
