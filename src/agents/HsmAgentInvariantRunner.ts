import type { HsmAgentInvariant, HsmAgentInvariantResult } from "./types.js";
import type { HsmAgentContext } from "./HsmAgentContext.js";

export class HsmAgentInvariantRunner {
  public constructor(private readonly invariants: readonly HsmAgentInvariant[]) {}

  public async run(context: HsmAgentContext): Promise<readonly HsmAgentInvariantResult[]> {
    const results: HsmAgentInvariantResult[] = [];
    for (const invariant of this.invariants) {
      results.push(await invariant.run(context));
    }
    return results;
  }
}
