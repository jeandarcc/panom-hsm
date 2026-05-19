import { a0 as HsmSnapshot, a as AnyRecord, v as HsmMachine, ac as HsmTransitionResult, ai as HsmUrlTransitionOptions } from '../HsmMachine-CnF_DNIZ.js';
import * as _panomapp_subdomain_policy from '@panomapp/subdomain-policy';
import { SubdomainPolicyRuntime, SubdomainPolicyRuntimeDependencies, NavigationTarget } from '@panomapp/subdomain-policy/runtime';
export { NavigationTarget, SubdomainPolicyRuntime, SubdomainPolicyRuntimeDependencies } from '@panomapp/subdomain-policy/runtime';

/**
 * Strict redirect validator for post-auth and canonical navigation targets.
 *
 * The upstream subdomain-policy package intentionally stays generic. HSM applies a
 * stricter product-safe layer here to reject protocol-relative URLs, backslash
 * bypasses, encoded protocol-relative bypasses, unsupported protocols and external
 * hostnames before the value can be committed or consumed.
 */
declare class RedirectSafety {
    private readonly options;
    constructor(options: RedirectSafetyOptions);
    validate(raw: unknown): RedirectSafetyResult;
    assert(raw: unknown): RedirectSafetySuccess;
    isSafe(raw: unknown): boolean;
}
declare function createRedirectSafety(options: RedirectSafetyOptions): RedirectSafety;

/**
 * Bridge between panom-hsm snapshots and @panomapp/subdomain-policy.
 */
declare class HostPolicyAdapter {
    readonly runtime: SubdomainPolicyRuntime;
    private readonly strictRedirectSafety;
    constructor(options: HostPolicyAdapterOptions | SubdomainPolicyRuntime | SubdomainPolicyRuntimeDependencies);
    get allowedHostnames(): readonly string[];
    getPolicyForHostname(hostname: string): _panomapp_subdomain_policy.SubdomainRoutePolicy | null;
    getPolicyForState(stateId: string): _panomapp_subdomain_policy.SubdomainRoutePolicy | null;
    isStateHandledBySubdomain(stateId: string, subdomain: string): boolean;
    getPolicyLandingUrl(subdomain: string): string;
    getPolicyLandingUrlForState(stateId: string): string;
    buildAbsoluteUrlForState(stateId: string, path?: string): string;
    getSocketServerOrigin(stateId?: string): string;
    getAuthEntryUrl(): string;
    getCanonicalTarget(hostname: string, snapshot: HsmSnapshot): NavigationTarget | null;
    rememberPostAuthRedirect(target: string, currentOrigin?: string, currentHostname?: string): RedirectSafetyResult;
    peekSafePostAuthRedirect(currentOrigin?: string, currentHostname?: string): NavigationTarget | null;
    consumeSafePostAuthRedirect(currentOrigin?: string, currentHostname?: string): NavigationTarget | null;
    isDebugEnabled(): boolean;
    debug(event: string, payload: Record<string, unknown>): void;
    redirectSafety(currentOrigin?: string, currentHostname?: string): RedirectSafety;
}
declare function createHostPolicyAdapter(options: HostPolicyAdapterOptions | SubdomainPolicyRuntime | SubdomainPolicyRuntimeDependencies): HostPolicyAdapter;

interface BrowserLocationLike {
    readonly origin: string;
    readonly hostname: string;
    readonly pathname: string;
    readonly search: string;
    readonly hash: string;
    readonly href?: string;
}
interface BrowserHistoryLike {
    readonly state: unknown;
    pushState(data: unknown, unused: string, url?: string | URL | null): void;
    replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}
interface BrowserWindowLike {
    readonly location: BrowserLocationLike;
    readonly history: BrowserHistoryLike;
    addEventListener(type: "popstate", listener: (event: PopStateEvent) => void): void;
    removeEventListener(type: "popstate", listener: (event: PopStateEvent) => void): void;
    dispatchEvent?: (event: Event) => boolean;
}
type BrowserNavigationMode = "push" | "replace" | "silent";
type BrowserNavigationSource = "start" | "navigate" | "popstate" | "sync" | "canonical" | "redirect";
interface BrowserHistoryLocation {
    readonly origin: string;
    readonly hostname: string;
    readonly pathname: string;
    readonly search: string;
    readonly hash: string;
    readonly href: string;
    readonly fullPath: string;
}
interface BrowserHistoryAdapterOptions {
    readonly window?: BrowserWindowLike;
    readonly baseOrigin?: string;
}
interface BrowserNavigationCommit {
    readonly mode: BrowserNavigationMode;
    readonly source: BrowserNavigationSource;
    readonly url: string;
    readonly state?: unknown;
}
type BrowserPopstateUnsubscribe = () => void;
interface HsmBrowserRuntimeOptions<TContext extends AnyRecord = AnyRecord> {
    readonly hsm: HsmMachine<TContext>;
    readonly history?: BrowserHistoryAdapter;
    readonly window?: BrowserWindowLike;
    readonly hostPolicy?: HostPolicyAdapter | SubdomainPolicyRuntime | SubdomainPolicyRuntimeDependencies;
    readonly autoCanonicalize?: boolean;
    readonly preserveUnknownQuery?: boolean;
    readonly canonicalizeAliases?: boolean;
    readonly strictRedirectSafety?: boolean;
    readonly onTransition?: (result: HsmTransitionResult<TContext>) => void;
    readonly onCanonicalTarget?: (target: NavigationTarget, snapshot: HsmSnapshot<TContext>) => void;
    readonly onError?: (error: unknown) => void;
}
interface HsmBrowserStartOptions<TContext extends AnyRecord = AnyRecord> extends HsmUrlTransitionOptions<TContext> {
    readonly url?: string;
    readonly replace?: boolean;
    readonly listen?: boolean;
    readonly canonicalize?: boolean;
}
interface HsmBrowserNavigateOptions<TContext extends AnyRecord = AnyRecord> extends HsmUrlTransitionOptions<TContext> {
    readonly mode?: BrowserNavigationMode;
    readonly canonicalize?: boolean;
    readonly state?: unknown;
}
interface HsmBrowserSyncOptions {
    readonly mode?: BrowserNavigationMode;
    readonly canonicalizePath?: boolean;
    readonly state?: unknown;
}
interface RedirectSafetyOptions {
    readonly rootHostname: string;
    readonly allowedHostnames?: Iterable<string>;
    readonly currentOrigin?: string;
    readonly currentHostname?: string;
    readonly blockedPathPrefixes?: readonly string[];
    readonly allowDevCurrentHost?: boolean;
}
type RedirectSafetyFailureReason = "empty" | "backslash" | "encoded_backslash" | "protocol_relative" | "encoded_protocol_relative" | "invalid_url" | "disallowed_protocol" | "external_origin" | "blocked_path";
interface RedirectSafetyFailure {
    readonly ok: false;
    readonly reason: RedirectSafetyFailureReason;
    readonly input: string;
}
interface RedirectSafetySuccess {
    readonly ok: true;
    readonly target: NavigationTarget;
    readonly url: URL;
    readonly normalized: string;
}
type RedirectSafetyResult = RedirectSafetySuccess | RedirectSafetyFailure;
interface CanonicalNavigationOptions {
    readonly hostname?: string;
    readonly replace?: boolean;
}
interface HostPolicyAdapterOptions {
    readonly runtime: SubdomainPolicyRuntime;
    readonly strictRedirectSafety?: boolean;
}
interface BrowserDebugLogger {
    info(event: string, payload: Record<string, unknown>): void;
}

/**
 * Minimal browser-history abstraction used by the HSM browser runtime.
 *
 * It intentionally models only the primitives HSM needs: current URL, push/replace
 * commits, and popstate subscription. Tests can inject a tiny in-memory window-like
 * object without a DOM implementation.
 */
declare class BrowserHistoryAdapter {
    private readonly windowLike;
    private readonly baseOrigin;
    private memoryLocation;
    constructor(options?: BrowserHistoryAdapterOptions);
    current(): BrowserHistoryLocation;
    commit(commit: BrowserNavigationCommit): BrowserHistoryLocation;
    push(url: string, source?: BrowserNavigationSource, state?: unknown): BrowserHistoryLocation;
    replace(url: string, source?: BrowserNavigationSource, state?: unknown): BrowserHistoryLocation;
    listen(listener: (location: BrowserHistoryLocation, event: PopStateEvent) => void): BrowserPopstateUnsubscribe;
    resolve(input: string | URL): BrowserHistoryLocation;
    toFullPath(input: string | URL): string;
    modeOrDefault(mode: BrowserNavigationMode | undefined, fallback: BrowserNavigationMode): BrowserNavigationMode;
    private readFromWindow;
}

/**
 * Browser runtime that connects HsmMachine to history.pushState/popstate and optional
 * @panomapp/subdomain-policy canonical host decisions.
 */
declare class BrowserUrlRuntime<TContext extends AnyRecord = AnyRecord> {
    readonly hsm: HsmMachine<TContext>;
    readonly history: BrowserHistoryAdapter;
    readonly hostPolicy: HostPolicyAdapter | null;
    private readonly popstate;
    private readonly syncController;
    private readonly canonical;
    private readonly autoCanonicalize;
    private readonly preserveUnknownQuery;
    private readonly canonicalizeAliases;
    private readonly onTransition;
    private readonly onCanonicalTarget;
    private readonly onError;
    constructor(options: HsmBrowserRuntimeOptions<TContext>);
    get current(): HsmSnapshot<TContext> | null;
    start(options?: HsmBrowserStartOptions<TContext>): Promise<HsmSnapshot<TContext>>;
    stop(): void;
    listen(): void;
    navigate(stateIdOrUrl: string, params?: AnyRecord, options?: HsmBrowserNavigateOptions<TContext>): Promise<HsmTransitionResult<TContext>>;
    sync(snapshot?: HsmSnapshot<TContext>, options?: HsmBrowserSyncOptions): boolean;
    getCanonicalTarget(snapshot?: HsmSnapshot<TContext>): NavigationTarget | null;
    applyCanonical(snapshot?: HsmSnapshot<TContext>): NavigationTarget | null;
    rememberPostAuthRedirect(target: string): RedirectSafetyResult | null;
    peekSafePostAuthRedirect(): NavigationTarget | null;
    consumeSafePostAuthRedirect(): NavigationTarget | null;
    getSocketServerOrigin(stateId?: string): string | null;
    getAuthEntryUrl(): string | null;
    private requireCurrent;
    private snapshotFullPath;
    private emitTransition;
}
declare function createHsmBrowserRuntime<TContext extends AnyRecord = AnyRecord>(options: HsmBrowserRuntimeOptions<TContext>): BrowserUrlRuntime<TContext>;

/** Applies host-aware canonical navigation decisions returned by subdomain-policy. */
declare class CanonicalNavigation {
    private readonly hostPolicy;
    private readonly history;
    constructor(hostPolicy: HostPolicyAdapter | null, history: BrowserHistoryAdapter);
    targetFor(snapshot: HsmSnapshot, options?: CanonicalNavigationOptions): NavigationTarget | null;
    apply(snapshot: HsmSnapshot, options?: CanonicalNavigationOptions): NavigationTarget | null;
}

declare class PopstateListener {
    private readonly history;
    private unsubscribe;
    constructor(history: BrowserHistoryAdapter);
    start(listener: (location: BrowserHistoryLocation, event: PopStateEvent) => void): void;
    stop(): void;
    get active(): boolean;
}

interface UrlSyncCommitOptions {
    readonly mode?: BrowserNavigationMode;
    readonly source?: BrowserNavigationSource;
    readonly state?: unknown;
}
/**
 * Prevents re-entrant URL writes during browser popstate handling and skips no-op
 * history commits. Browser adapters can use this without knowing anything about HSM.
 */
declare class UrlSyncController {
    private readonly history;
    private locked;
    constructor(history: BrowserHistoryAdapter);
    get isLocked(): boolean;
    withLock<T>(fn: () => T): T;
    withAsyncLock<T>(fn: () => Promise<T>): Promise<T>;
    commit(url: string, options?: UrlSyncCommitOptions): boolean;
}

export { type BrowserDebugLogger, BrowserHistoryAdapter, type BrowserHistoryAdapterOptions, type BrowserHistoryLike, type BrowserHistoryLocation, type BrowserLocationLike, type BrowserNavigationCommit, type BrowserNavigationMode, type BrowserNavigationSource, type BrowserPopstateUnsubscribe, BrowserUrlRuntime, type BrowserWindowLike, CanonicalNavigation, type CanonicalNavigationOptions, HostPolicyAdapter, type HostPolicyAdapterOptions, type HsmBrowserNavigateOptions, type HsmBrowserRuntimeOptions, type HsmBrowserStartOptions, type HsmBrowserSyncOptions, PopstateListener, RedirectSafety, type RedirectSafetyFailure, type RedirectSafetyFailureReason, type RedirectSafetyOptions, type RedirectSafetyResult, type RedirectSafetySuccess, UrlSyncController, createHostPolicyAdapter, createHsmBrowserRuntime, createRedirectSafety };
