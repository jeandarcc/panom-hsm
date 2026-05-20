import type { AnyRecord } from "../core/types.js";
import type { HsmAgentAction, HsmAgentFinding, HsmAgentInvariant, HsmAgentTrace, HsmAgentAccount } from "./types.js";
import { HsmAgentContext } from "./HsmAgentContext.js";
import { HsmAgentInvariantRunner } from "./HsmAgentInvariantRunner.js";

export interface HsmAgentRunResult {
  readonly agentId: string;
  readonly profile: string;
  readonly ok: boolean;
  readonly steps: number;
  readonly findings: readonly HsmAgentFinding[];
  readonly trace: HsmAgentTrace;
  readonly account?: HsmAgentAccount;
}

export class HsmAgent<TContext extends AnyRecord = AnyRecord> {
  private readonly actionList: readonly HsmAgentAction[];
  private readonly invariantRunner: HsmAgentInvariantRunner;

  public constructor(
    private readonly context: HsmAgentContext<TContext>,
    actions: readonly HsmAgentAction[],
    invariants: readonly HsmAgentInvariant[]
  ) {
    this.actionList = actions;
    this.invariantRunner = new HsmAgentInvariantRunner(invariants);
  }

  public async run(): Promise<HsmAgentRunResult> {
    const findings: HsmAgentFinding[] = [];
    const startedAt = Date.now();
    const maxSteps = this.context.suite.agents.maxSteps ?? Number.POSITIVE_INFINITY;
    const durationMs = this.context.suite.agents.durationMs ?? Number.POSITIVE_INFINITY;

    await this.seedBaseline();

    while (this.context.stepIndex < maxSteps && (Date.now() - startedAt) < durationMs) {
      const action = this.pickAction();
      if (!action) break;

      this.context.lastAction = action.name;
      const result = await action.run(this.context);
      if (result.snapshot !== undefined) {
        this.context.setSnapshot(result.snapshot as AnyRecord);
      }
      if (result.findings.length > 0) {
        findings.push(...result.findings);
      }
      if (result.trace) {
        this.context.trace.record(result.trace);
      }

      const invariantResults = await this.invariantRunner.run(this.context);
      for (const invariant of invariantResults) {
        findings.push(...invariant.findings);
      }

      this.context.stepIndex += 1;
    }

    return {
      agentId: this.context.agentId,
      profile: this.context.profile.name,
      ok: findings.length === 0,
      steps: this.context.stepIndex,
      findings: Object.freeze(findings),
      trace: this.context.trace.build(),
      account: this.context.account
    };
  }

  private pickAction(): HsmAgentAction | undefined {
    const allowed = this.actionList.filter((action) => action.canRun(this.context));
    if (allowed.length === 0) return undefined;
    const total = allowed.reduce((sum, action) => sum + action.weight, 0);
    let roll = this.context.random.next() * total;
    for (const action of allowed) {
      roll -= action.weight;
      if (roll <= 0) return action;
    }
    return allowed[allowed.length - 1];
  }

  private async seedBaseline(): Promise<void> {
    const routes = this.context.adapter.routes();
    const baseRoute = routes[0] as AnyRecord | undefined;
    const basePath = baseRoute?.canonicalPattern ?? baseRoute?.pattern ?? "/";
    try {
      const snapshot = await this.context.adapter.resolveUrl(basePath, {
        context: this.context.profile.context
      });
      this.context.setSnapshot(snapshot as AnyRecord);
      this.context.setBaseline(snapshot as AnyRecord);
    } catch {
      this.context.setSnapshot(null);
    }
  }
}
