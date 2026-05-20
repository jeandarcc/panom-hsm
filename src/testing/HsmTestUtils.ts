import type { HsmFinding, HsmFindingSeverity, HsmProbeResult, HsmReportSummary, HsmTestResult } from "./types.js";

export function nowIso(): string {
  return new Date().toISOString();
}

export function groupFindingsBySeverity(findings: readonly HsmFinding[]): Record<HsmFindingSeverity, readonly HsmFinding[]> {
  const buckets: Record<HsmFindingSeverity, HsmFinding[]> = {
    info: [],
    low: [],
    medium: [],
    high: [],
    critical: []
  };
  for (const finding of findings) {
    buckets[finding.severity].push(finding);
  }
  return Object.freeze({
    info: Object.freeze(buckets.info),
    low: Object.freeze(buckets.low),
    medium: Object.freeze(buckets.medium),
    high: Object.freeze(buckets.high),
    critical: Object.freeze(buckets.critical)
  });
}

export function reportSummary(
  tests: readonly HsmTestResult[],
  probes: readonly HsmProbeResult[],
  findings: readonly HsmFinding[]
): HsmReportSummary {
  const severities = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const finding of findings) severities[finding.severity] += 1;
  const failedTests = tests.filter((test) => !test.ok).length;
  const failedProbes = probes.filter((probe) => !probe.ok).length;
  return Object.freeze({
    tests: { total: tests.length, passed: tests.length - failedTests, failed: failedTests },
    probes: { total: probes.length, passed: probes.length - failedProbes, failed: failedProbes },
    severities
  });
}
