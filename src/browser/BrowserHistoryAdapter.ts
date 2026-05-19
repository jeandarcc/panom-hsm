import type {
  BrowserHistoryAdapterOptions,
  BrowserHistoryLocation,
  BrowserNavigationCommit,
  BrowserNavigationMode,
  BrowserNavigationSource,
  BrowserPopstateUnsubscribe,
  BrowserWindowLike
} from "./types.js";

function resolveGlobalWindow(): BrowserWindowLike | undefined {
  const value = globalThis as typeof globalThis & { window?: BrowserWindowLike };
  return value.window;
}

function normalizeBaseOrigin(origin: string | undefined): string {
  if (!origin) return "http://localhost";
  try {
    return new URL(origin).origin;
  } catch {
    return "http://localhost";
  }
}

function normalizeHash(hash: string): string {
  if (!hash) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
}

function normalizeSearch(search: string): string {
  if (!search) return "";
  return search.startsWith("?") ? search : `?${search}`;
}

function toLocation(url: URL): BrowserHistoryLocation {
  return Object.freeze({
    origin: url.origin,
    hostname: url.hostname,
    pathname: url.pathname || "/",
    search: url.search,
    hash: url.hash,
    href: url.href,
    fullPath: `${url.pathname || "/"}${url.search}${url.hash}`
  });
}

/**
 * Minimal browser-history abstraction used by the HSM browser runtime.
 *
 * It intentionally models only the primitives HSM needs: current URL, push/replace
 * commits, and popstate subscription. Tests can inject a tiny in-memory window-like
 * object without a DOM implementation.
 */
export class BrowserHistoryAdapter {
  private readonly windowLike: BrowserWindowLike | undefined;
  private readonly baseOrigin: string;
  private memoryLocation: BrowserHistoryLocation;

  public constructor(options: BrowserHistoryAdapterOptions = {}) {
    this.windowLike = options.window ?? resolveGlobalWindow();
    this.baseOrigin = normalizeBaseOrigin(options.baseOrigin ?? this.windowLike?.location.origin);

    if (this.windowLike) {
      this.memoryLocation = this.readFromWindow();
    } else {
      this.memoryLocation = toLocation(new URL("/", this.baseOrigin));
    }
  }

  public current(): BrowserHistoryLocation {
    return this.windowLike ? this.readFromWindow() : this.memoryLocation;
  }

  public commit(commit: BrowserNavigationCommit): BrowserHistoryLocation {
    if (commit.mode === "silent") return this.current();

    const resolved = this.resolve(commit.url);
    if (this.windowLike) {
      if (commit.mode === "replace") {
        this.windowLike.history.replaceState(commit.state ?? null, "", resolved.fullPath);
      } else {
        this.windowLike.history.pushState(commit.state ?? null, "", resolved.fullPath);
      }
      return this.readFromWindow();
    }

    this.memoryLocation = resolved;
    return this.memoryLocation;
  }

  public push(url: string, source: BrowserNavigationSource = "navigate", state?: unknown): BrowserHistoryLocation {
    return this.commit({ mode: "push", source, url, state });
  }

  public replace(url: string, source: BrowserNavigationSource = "sync", state?: unknown): BrowserHistoryLocation {
    return this.commit({ mode: "replace", source, url, state });
  }

  public listen(listener: (location: BrowserHistoryLocation, event: PopStateEvent) => void): BrowserPopstateUnsubscribe {
    if (!this.windowLike) return () => undefined;

    const handler = (event: PopStateEvent) => listener(this.current(), event);
    this.windowLike.addEventListener("popstate", handler);
    return () => this.windowLike?.removeEventListener("popstate", handler);
  }

  public resolve(input: string | URL): BrowserHistoryLocation {
    const base = this.current().href || `${this.baseOrigin}/`;
    const url = input instanceof URL ? input : new URL(input, base);
    return toLocation(url);
  }

  public toFullPath(input: string | URL): string {
    return this.resolve(input).fullPath;
  }

  public modeOrDefault(mode: BrowserNavigationMode | undefined, fallback: BrowserNavigationMode): BrowserNavigationMode {
    return mode ?? fallback;
  }

  private readFromWindow(): BrowserHistoryLocation {
    const location = this.windowLike?.location;
    if (!location) return this.memoryLocation;

    const url = new URL(
      `${location.pathname || "/"}${normalizeSearch(location.search)}${normalizeHash(location.hash)}`,
      location.origin || this.baseOrigin
    );
    return toLocation(url);
  }
}
