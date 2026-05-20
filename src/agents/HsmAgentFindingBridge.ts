import type { HsmFinding } from "../testing/types.js";
import type { HsmAgentFinding } from "./types.js";

export function toAgentFinding(
  finding: HsmFinding,
  details: {
    agentId: string;
    action?: string;
    stepIndex?: number;
    method?: string;
    replay?: string;
  }
): HsmAgentFinding {
  return {
    ...finding,
    agentId: details.agentId,
    action: details.action,
    stepIndex: details.stepIndex,
    method: details.method,
    replay: details.replay,
    evidence: {
      ...(finding.evidence ?? {}),
      agentId: details.agentId,
      action: details.action,
      stepIndex: details.stepIndex
    }
  };
}
