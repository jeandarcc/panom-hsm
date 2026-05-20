import type { HsmAuditReportData, HsmTestReportData } from "../types.js";

type ReportData = HsmTestReportData | HsmAuditReportData;

export class JsonReporter {
  public render(report: ReportData): string {
    return JSON.stringify(report, null, 2);
  }
}
