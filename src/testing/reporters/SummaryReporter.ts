import type { HsmAuditReportData, HsmTestReportData } from "../types.js";

type ReportData = HsmTestReportData | HsmAuditReportData;

export class SummaryReporter {
  public render(report: ReportData): string {
    return `tests=${report.summary.tests.passed}/${report.summary.tests.total} probes=${report.summary.probes.passed}/${report.summary.probes.total} critical=${report.summary.severities.critical} high=${report.summary.severities.high}`;
  }
}
