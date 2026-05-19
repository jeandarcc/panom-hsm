import type { BrowserHistoryAdapter } from "./BrowserHistoryAdapter.js";
import type { BrowserNavigationMode, BrowserNavigationSource } from "./types.js";

export interface UrlSyncCommitOptions {
  readonly mode?: BrowserNavigationMode;
  readonly source?: BrowserNavigationSource;
  readonly state?: unknown;
}

/**
 * Prevents re-entrant URL writes during browser popstate handling and skips no-op
 * history commits. Browser adapters can use this without knowing anything about HSM.
 */
export class UrlSyncController {
  private locked = false;

  public constructor(private readonly history: BrowserHistoryAdapter) {}

  public get isLocked(): boolean {
    return this.locked;
  }

  public withLock<T>(fn: () => T): T {
    const previous = this.locked;
    this.locked = true;
    try {
      return fn();
    } finally {
      this.locked = previous;
    }
  }

  public async withAsyncLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.locked;
    this.locked = true;
    try {
      return await fn();
    } finally {
      this.locked = previous;
    }
  }

  public commit(url: string, options: UrlSyncCommitOptions = {}): boolean {
    if (this.locked) return false;
    const mode = options.mode ?? "replace";
    if (mode === "silent") return false;

    const current = this.history.current().fullPath;
    const target = this.history.resolve(url).fullPath;
    if (current === target) return false;

    this.history.commit({
      mode,
      source: options.source ?? "sync",
      url: target,
      state: options.state
    });
    return true;
  }
}
