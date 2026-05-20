import type { HsmFindingSeverity } from "../../testing/types.js";
import type { HsmAgentFinding, HsmAgentReportData } from "../types.js";

const SEVERITY_ORDER: readonly HsmFindingSeverity[] = ["critical", "high", "medium", "low", "info"];

export class AgentTextReporter {
  public render(report: HsmAgentReportData): string {
    const lines: string[] = [];
    lines.push("HSM Agent Swarm Report");
    lines.push(`Result: ${report.ok ? "PASSED" : "FAILED"}`);
    lines.push(`Duration: ${report.durationMs}ms`);
    lines.push("");
    lines.push("Summary:");
    lines.push(`- Agents: ${report.agents.completed} completed, ${report.agents.failed} failed`);
    lines.push(`- Steps: ${report.steps.total}`);
    lines.push(`- Critical: ${report.findingsBySeverity.critical.length}`);
    lines.push(`- High: ${report.findingsBySeverity.high.length}`);
    lines.push("");

    for (const severity of SEVERITY_ORDER) {
      const bucket = report.findingsBySeverity[severity];
      if (!bucket || bucket.length === 0) continue;
      lines.push(`${capitalize(severity)}:`);
      for (const finding of bucket) {
        lines.push(...this.renderFinding(finding));
        lines.push("");
      }
    }

    if (report.reproduction.length > 0) {
      lines.push("Reproduction:");
      for (const command of report.reproduction) {
        lines.push(`- ${command}`);
      }
    }

    return lines.join("\n").trim();
  }

  private renderFinding(finding: HsmAgentFinding): string[] {
    const lines: string[] = [];
    const label = finding.action ? `[${finding.action}]` : "[agent]";
    lines.push(`${label} ${finding.title}`);
    if (finding.agentId) lines.push(`Agent: ${finding.agentId}`);
    if (finding.url) lines.push(`URL: ${finding.url}`);
    if (finding.stateId) lines.push(`State: ${finding.stateId}`);
    if (finding.route) lines.push(`Route: ${finding.route}`);
    if (finding.expected !== undefined) lines.push(`Expected: ${stringify(finding.expected)}`);
    if (finding.actual !== undefined) lines.push(`Actual: ${stringify(finding.actual)}`);
    lines.push(`Severity: ${finding.severity}`);
    lines.push(`Message: ${finding.message}`);
    if (finding.recommendation) lines.push(`Recommendation: ${finding.recommendation}`);
    if (finding.replay) lines.push(`Replay: ${finding.replay}`);
    return lines;
  }
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
