import type { HsmAgentReportData } from "../types.js";

export class AgentSummaryReporter {
  public summarize(report: HsmAgentReportData): string {
    return `Agents: ${report.agents.completed}/${report.agents.total}, Findings: ${report.findings.length}`;
  }
}
