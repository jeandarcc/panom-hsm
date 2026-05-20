import path from "node:path";
import fg from "fast-glob";

export interface HsmTestDiscoveryOptions {
  readonly cwd?: string;
  readonly patterns?: readonly string[];
}

export class HsmTestDiscovery {
  public constructor(private readonly options: HsmTestDiscoveryOptions = {}) {}

  public async discoverTests(): Promise<readonly string[]> {
    const patterns = this.options.patterns ?? [
      "hsm.test.ts",
      "hsm.tests.ts",
      "tests/hsm/**/*.test.ts",
      "tests/hsm/**/*.hsm.ts",
      "hsm.test.js",
      "hsm.tests.js",
      "tests/hsm/**/*.test.js",
      "tests/hsm/**/*.hsm.js"
    ];
    const cwd = this.options.cwd ?? process.cwd();
    const matches = await fg(patterns, { cwd, absolute: true });
    return Object.freeze(matches.map((file) => path.resolve(cwd, file)));
  }

  public async discoverConfig(): Promise<string | null> {
    const patterns = ["hsm.config.ts", "hsm.config.js", "hsm.config.mjs", "hsm.config.cjs"];
    const cwd = this.options.cwd ?? process.cwd();
    const matches = await fg(patterns, { cwd, absolute: true });
    return matches.length > 0 ? path.resolve(matches[0]) : null;
  }

  public async discoverSchema(): Promise<string | null> {
    const patterns = ["hsm.schema.json", "hsm.schema.ts", "hsm.schema.js", "hsm.schema.mjs"];
    const cwd = this.options.cwd ?? process.cwd();
    const matches = await fg(patterns, { cwd, absolute: true });
    return matches.length > 0 ? path.resolve(matches[0]) : null;
  }
}
