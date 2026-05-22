import type { HsmAgentContextRef, HsmAgentInvariant, HsmAgentInvariantResult } from "./types.js";

export class HsmAgentInvariantRunner {
  public constructor(private readonly invariants: readonly HsmAgentInvariant[]) {}

  public async run(context: HsmAgentContextRef): Promise<readonly HsmAgentInvariantResult[]> {
    const results: HsmAgentInvariantResult[] = [];
    for (const invariant of this.invariants) {
      results.push(await invariant.run(context));
    }
    return results;
  }
}
