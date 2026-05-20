import type { HsmAuditReportData, HsmFinding, HsmFindingSeverity, HsmTestReportData } from "../types.js";

type ReportData = HsmTestReportData | HsmAuditReportData;

const SEVERITY_ORDER: readonly HsmFindingSeverity[] = ["critical", "high", "medium", "low", "info"];

export class TextReporter {
  public render(report: ReportData): string {
    const lines: string[] = [];
    const title = "tests" in report ? "HSM Test Report" : "HSM Audit Report";
    lines.push(title);
    lines.push(`Result: ${report.ok ? "PASSED" : "FAILED"}`);
    lines.push(`Duration: ${report.metadata.durationMs}ms`);
    lines.push("");
    lines.push("Summary:");
    lines.push(`- Tests: ${report.summary.tests.passed} passed, ${report.summary.tests.failed} failed`);
    lines.push(`- Security probes: ${report.summary.probes.passed} passed, ${report.summary.probes.failed} failed`);
    lines.push(`- Critical: ${report.summary.severities.critical}`);
    lines.push(`- High: ${report.summary.severities.high}`);
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

    return lines.join("\n").trim();
  }

  private renderFinding(finding: HsmFinding): string[] {
    const lines: string[] = [];
    const label = finding.probeName ? `[${finding.probeName}]` : finding.testName ? `[${finding.testName}]` : "[finding]";
    lines.push(`${label} ${finding.title}`);
    if (finding.url) lines.push(`URL: ${finding.url}`);
    if (finding.stateId) lines.push(`State: ${finding.stateId}`);
    if (finding.route) lines.push(`Route: ${finding.route}`);
    if (finding.expected !== undefined) lines.push(`Expected: ${stringify(finding.expected)}`);
    if (finding.actual !== undefined) lines.push(`Actual: ${stringify(finding.actual)}`);
    lines.push(`Severity: ${finding.severity}`);
    lines.push(`Message: ${finding.message}`);
    if (finding.recommendation) lines.push(`Recommendation: ${finding.recommendation}`);
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
