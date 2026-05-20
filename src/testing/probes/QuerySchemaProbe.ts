import type { HsmSchema } from "../../schema/HsmSchema.js";
import type { HsmFinding, HsmProbeContext, HsmSecurityProbe } from "../types.js";
import { buildFinding } from "./ProbeUtils.js";

export class QuerySchemaProbe implements HsmSecurityProbe {
  public readonly name = "query_schema";
  public readonly description = "Validate query schema structure and defaults.";
  public readonly defaultSeverity = "low" as const;

  public async run(context: HsmProbeContext): Promise<readonly HsmFinding[]> {
    const schema = context.schema as HsmSchema | undefined;
    if (!schema?.query) {
      return [
        buildFinding({
          id: "query_schema:missing",
          title: "Query schema not found",
          severity: "low",
          category: "query",
          message: "Schema does not define query bindings.",
          recommendation: "Add query schema or skip query audits.",
          probeName: this.name
        })
      ];
    }

    const findings: HsmFinding[] = [];
    for (const [key, binding] of Object.entries(schema.query)) {
      if (!binding.type) {
        findings.push(buildFinding({
          id: `query_schema:${key}:missing_type`,
          title: "Query binding missing type",
          severity: "low",
          category: "query",
          message: `Query binding "${key}" has no explicit type; defaults may be inconsistent.`,
          recommendation: "Declare query binding type for strict validation.",
          probeName: this.name
        }));
      }
      if (binding.default === undefined) {
        findings.push(buildFinding({
          id: `query_schema:${key}:missing_default`,
          title: "Query binding missing default",
          severity: "info",
          category: "query",
          message: `Query binding "${key}" has no default value.`,
          recommendation: "Define defaults to avoid undefined query state.",
          probeName: this.name
        }));
      }
    }

    return findings;
  }
}

export function querySchema(): QuerySchemaProbe {
  return new QuerySchemaProbe();
}
