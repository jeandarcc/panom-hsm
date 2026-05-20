import fs from "node:fs/promises";
import path from "node:path";
import type { HsmAgentReportData, HsmAgentTrace } from "../types.js";

export class ReplayTraceLoader {
  public async loadReport(filePath: string): Promise<HsmAgentReportData> {
    const resolved = path.resolve(process.cwd(), filePath);
    const raw = await fs.readFile(resolved, "utf-8");
    return JSON.parse(raw) as HsmAgentReportData;
  }

  public findTrace(report: HsmAgentReportData, agentId: string): HsmAgentTrace | undefined {
    return report.traces.find((trace) => trace.agentId === agentId);
  }
}
