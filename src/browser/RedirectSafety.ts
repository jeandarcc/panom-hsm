import type {
  NavigationTarget,
  RedirectSafetyFailure,
  RedirectSafetyFailureReason,
  RedirectSafetyOptions,
  RedirectSafetyResult,
  RedirectSafetySuccess
} from "./types.js";

const DEFAULT_BLOCKED_PREFIXES = Object.freeze([
  "/auth",
  "/logout",
  "/maintenance",
  "/high-traffic",
  "/suspended"
]);

function fail(input: string, reason: RedirectSafetyFailureReason): RedirectSafetyFailure {
  return Object.freeze({ ok: false, input, reason });
}

function success(input: string, url: URL, target: NavigationTarget): RedirectSafetySuccess {
  return Object.freeze({
    ok: true,
    target,
    url,
    normalized: target.to
  });
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function hasEncodedBackslash(value: string): boolean {
  return /%5c/i.test(value) || /%5C/.test(value);
}

function hasEncodedProtocolRelative(value: string): boolean {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    const decoded = safeDecode(current);
    if (!decoded || decoded === current) break;
    current = decoded;
    const compact = current.trimStart();
    if (compact.startsWith("//") || compact.startsWith("/\\")) return true;
  }
  return false;
}

function isBlockedPath(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function normalizeOrigin(origin: string | undefined): string {
  try {
    return new URL(origin ?? "http://localhost").origin;
  } catch {
    return "http://localhost";
  }
}

function allowedHostnames(options: RedirectSafetyOptions): Set<string> {
  const allowed = new Set<string>([options.rootHostname]);
  for (const hostname of options.allowedHostnames ?? []) allowed.add(hostname);
  if (options.allowDevCurrentHost && options.currentHostname) allowed.add(options.currentHostname);
  return allowed;
}

/**
 * Strict redirect validator for post-auth and canonical navigation targets.
 *
 * The upstream subdomain-policy package intentionally stays generic. HSM applies a
 * stricter product-safe layer here to reject protocol-relative URLs, backslash
 * bypasses, encoded protocol-relative bypasses, unsupported protocols and external
 * hostnames before the value can be committed or consumed.
 */
export class RedirectSafety {
  public constructor(private readonly options: RedirectSafetyOptions) {}

  public validate(raw: unknown): RedirectSafetyResult {
    if (typeof raw !== "string") return fail("", "empty");
    const input = raw.trim();
    if (!input) return fail(raw, "empty");
    if (input.includes("\\")) return fail(input, "backslash");
    if (hasEncodedBackslash(input)) return fail(input, "encoded_backslash");
    if (input.startsWith("//")) return fail(input, "protocol_relative");
    if (hasEncodedProtocolRelative(input)) return fail(input, "encoded_protocol_relative");

    const currentOrigin = normalizeOrigin(this.options.currentOrigin);
    const blockedPathPrefixes = this.options.blockedPathPrefixes ?? DEFAULT_BLOCKED_PREFIXES;

    let url: URL;
    try {
      url = new URL(input, currentOrigin);
    } catch {
      return fail(input, "invalid_url");
    }

    if (!['http:', 'https:'].includes(url.protocol)) return fail(input, "disallowed_protocol");
    if (url.pathname.includes("\\")) return fail(input, "backslash");
    if (isBlockedPath(url.pathname, blockedPathPrefixes)) return fail(input, "blocked_path");

    const hostnames = allowedHostnames(this.options);
    if (url.origin !== currentOrigin && !hostnames.has(url.hostname)) {
      return fail(input, "external_origin");
    }

    const internalPath = `${url.pathname}${url.search}${url.hash}`;
    const target: NavigationTarget = url.origin === currentOrigin
      ? { type: "internal", to: internalPath }
      : { type: "external", to: url.toString() };
    return success(input, url, target);
  }

  public assert(raw: unknown): RedirectSafetySuccess {
    const result = this.validate(raw);
    if (!result.ok) {
      throw new Error(`Unsafe redirect target rejected: ${result.reason}`);
    }
    return result;
  }

  public isSafe(raw: unknown): boolean {
    return this.validate(raw).ok;
  }
}

export function createRedirectSafety(options: RedirectSafetyOptions): RedirectSafety {
  return new RedirectSafety(options);
}
