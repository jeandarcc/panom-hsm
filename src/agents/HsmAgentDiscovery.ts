import fg from "fast-glob";

export interface HsmAgentDiscoveryOptions {
  readonly cwd?: string;
}

export class HsmAgentDiscovery {
  public constructor(private readonly options: HsmAgentDiscoveryOptions = {}) {}

  public async discoverSuite(): Promise<string | null> {
    const patterns = [
      "hsm.agents.ts",
      "hsm.agents.js",
      "hsm.agents.mjs",
      "tests/hsm/**/*.agents.ts",
      "tests/hsm/**/*.agents.js"
    ];
    const cwd = this.options.cwd ?? process.cwd();
    const matches = await fg(patterns, { cwd, absolute: true });
    return matches.length > 0 ? matches[0]! : null;
  }
}
