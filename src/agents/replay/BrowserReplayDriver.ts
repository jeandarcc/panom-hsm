import type { HsmAgentTraceEvent } from "../types.js";
import { buildInspectorOverlay } from "./ReplayInspectorOverlay.js";

export interface BrowserReplayOptions {
  readonly pauseOnFail?: boolean;
}

export class BrowserReplayDriver {
  public async replay(events: readonly HsmAgentTraceEvent[], options: BrowserReplayOptions = {}): Promise<void> {
    const playwright = await loadPlaywright();
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();

    for (const event of events) {
      if (event.url) {
        await page.goto(event.url);
      }
      const overlay = buildInspectorOverlay(event);
      if (overlay) {
        await page.evaluate(overlay);
      }
      if (options.pauseOnFail && (event.findings?.length ?? 0) > 0) {
        await page.waitForTimeout(2000);
      }
    }

    await browser.close();
  }
}

async function loadPlaywright(): Promise<any> {
  try {
    // Playwright is optional; avoid DTS/type errors when it's not installed.
    // @ts-ignore - dynamic runtime import, types may be absent in dev environments
    return await import("playwright");
  } catch {
    throw new Error("Browser replay requires playwright. Install with: npm install -D playwright");
  }
}
