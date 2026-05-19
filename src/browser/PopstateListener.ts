import type { BrowserHistoryAdapter } from "./BrowserHistoryAdapter.js";
import type { BrowserHistoryLocation, BrowserPopstateUnsubscribe } from "./types.js";

export class PopstateListener {
  private unsubscribe: BrowserPopstateUnsubscribe | null = null;

  public constructor(private readonly history: BrowserHistoryAdapter) {}

  public start(listener: (location: BrowserHistoryLocation, event: PopStateEvent) => void): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.history.listen(listener);
  }

  public stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  public get active(): boolean {
    return this.unsubscribe !== null;
  }
}
