import type { AnyRecord } from "../../core/types.js";
import type { HsmFinding, HsmFindingSeverity } from "../types.js";

export function wildcardMatch(input: string, pattern: string): boolean {
  if (pattern === "*") return true;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(input);
}

export function buildFinding(args: {
  id: string;
  title: string;
  severity: HsmFindingSeverity;
  category: HsmFinding["category"];
  message: string;
  recommendation?: string;
  expected?: unknown;
  actual?: unknown;
  probeName?: string;
  stateId?: string;
  route?: string;
  url?: string;
  evidence?: Readonly<AnyRecord>;
}): HsmFinding {
  return {
    id: args.id,
    title: args.title,
    severity: args.severity,
    category: args.category,
    message: args.message,
    recommendation: args.recommendation,
    expected: args.expected,
    actual: args.actual,
    probeName: args.probeName,
    stateId: args.stateId,
    route: args.route,
    url: args.url,
    evidence: args.evidence
  };
}

export function sampleParams(pattern: string): AnyRecord {
  const params: AnyRecord = {};
  const matches = pattern.match(/:([A-Za-z0-9_]+)/g) ?? [];
  for (const match of matches) {
    const key = match.slice(1);
    params[key] = "sample";
  }
  return params;
}

export function buildSamplePath(pattern: string): string {
  return pattern.replace(/:([A-Za-z0-9_]+)/g, "sample").replace(/\*/g, "sample");
}

export function isDangerousPermission(permission: string): boolean {
  return /\.(delete|write|update|admin)$/.test(permission) ||
    permission.startsWith("billing.") ||
    ["media.delete", "user.ban"].includes(permission);
}

export function severityForPermission(permission: string): HsmFindingSeverity {
  return isDangerousPermission(permission) ? "critical" : "high";
}
