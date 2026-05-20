import type { HsmAgentReportData } from "../types.js";

export class AgentJsonReporter {
  public render(report: HsmAgentReportData): string {
    return JSON.stringify(report, null, 2);
  }
}
