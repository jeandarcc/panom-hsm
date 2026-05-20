import type { HsmAgentFinding, HsmAgentTrace, HsmAgentTraceEvent } from "./types.js";

export class HsmAgentTraceBuilder {
  private readonly events: HsmAgentTraceEvent[] = [];

  public constructor(private readonly agentId: string, private readonly seed: string) {}

  public record(event: HsmAgentTraceEvent): void {
    this.events.push(event);
  }

  public attachFindings(eventId: string, findings: readonly HsmAgentFinding[]): void {
    const idx = this.events.findIndex((item) => item.id === eventId);
    if (idx !== -1 && findings.length > 0) {
      const event = this.events[idx];
      const newEvent = Object.freeze({ ...(event as any), findings }) as unknown as HsmAgentTraceEvent;
      this.events[idx] = newEvent;
    }
  }

  public build(): HsmAgentTrace {
    return {
      agentId: this.agentId,
      seed: this.seed,
      events: Object.freeze([...this.events])
    };
  }
}
