import type { AnyRecord } from "../../core/types.js";
import { buildSamplePath } from "../../testing/probes/ProbeUtils.js";

export function createTraceEventId(agentId: string, step: number, action: string): string {
  return `${agentId}:${step}:${action}`;
}

export function samplePath(route: AnyRecord): string {
  const pattern = route.canonicalPattern ?? route.pattern ?? "/";
  return buildSamplePath(pattern);
}

export function safeString(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
