import fs from "node:fs/promises";
import path from "node:path";
import type { HsmAgentTrace } from "../types.js";

export class ReplayArtifactWriter {
  public async writeTrace(trace: HsmAgentTrace, filePath: string): Promise<void> {
    const resolved = path.resolve(process.cwd(), filePath);
    await fs.writeFile(resolved, JSON.stringify(trace, null, 2), "utf-8");
  }
}
