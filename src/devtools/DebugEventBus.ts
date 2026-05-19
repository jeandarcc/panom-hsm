export type HsmDebugEventType =
  | "snapshot"
  | "transition:start"
  | "transition:success"
  | "transition:failure"
  | "navigation"
  | "policy:decision"
  | "error";

export interface HsmDebugEvent<TPayload = unknown> {
  readonly type: HsmDebugEventType;
  readonly timestamp: number;
  readonly payload: TPayload;
}

export type HsmDebugListener = (event: HsmDebugEvent) => void;

export class DebugEventBus {
  private readonly listeners = new Set<HsmDebugListener>();

  public on(listener: HsmDebugListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emit<TPayload>(type: HsmDebugEventType, payload: TPayload): HsmDebugEvent<TPayload> {
    const event: HsmDebugEvent<TPayload> = Object.freeze({ type, timestamp: Date.now(), payload });
    for (const listener of this.listeners) listener(event);
    return event;
  }

  public clear(): void {
    this.listeners.clear();
  }
}
