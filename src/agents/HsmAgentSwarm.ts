import type { AnyRecord } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema } from "../schema/HsmSchema.js";
import type { HsmAgentAction, HsmAgentInvariant, HsmAgentSuite, HsmAgentAccount } from "./types.js";
import { HsmAgent, type HsmAgentRunResult } from "./HsmAgent.js";
import { HsmAgentContext } from "./HsmAgentContext.js";
import { HsmAgentRandom } from "./HsmAgentRandom.js";
import { HsmAgentScheduler } from "./HsmAgentScheduler.js";
import { HsmAgentAccountManager } from "./HsmAgentAccountManager.js";
import { HsmAgentSafetyPolicy } from "./HsmAgentSafetyPolicy.js";
import { createHsmAgentRuntimeAdapter } from "./HsmAgentRuntimeAdapter.js";

export class HsmAgentSwarm<TContext extends AnyRecord = AnyRecord> {
  private readonly adapter: ReturnType<typeof createHsmAgentRuntimeAdapter<TContext>>;
  private readonly safety: HsmAgentSafetyPolicy;
  private readonly accountManager: HsmAgentAccountManager;

  public constructor(
    private readonly hsm: HsmMachine<TContext>,
    private readonly suite: HsmAgentSuite<TContext>,
    private readonly schema: HsmSchema | undefined,
    private readonly actions: readonly HsmAgentAction[],
    private readonly invariants: readonly HsmAgentInvariant[]
  ) {
    this.adapter = createHsmAgentRuntimeAdapter(this.hsm);
    this.safety = new HsmAgentSafetyPolicy(this.suite.safety);
    this.accountManager = new HsmAgentAccountManager(this.suite.accounts);
  }

  public async run(): Promise<readonly HsmAgentRunResult[]> {
    const random = new HsmAgentRandom(this.suite.agents.seed ?? "auto");
    const tasks: Array<() => Promise<HsmAgentRunResult>> = [];

    for (let index = 0; index < this.suite.agents.count; index += 1) {
      const agentId = `agent-${index + 1}`;
      const profile = this.suite.agents.profiles[index % this.suite.agents.profiles.length]!;
      const seed = random.child(agentId);
      tasks.push(async () => {
        const account = profile.requiresAccount ? await this.accountManager.create(profile) : undefined;
        const context = new HsmAgentContext({
          agentId,
          suite: this.suite,
          profile,
          account,
          adapter: this.adapter,
          random: seed,
          safety: this.safety,
          schema: this.schema
        });
        const agent = new HsmAgent(context, this.actions, this.invariants);
        try {
          const result = await agent.run();
          return {
            ...result,
            account: this.accountManager.redact(result.account as HsmAgentAccount)
          };
        } finally {
          await this.accountManager.destroy(account);
        }
      });
    }

    const scheduler = new HsmAgentScheduler(this.safety.config.maxConcurrentAgents);
    return scheduler.runAll(tasks);
  }
}
