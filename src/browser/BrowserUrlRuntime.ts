import type { HsmMachine } from "../core/HsmMachine.js";
import type { AnyRecord, HsmSnapshot, HsmTransitionResult } from "../core/types.js";
import type {
  HsmBrowserNavigateOptions,
  HsmBrowserRuntimeOptions,
  HsmBrowserStartOptions,
  HsmBrowserSyncOptions,
  NavigationTarget
} from "./types.js";
import { BrowserHistoryAdapter } from "./BrowserHistoryAdapter.js";
import { CanonicalNavigation } from "./CanonicalNavigation.js";
import { HostPolicyAdapter, createHostPolicyAdapter } from "./HostPolicyAdapter.js";
import { PopstateListener } from "./PopstateListener.js";
import { UrlSyncController } from "./UrlSyncController.js";

function normalizeHostPolicy(
  options: HsmBrowserRuntimeOptions
): HostPolicyAdapter | null {
  if (!options.hostPolicy) return null;
  if (options.hostPolicy instanceof HostPolicyAdapter) return options.hostPolicy;
  return createHostPolicyAdapter(options.hostPolicy);
}

function targetToUrl(target: NavigationTarget): string {
  return target.to;
}

/**
 * Browser runtime that connects HsmMachine to history.pushState/popstate and optional
 * @panomapp/subdomain-policy canonical host decisions.
 */
export class BrowserUrlRuntime<TContext extends AnyRecord = AnyRecord> {
  public readonly hsm: HsmMachine<TContext>;
  public readonly history: BrowserHistoryAdapter;
  public readonly hostPolicy: HostPolicyAdapter | null;

  private readonly popstate: PopstateListener;
  private readonly syncController: UrlSyncController;
  private readonly canonical: CanonicalNavigation;
  private readonly autoCanonicalize: boolean;
  private readonly preserveUnknownQuery: boolean;
  private readonly canonicalizeAliases: boolean;
  private readonly onTransition: ((result: HsmTransitionResult<TContext>) => void) | undefined;
  private readonly onCanonicalTarget: ((target: NavigationTarget, snapshot: HsmSnapshot<TContext>) => void) | undefined;
  private readonly onError: ((error: unknown) => void) | undefined;

  public constructor(options: HsmBrowserRuntimeOptions<TContext>) {
    this.hsm = options.hsm;
    this.history = options.history ?? new BrowserHistoryAdapter(options.window ? { window: options.window } : {});
    this.hostPolicy = normalizeHostPolicy(options as HsmBrowserRuntimeOptions);
    this.popstate = new PopstateListener(this.history);
    this.syncController = new UrlSyncController(this.history);
    this.canonical = new CanonicalNavigation(this.hostPolicy, this.history);
    this.autoCanonicalize = options.autoCanonicalize ?? true;
    this.preserveUnknownQuery = options.preserveUnknownQuery ?? true;
    this.canonicalizeAliases = options.canonicalizeAliases ?? true;
    this.onTransition = options.onTransition;
    this.onCanonicalTarget = options.onCanonicalTarget;
    this.onError = options.onError;
  }

  public get current(): HsmSnapshot<TContext> | null {
    return this.hsm.current;
  }

  public async start(options: HsmBrowserStartOptions<TContext> = {}): Promise<HsmSnapshot<TContext>> {
    const url = options.url ?? this.history.current().fullPath;
    const result = await this.hsm.transitionUrl(url, {
      ...options,
      cause: "url",
      preserveUnknownQuery: options.preserveUnknownQuery ?? this.preserveUnknownQuery,
      canonicalizeAliases: options.canonicalizeAliases ?? this.canonicalizeAliases,
      strict: false
    });

    this.emitTransition(result);
    if (!result.ok) throw result.error;

    if (options.replace ?? true) {
      this.sync(result.snapshot, { mode: "replace", canonicalizePath: true });
    }

    if (options.listen ?? true) this.listen();
    if (options.canonicalize ?? this.autoCanonicalize) this.applyCanonical(result.snapshot);
    return result.snapshot;
  }

  public stop(): void {
    this.popstate.stop();
  }

  public listen(): void {
    this.popstate.start((location) => {
      void this.syncController.withAsyncLock(async () => {
        try {
          const result = await this.hsm.transitionUrl(location.fullPath, {
            preserveUnknownQuery: this.preserveUnknownQuery,
            canonicalizeAliases: this.canonicalizeAliases,
            cause: "url"
          });
          this.emitTransition(result);
          if (result.ok && this.autoCanonicalize) this.applyCanonical(result.snapshot);
        } catch (error) {
          this.onError?.(error);
        }
      });
    });
  }

  public async navigate(
    stateIdOrUrl: string,
    params: AnyRecord = {},
    options: HsmBrowserNavigateOptions<TContext> = {}
  ): Promise<HsmTransitionResult<TContext>> {
    let input = stateIdOrUrl;
    if (this.hsm.has(stateIdOrUrl)) {
      const hrefOptions: import("../core/types.js").HsmHrefOptions<TContext> = {};
      if (options.context !== undefined) Object.assign(hrefOptions, { context: options.context, includeQueryState: true });
      input = this.hsm.href(stateIdOrUrl, params, hrefOptions);
    }

    const result = await this.hsm.transitionUrl(input, {
      ...options,
      cause: "url",
      preserveUnknownQuery: options.preserveUnknownQuery ?? this.preserveUnknownQuery,
      canonicalizeAliases: options.canonicalizeAliases ?? this.canonicalizeAliases,
      strict: false
    });

    this.emitTransition(result);
    if (result.ok) {
      this.history.commit({
        mode: options.mode ?? "push",
        source: "navigate",
        url: this.snapshotFullPath(result.snapshot),
        state: options.state
      });
      if (options.canonicalize ?? this.autoCanonicalize) this.applyCanonical(result.snapshot);
    }
    return result;
  }

  public sync(snapshot: HsmSnapshot<TContext> = this.requireCurrent(), options: HsmBrowserSyncOptions = {}): boolean {
    const url = this.snapshotFullPath(snapshot, options.canonicalizePath ?? true);
    return this.syncController.commit(url, {
      mode: options.mode ?? "replace",
      source: "sync",
      state: options.state
    });
  }

  public getCanonicalTarget(snapshot: HsmSnapshot<TContext> = this.requireCurrent()): NavigationTarget | null {
    return this.canonical.targetFor(snapshot);
  }

  public applyCanonical(snapshot: HsmSnapshot<TContext> = this.requireCurrent()): NavigationTarget | null {
    const target = this.canonical.targetFor(snapshot);
    if (!target) return null;
    this.onCanonicalTarget?.(target, snapshot);

    if (target.type === "internal") {
      this.syncController.commit(targetToUrl(target), { mode: "replace", source: "canonical" });
    }
    return target;
  }

  public rememberPostAuthRedirect(target: string) {
    return this.hostPolicy?.rememberPostAuthRedirect(
      target,
      this.history.current().origin,
      this.history.current().hostname
    ) ?? null;
  }

  public peekSafePostAuthRedirect(): NavigationTarget | null {
    return this.hostPolicy?.peekSafePostAuthRedirect(
      this.history.current().origin,
      this.history.current().hostname
    ) ?? null;
  }

  public consumeSafePostAuthRedirect(): NavigationTarget | null {
    return this.hostPolicy?.consumeSafePostAuthRedirect(
      this.history.current().origin,
      this.history.current().hostname
    ) ?? null;
  }

  public getSocketServerOrigin(stateId?: string): string | null {
    return this.hostPolicy?.getSocketServerOrigin(stateId ?? this.current?.stateId) ?? null;
  }

  public getAuthEntryUrl(): string | null {
    return this.hostPolicy?.getAuthEntryUrl() ?? null;
  }

  private requireCurrent(): HsmSnapshot<TContext> {
    if (!this.hsm.current) throw new Error("HSM browser runtime has no current snapshot. Call start() first.");
    return this.hsm.current;
  }

  private snapshotFullPath(snapshot: HsmSnapshot<TContext>, canonicalPath = true): string {
    if (!snapshot.route) return this.history.current().fullPath;
    const pathname = canonicalPath
      ? snapshot.route.canonicalPathname || snapshot.route.pathname
      : snapshot.route.pathname;
    const query = snapshot.urlState?.projected ?? snapshot.route.query ?? {};
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) search.append(key, String(item));
      } else {
        search.set(key, String(value));
      }
    }
    const serialized = search.toString();
    const hash = snapshot.route.hash ? `#${snapshot.route.hash}` : "";
    return `${pathname}${serialized ? `?${serialized}` : ""}${hash}`;
  }

  private emitTransition(result: HsmTransitionResult<TContext>): void {
    this.onTransition?.(result);
    if (!result.ok) this.onError?.(result.error);
  }
}

export function createHsmBrowserRuntime<TContext extends AnyRecord = AnyRecord>(
  options: HsmBrowserRuntimeOptions<TContext>
): BrowserUrlRuntime<TContext> {
  return new BrowserUrlRuntime(options);
}
