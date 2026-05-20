import type { AnyRecord } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema } from "../schema/HsmSchema.js";
import type { HsmFindingSeverity } from "../testing/types.js";
import type { HsmAgentAction, HsmAgentFinding, HsmAgentInvariant, HsmAgentReportData, HsmAgentSuite } from "./types.js";
import { HsmAgentSwarm } from "./HsmAgentSwarm.js";
import { HsmAgentReport } from "./HsmAgentReport.js";
import { HsmAgentSafetyPolicy } from "./HsmAgentSafetyPolicy.js";

export class HsmAgentRunner<TContext extends AnyRecord = AnyRecord> {
  public constructor(
    private readonly hsm: HsmMachine<TContext>,
    private readonly suite: HsmAgentSuite<TContext>,
    private readonly schema: HsmSchema | undefined,
    private readonly actions: readonly HsmAgentAction[],
    private readonly invariants: readonly HsmAgentInvariant[]
  ) {}

  public async run(): Promise<HsmAgentReport> {
    const safety = new HsmAgentSafetyPolicy(this.suite.safety);
    const validation = safety.validateTarget(this.suite.target);
    if (!validation.ok) {
      throw new Error(`Agent swarm blocked by safety policy (${validation.reason ?? "unknown"}).`);
    }
    const startedAt = Date.now();
    const swarm = new HsmAgentSwarm(this.hsm, this.suite, this.schema, this.actions, this.invariants);
    const results = await swarm.run();

    const findings: HsmAgentFinding[] = [];
    const agentSummaries = results.map((result) => {
      findings.push(...result.findings);
      return {
        agentId: result.agentId,
        profile: result.profile,
        seed: result.trace.seed,
        ok: result.ok,
        steps: result.steps,
        findings: result.findings.length,
        account: result.account
      };
    });

    const findingsBySeverity = bucketFindings(findings);
    const durationMs = Date.now() - startedAt;
    const failed = results.filter((result) => !result.ok).length;
    const ok = findings.length === 0;

    const report: HsmAgentReportData = {
      ok,
      suiteName: this.suite.name,
      target: this.suite.target,
      seed: this.suite.agents.seed ?? "auto",
      durationMs,
      agents: {
        total: this.suite.agents.count,
        completed: results.length,
        failed
      },
      steps: { total: results.reduce((sum, result) => sum + result.steps, 0) },
      findings,
      findingsBySeverity,
      agentSummaries,
      traces: results.map((result) => result.trace),
      reproduction: buildReproductionCommands(results.map((result) => result.agentId)),
      metadata: {
        generatedAt: new Date().toISOString(),
        environment: { node: process.version, platform: process.platform },
        schema: this.schema?.metadata ?? undefined
      }
    };

    return new HsmAgentReport(report);
  }
}

function bucketFindings(findings: readonly HsmAgentFinding[]): Record<HsmFindingSeverity, readonly HsmAgentFinding[]> {
  return {
    info: findings.filter((finding) => finding.severity === "info"),
    low: findings.filter((finding) => finding.severity === "low"),
    medium: findings.filter((finding) => finding.severity === "medium"),
    high: findings.filter((finding) => finding.severity === "high"),
    critical: findings.filter((finding) => finding.severity === "critical")
  };
}

function buildReproductionCommands(agentIds: readonly string[]): readonly string[] {
  return agentIds.map((agentId) => `hsm agents replay <report.json> --agent ${agentId}`);
}
