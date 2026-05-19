import type { HsmDebugEvent } from "./DebugEventBus.js";

export interface DevtoolsTimelineOptions {
  readonly limit?: number;
}

export class DevtoolsTimeline {
  private readonly limit: number;
  private readonly eventsInternal: HsmDebugEvent[] = [];

  public constructor(options: DevtoolsTimelineOptions = {}) {
    this.limit = options.limit ?? 500;
  }

  public record(event: HsmDebugEvent): HsmDebugEvent {
    this.eventsInternal.push(event);
    while (this.eventsInternal.length > this.limit) this.eventsInternal.shift();
    return event;
  }

  public events(): readonly HsmDebugEvent[] {
    return Object.freeze([...this.eventsInternal]);
  }

  public latest(): HsmDebugEvent | undefined {
    return this.eventsInternal[this.eventsInternal.length - 1];
  }

  public clear(): void {
    this.eventsInternal.length = 0;
  }
}
