import type { HsmAgentFinding, HsmAgentTrace, HsmAgentTraceEvent } from "./types.js";

export class HsmAgentTraceBuilder {
  private readonly events: HsmAgentTraceEvent[] = [];

  public constructor(private readonly agentId: string, private readonly seed: string) {}

  public record(event: HsmAgentTraceEvent): void {
    this.events.push(event);
  }

  public attachFindings(eventId: string, findings: readonly HsmAgentFinding[]): void {
    const event = this.events.find((item) => item.id === eventId);
    if (event && findings.length > 0) {
      (event as HsmAgentTraceEvent).findings = findings;
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
