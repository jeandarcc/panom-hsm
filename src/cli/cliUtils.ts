import fs from "node:fs/promises";
import path from "node:path";
import type { HsmAuditReportData, HsmFindingSeverity, HsmTestReportData } from "../testing/types.js";

export interface ParsedArgs {
  readonly config?: string;
  readonly schema?: string;
  readonly tests?: string;
  readonly json?: boolean;
  readonly report?: string;
  readonly severity?: HsmFindingSeverity;
  readonly failOn?: HsmFindingSeverity;
  readonly verbose?: boolean;
}

export function parseArgs(args: readonly string[]): ParsedArgs {
  const parsed: Record<string, unknown> = {};
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];
    if (!current) continue;
    if (current === "--json") parsed.json = true;
    if (current === "--verbose") parsed.verbose = true;
    if (current === "--config") { parsed.config = next; index += 1; }
    if (current === "--schema") { parsed.schema = next; index += 1; }
    if (current === "--tests") { parsed.tests = next; index += 1; }
    if (current === "--report") { parsed.report = next; index += 1; }
    if (current === "--severity") { parsed.severity = next as ParsedArgs["severity"]; index += 1; }
    if (current === "--fail-on") { parsed.failOn = next as ParsedArgs["failOn"]; index += 1; }
  }
  return parsed as ParsedArgs;
}

export function severityRank(level: HsmFindingSeverity): number {
  return { info: 0, low: 1, medium: 2, high: 3, critical: 4 }[level];
}

export function filterBySeverity<T extends { severity: HsmFindingSeverity }>(
  items: readonly T[],
  min?: HsmFindingSeverity
): readonly T[] {
  if (!min) return items;
  const threshold = severityRank(min);
  return items.filter((item) => severityRank(item.severity) >= threshold);
}

export async function writeReport(
  report: string,
  outputPath?: string
): Promise<void> {
  if (!outputPath) return;
  const target = path.resolve(process.cwd(), outputPath);
  await fs.writeFile(target, report, "utf-8");
}

export function filterReport<T extends HsmAuditReportData | HsmTestReportData>(
  report: T,
  min?: HsmFindingSeverity
): T {
  if (!min) return report;
  const filteredFindings = filterBySeverity(report.findings, min);
  const severities = {
    info: filteredFindings.filter((finding) => finding.severity === "info").length,
    low: filteredFindings.filter((finding) => finding.severity === "low").length,
    medium: filteredFindings.filter((finding) => finding.severity === "medium").length,
    high: filteredFindings.filter((finding) => finding.severity === "high").length,
    critical: filteredFindings.filter((finding) => finding.severity === "critical").length
  };
  return {
    ...report,
    findings: filteredFindings,
    findingsBySeverity: {
      info: filteredFindings.filter((finding) => finding.severity === "info"),
      low: filteredFindings.filter((finding) => finding.severity === "low"),
      medium: filteredFindings.filter((finding) => finding.severity === "medium"),
      high: filteredFindings.filter((finding) => finding.severity === "high"),
      critical: filteredFindings.filter((finding) => finding.severity === "critical")
    },
    summary: {
      ...report.summary,
      severities
    }
  } as T;
}
