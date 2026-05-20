import { createRequire } from "node:module";
import path from "node:path";
import type { AnyRecord } from "../core/types.js";
import type { HsmTest } from "./types.js";

export interface HsmTestFileLoaderOptions {
  readonly cwd?: string;
}

export class HsmTestFileLoader {
  private readonly require = createRequire(import.meta.url);
  private readonly cwd: string;

  public constructor(options: HsmTestFileLoaderOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
  }

  public async loadTests(filePath: string): Promise<readonly HsmTest[]> {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(this.cwd, filePath);
    const mod = await this.loadModule(resolved);
    const candidates = [mod.default, mod.tests, mod.hsmTests].filter(Boolean);
    const tests = candidates.flatMap((value) => this.normalizeTests(value));
    if (tests.length === 0) {
      throw new Error(`No tests exported from ${filePath}. Export default or named "tests".`);
    }
    return Object.freeze(tests);
  }

  public async loadConfig(filePath: string): Promise<AnyRecord> {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(this.cwd, filePath);
    const mod = await this.loadModule(resolved);
    return mod.default ?? mod.config ?? mod.hsm ?? mod;
  }

  private async loadModule(filePath: string): Promise<AnyRecord> {
    const jitiFactory = this.require("jiti");
    const jiti = jitiFactory(import.meta.url, { interopDefault: true, esmResolve: true });
    return jiti(filePath);
  }

  private normalizeTests(value: unknown): HsmTest[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as HsmTest[];
    if (typeof value === "object") return [value as HsmTest];
    return [];
  }
}
