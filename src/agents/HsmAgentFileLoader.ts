import type { AnyRecord } from "../core/types.js";
import { HsmTestFileLoader } from "../testing/HsmTestFileLoader.js";
import type { HsmAgentSuite } from "./types.js";

export class HsmAgentFileLoader {
  private readonly loader = new HsmTestFileLoader();

  public async loadSuite(filePath: string): Promise<HsmAgentSuite> {
    const mod = await this.loader.loadConfig(filePath);
    const suite = mod.suite ?? mod.default ?? mod;
    if (!suite || suite.kind !== "hsm-agent-suite") {
      throw new Error(`No HSM agent suite exported from ${filePath}. Use defineHsmAgentSuite().`);
    }
    return suite as HsmAgentSuite;
  }

  public async loadConfig(filePath: string): Promise<AnyRecord> {
    return this.loader.loadConfig(filePath);
  }
}
