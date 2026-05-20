import type { AnyRecord } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema } from "../schema/HsmSchema.js";
import type { HsmAgentAction, HsmAgentInvariant, HsmAgentSuite } from "./types.js";
import { HsmAgentRunner } from "./HsmAgentRunner.js";

export interface RunHsmAgentsOptions<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: HsmMachine<TContext>;
  readonly suite: HsmAgentSuite<TContext>;
  readonly schema?: HsmSchema;
  readonly actions?: readonly HsmAgentAction[];
  readonly invariants?: readonly HsmAgentInvariant[];
}

export async function runHsmAgents<TContext extends AnyRecord = AnyRecord>(
  options: RunHsmAgentsOptions<TContext>
) {
  const runner = new HsmAgentRunner(
    options.hsm,
    options.suite,
    options.schema,
    options.actions ?? options.suite.actions ?? [],
    options.invariants ?? options.suite.invariants ?? []
  );
  return runner.run();
}
