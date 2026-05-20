import type { AnyRecord } from "../../core/types.js";
import type { HsmMachine } from "../../core/HsmMachine.js";
import type { HsmAgentTraceEvent } from "../types.js";
import { createHsmAgentRuntimeAdapter } from "../HsmAgentRuntimeAdapter.js";

export interface HeadlessReplayResult {
  readonly ok: boolean;
  readonly reproduced: boolean;
  readonly message?: string;
}

export class HeadlessReplayDriver<TContext extends AnyRecord = AnyRecord> {
  public constructor(private readonly hsm: HsmMachine<TContext>) {}

  public async replay(events: readonly HsmAgentTraceEvent[], context: TContext): Promise<HeadlessReplayResult> {
    const adapter = createHsmAgentRuntimeAdapter(this.hsm);
    let reproduced = false;

    for (const event of events) {
      if (!event.url) continue;
      const snapshot = await adapter.resolveUrl(event.url, { context });
      if (event.expected?.state && snapshot.stateId !== event.expected.state) {
        reproduced = true;
      }
      if (event.findings && event.findings.length > 0) {
        reproduced = true;
      }
    }

    return { ok: true, reproduced, message: reproduced ? "Finding reproduced" : "No findings reproduced" };
  }
}
