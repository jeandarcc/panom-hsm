import type { AnyRecord } from "../../core/types.js";
import type { HsmMachine } from "../../core/HsmMachine.js";
import type { HsmAgentTrace } from "../types.js";
import { ReplayTraceLoader } from "./ReplayTraceLoader.js";
import { HeadlessReplayDriver } from "./HeadlessReplayDriver.js";
import { BrowserReplayDriver } from "./BrowserReplayDriver.js";

export interface ReplayOptions {
  readonly agentId: string;
  readonly browser?: boolean;
  readonly pauseOnFail?: boolean;
  readonly context?: AnyRecord;
}

export class HsmAgentReplayRunner<TContext extends AnyRecord = AnyRecord> {
  public constructor(private readonly hsm: HsmMachine<TContext>) {}

  public async replay(reportPath: string, options: ReplayOptions): Promise<{ ok: boolean; reproduced: boolean; message?: string }> {
    const loader = new ReplayTraceLoader();
    const report = await loader.loadReport(reportPath);
    const trace = loader.findTrace(report, options.agentId);
    if (!trace) {
      return { ok: false, reproduced: false, message: "Trace not found" };
    }

    if (options.browser) {
      const driver = new BrowserReplayDriver();
      await driver.replay(trace.events, { pauseOnFail: options.pauseOnFail });
      return { ok: true, reproduced: true, message: "Browser replay completed" };
    }

    const driver = new HeadlessReplayDriver(this.hsm);
    const context = (options.context ?? {}) as TContext;
    return driver.replay(trace.events, context);
  }

  public extractTrace(reportPath: string, agentId: string): Promise<HsmAgentTrace | undefined> {
    const loader = new ReplayTraceLoader();
    return loader.loadReport(reportPath).then((report) => loader.findTrace(report, agentId));
  }
}
