import type { HsmMachine } from "../core/HsmMachine.js";
import type { BrowserHistoryAdapter } from "./BrowserHistoryAdapter.js";
import type { HostPolicyAdapter } from "./HostPolicyAdapter.js";
import type {
  AnyRecord,
  HsmSnapshot,
  HsmTransitionResult,
  HsmUrlTransitionOptions
} from "../core/types.js";
import type {
  NavigationTarget,
  SubdomainPolicyRuntime,
  SubdomainPolicyRuntimeDependencies
} from "@panomapp/subdomain-policy/runtime";

export interface BrowserLocationLike {
  readonly origin: string;
  readonly hostname: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
  readonly href?: string;
}

export interface BrowserHistoryLike {
  readonly state: unknown;
  pushState(data: unknown, unused: string, url?: string | URL | null): void;
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

export interface BrowserWindowLike {
  readonly location: BrowserLocationLike;
  readonly history: BrowserHistoryLike;
  addEventListener(type: "popstate", listener: (event: PopStateEvent) => void): void;
  removeEventListener(type: "popstate", listener: (event: PopStateEvent) => void): void;
  dispatchEvent?: (event: Event) => boolean;
}

export type BrowserNavigationMode = "push" | "replace" | "silent";
export type BrowserNavigationSource = "start" | "navigate" | "popstate" | "sync" | "canonical" | "redirect";

export interface BrowserHistoryLocation {
  readonly origin: string;
  readonly hostname: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
  readonly href: string;
  readonly fullPath: string;
}

export interface BrowserHistoryAdapterOptions {
  readonly window?: BrowserWindowLike;
  readonly baseOrigin?: string;
}

export interface BrowserNavigationCommit {
  readonly mode: BrowserNavigationMode;
  readonly source: BrowserNavigationSource;
  readonly url: string;
  readonly state?: unknown;
}

export type BrowserPopstateUnsubscribe = () => void;

export interface HsmBrowserRuntimeOptions<TContext extends AnyRecord = AnyRecord> {
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

export interface HsmBrowserStartOptions<TContext extends AnyRecord = AnyRecord>
  extends HsmUrlTransitionOptions<TContext> {
  readonly url?: string;
  readonly replace?: boolean;
  readonly listen?: boolean;
  readonly canonicalize?: boolean;
}

export interface HsmBrowserNavigateOptions<TContext extends AnyRecord = AnyRecord>
  extends HsmUrlTransitionOptions<TContext> {
  readonly mode?: BrowserNavigationMode;
  readonly canonicalize?: boolean;
  readonly state?: unknown;
}

export interface HsmBrowserSyncOptions {
  readonly mode?: BrowserNavigationMode;
  readonly canonicalizePath?: boolean;
  readonly state?: unknown;
}

export interface RedirectSafetyOptions {
  readonly rootHostname: string;
  readonly allowedHostnames?: Iterable<string>;
  readonly currentOrigin?: string;
  readonly currentHostname?: string;
  readonly blockedPathPrefixes?: readonly string[];
  readonly allowDevCurrentHost?: boolean;
}

export type RedirectSafetyFailureReason =
  | "empty"
  | "backslash"
  | "encoded_backslash"
  | "protocol_relative"
  | "encoded_protocol_relative"
  | "invalid_url"
  | "disallowed_protocol"
  | "external_origin"
  | "blocked_path";

export interface RedirectSafetyFailure {
  readonly ok: false;
  readonly reason: RedirectSafetyFailureReason;
  readonly input: string;
}

export interface RedirectSafetySuccess {
  readonly ok: true;
  readonly target: NavigationTarget;
  readonly url: URL;
  readonly normalized: string;
}

export type RedirectSafetyResult = RedirectSafetySuccess | RedirectSafetyFailure;

export interface CanonicalNavigationOptions {
  readonly hostname?: string;
  readonly replace?: boolean;
}

export interface HostPolicyAdapterOptions {
  readonly runtime: SubdomainPolicyRuntime;
  readonly strictRedirectSafety?: boolean;
}

export interface BrowserDebugLogger {
  info(event: string, payload: Record<string, unknown>): void;
}

export type { NavigationTarget, SubdomainPolicyRuntime, SubdomainPolicyRuntimeDependencies };
