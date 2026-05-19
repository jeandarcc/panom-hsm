'use strict';

var runtime = require('@panomapp/subdomain-policy/runtime');

// src/browser/BrowserHistoryAdapter.ts
function resolveGlobalWindow() {
  const value = globalThis;
  return value.window;
}
function normalizeBaseOrigin(origin) {
  if (!origin) return "http://localhost";
  try {
    return new URL(origin).origin;
  } catch {
    return "http://localhost";
  }
}
function normalizeHash(hash) {
  if (!hash) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
}
function normalizeSearch(search) {
  if (!search) return "";
  return search.startsWith("?") ? search : `?${search}`;
}
function toLocation(url) {
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
var BrowserHistoryAdapter = class {
  windowLike;
  baseOrigin;
  memoryLocation;
  constructor(options = {}) {
    this.windowLike = options.window ?? resolveGlobalWindow();
    this.baseOrigin = normalizeBaseOrigin(options.baseOrigin ?? this.windowLike?.location.origin);
    if (this.windowLike) {
      this.memoryLocation = this.readFromWindow();
    } else {
      this.memoryLocation = toLocation(new URL("/", this.baseOrigin));
    }
  }
  current() {
    return this.windowLike ? this.readFromWindow() : this.memoryLocation;
  }
  commit(commit) {
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
  push(url, source = "navigate", state) {
    return this.commit({ mode: "push", source, url, state });
  }
  replace(url, source = "sync", state) {
    return this.commit({ mode: "replace", source, url, state });
  }
  listen(listener) {
    if (!this.windowLike) return () => void 0;
    const handler = (event) => listener(this.current(), event);
    this.windowLike.addEventListener("popstate", handler);
    return () => this.windowLike?.removeEventListener("popstate", handler);
  }
  resolve(input) {
    const base = this.current().href || `${this.baseOrigin}/`;
    const url = input instanceof URL ? input : new URL(input, base);
    return toLocation(url);
  }
  toFullPath(input) {
    return this.resolve(input).fullPath;
  }
  modeOrDefault(mode, fallback) {
    return mode ?? fallback;
  }
  readFromWindow() {
    const location = this.windowLike?.location;
    if (!location) return this.memoryLocation;
    const url = new URL(
      `${location.pathname || "/"}${normalizeSearch(location.search)}${normalizeHash(location.hash)}`,
      location.origin || this.baseOrigin
    );
    return toLocation(url);
  }
};

// src/browser/CanonicalNavigation.ts
var CanonicalNavigation = class {
  constructor(hostPolicy, history) {
    this.hostPolicy = hostPolicy;
    this.history = history;
  }
  hostPolicy;
  history;
  targetFor(snapshot, options = {}) {
    if (!this.hostPolicy) return null;
    const hostname = options.hostname ?? this.history.current().hostname;
    return this.hostPolicy.getCanonicalTarget(hostname, snapshot);
  }
  apply(snapshot, options = {}) {
    const target = this.targetFor(snapshot, options);
    if (!target) return null;
    if (target.type === "internal") {
      this.history.commit({
        mode: options.replace ?? true ? "replace" : "push",
        source: "canonical",
        url: target.to
      });
    }
    return target;
  }
};

// src/browser/RedirectSafety.ts
var DEFAULT_BLOCKED_PREFIXES = Object.freeze([
  "/auth",
  "/logout",
  "/maintenance",
  "/high-traffic",
  "/suspended"
]);
function fail(input, reason) {
  return Object.freeze({ ok: false, input, reason });
}
function success(input, url, target) {
  return Object.freeze({
    ok: true,
    target,
    url,
    normalized: target.to
  });
}
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
function hasEncodedBackslash(value) {
  return /%5c/i.test(value) || /%5C/.test(value);
}
function hasEncodedProtocolRelative(value) {
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
function isBlockedPath(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
function normalizeOrigin(origin) {
  try {
    return new URL(origin ?? "http://localhost").origin;
  } catch {
    return "http://localhost";
  }
}
function allowedHostnames(options) {
  const allowed = /* @__PURE__ */ new Set([options.rootHostname]);
  for (const hostname of options.allowedHostnames ?? []) allowed.add(hostname);
  if (options.allowDevCurrentHost && options.currentHostname) allowed.add(options.currentHostname);
  return allowed;
}
var RedirectSafety = class {
  constructor(options) {
    this.options = options;
  }
  options;
  validate(raw) {
    if (typeof raw !== "string") return fail("", "empty");
    const input = raw.trim();
    if (!input) return fail(raw, "empty");
    if (input.includes("\\")) return fail(input, "backslash");
    if (hasEncodedBackslash(input)) return fail(input, "encoded_backslash");
    if (input.startsWith("//")) return fail(input, "protocol_relative");
    if (hasEncodedProtocolRelative(input)) return fail(input, "encoded_protocol_relative");
    const currentOrigin = normalizeOrigin(this.options.currentOrigin);
    const blockedPathPrefixes = this.options.blockedPathPrefixes ?? DEFAULT_BLOCKED_PREFIXES;
    let url;
    try {
      url = new URL(input, currentOrigin);
    } catch {
      return fail(input, "invalid_url");
    }
    if (!["http:", "https:"].includes(url.protocol)) return fail(input, "disallowed_protocol");
    if (url.pathname.includes("\\")) return fail(input, "backslash");
    if (isBlockedPath(url.pathname, blockedPathPrefixes)) return fail(input, "blocked_path");
    const hostnames = allowedHostnames(this.options);
    if (url.origin !== currentOrigin && !hostnames.has(url.hostname)) {
      return fail(input, "external_origin");
    }
    const internalPath = `${url.pathname}${url.search}${url.hash}`;
    const target = url.origin === currentOrigin ? { type: "internal", to: internalPath } : { type: "external", to: url.toString() };
    return success(input, url, target);
  }
  assert(raw) {
    const result = this.validate(raw);
    if (!result.ok) {
      throw new Error(`Unsafe redirect target rejected: ${result.reason}`);
    }
    return result;
  }
  isSafe(raw) {
    return this.validate(raw).ok;
  }
};
function createRedirectSafety(options) {
  return new RedirectSafety(options);
}

// src/browser/HostPolicyAdapter.ts
function isRuntime(value) {
  return Boolean(value && typeof value === "object" && "getCanonicalNavigationTarget" in value && "registry" in value);
}
function snapshotFullPath(snapshot) {
  const route = snapshot.route;
  if (!route) return "/";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(route.query ?? {})) {
    if (value === void 0 || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
    } else {
      query.set(key, String(value));
    }
  }
  const search = query.toString();
  const hash = route.hash ? `#${route.hash}` : "";
  return `${route.canonicalPathname || route.pathname}${search ? `?${search}` : ""}${hash}`;
}
function configuredHostnames(runtime) {
  return Object.freeze([
    runtime.rootHostname,
    ...runtime.registry.all().map((policy) => `${policy.subdomain}.${runtime.rootHostname}`)
  ]);
}
var HostPolicyAdapter = class {
  runtime;
  strictRedirectSafety;
  constructor(options) {
    if ("runtime" in options) {
      this.runtime = options.runtime;
      this.strictRedirectSafety = options.strictRedirectSafety ?? true;
    } else {
      this.runtime = isRuntime(options) ? options : runtime.createSubdomainPolicyRuntime(options);
      this.strictRedirectSafety = true;
    }
  }
  get allowedHostnames() {
    return configuredHostnames(this.runtime);
  }
  getPolicyForHostname(hostname) {
    return this.runtime.getPolicyForHostname(hostname);
  }
  getPolicyForState(stateId) {
    return this.runtime.getPolicyForRouteName(stateId);
  }
  isStateHandledBySubdomain(stateId, subdomain) {
    return this.runtime.isRouteHandledBySubdomain(stateId, subdomain);
  }
  getPolicyLandingUrl(subdomain) {
    return this.runtime.getPolicyLandingUrl(subdomain);
  }
  getPolicyLandingUrlForState(stateId) {
    return this.runtime.getPolicyLandingUrlForRoute(stateId);
  }
  buildAbsoluteUrlForState(stateId, path = "/") {
    return this.runtime.buildAbsolutePolicyUrlForRoute(stateId, path);
  }
  getSocketServerOrigin(stateId) {
    return this.runtime.getSocketServerOrigin(stateId);
  }
  getAuthEntryUrl() {
    return this.runtime.getAuthEntryUrl();
  }
  getCanonicalTarget(hostname, snapshot) {
    if (!snapshot.route) return null;
    return this.runtime.getCanonicalNavigationTarget(hostname, {
      name: snapshot.stateId,
      fullPath: snapshotFullPath(snapshot),
      path: snapshot.route.canonicalPathname || snapshot.route.pathname
    });
  }
  rememberPostAuthRedirect(target, currentOrigin, currentHostname) {
    const safety = this.redirectSafety(currentOrigin, currentHostname);
    const result = safety.validate(target);
    if (result.ok || !this.strictRedirectSafety) {
      this.runtime.rememberPostAuthRedirect(result.ok ? result.normalized : target);
    }
    return result;
  }
  peekSafePostAuthRedirect(currentOrigin, currentHostname) {
    const target = this.runtime.peekSafePostAuthRedirect();
    if (!target || !this.strictRedirectSafety) return target;
    const safety = this.redirectSafety(currentOrigin, currentHostname);
    return safety.validate(target.to).ok ? target : null;
  }
  consumeSafePostAuthRedirect(currentOrigin, currentHostname) {
    const target = this.runtime.consumeSafePostAuthRedirect();
    if (!target || !this.strictRedirectSafety) return target;
    const safety = this.redirectSafety(currentOrigin, currentHostname);
    return safety.validate(target.to).ok ? target : null;
  }
  isDebugEnabled() {
    return this.runtime.isSubdomainDebugEnabled();
  }
  debug(event, payload) {
    this.runtime.logSubdomainDebug(event, payload);
  }
  redirectSafety(currentOrigin, currentHostname) {
    const options = {
      rootHostname: this.runtime.rootHostname,
      allowedHostnames: this.allowedHostnames
    };
    if (currentOrigin !== void 0) Object.assign(options, { currentOrigin });
    if (currentHostname !== void 0) Object.assign(options, { currentHostname });
    return new RedirectSafety(options);
  }
};
function createHostPolicyAdapter(options) {
  return new HostPolicyAdapter(options);
}

// src/browser/PopstateListener.ts
var PopstateListener = class {
  constructor(history) {
    this.history = history;
  }
  history;
  unsubscribe = null;
  start(listener) {
    if (this.unsubscribe) return;
    this.unsubscribe = this.history.listen(listener);
  }
  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
  get active() {
    return this.unsubscribe !== null;
  }
};

// src/browser/UrlSyncController.ts
var UrlSyncController = class {
  constructor(history) {
    this.history = history;
  }
  history;
  locked = false;
  get isLocked() {
    return this.locked;
  }
  withLock(fn) {
    const previous = this.locked;
    this.locked = true;
    try {
      return fn();
    } finally {
      this.locked = previous;
    }
  }
  async withAsyncLock(fn) {
    const previous = this.locked;
    this.locked = true;
    try {
      return await fn();
    } finally {
      this.locked = previous;
    }
  }
  commit(url, options = {}) {
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
};

// src/browser/BrowserUrlRuntime.ts
function normalizeHostPolicy(options) {
  if (!options.hostPolicy) return null;
  if (options.hostPolicy instanceof HostPolicyAdapter) return options.hostPolicy;
  return createHostPolicyAdapter(options.hostPolicy);
}
function targetToUrl(target) {
  return target.to;
}
var BrowserUrlRuntime = class {
  hsm;
  history;
  hostPolicy;
  popstate;
  syncController;
  canonical;
  autoCanonicalize;
  preserveUnknownQuery;
  canonicalizeAliases;
  onTransition;
  onCanonicalTarget;
  onError;
  constructor(options) {
    this.hsm = options.hsm;
    this.history = options.history ?? new BrowserHistoryAdapter(options.window ? { window: options.window } : {});
    this.hostPolicy = normalizeHostPolicy(options);
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
  get current() {
    return this.hsm.current;
  }
  async start(options = {}) {
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
  stop() {
    this.popstate.stop();
  }
  listen() {
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
  async navigate(stateIdOrUrl, params = {}, options = {}) {
    let input = stateIdOrUrl;
    if (this.hsm.has(stateIdOrUrl)) {
      const hrefOptions = {};
      if (options.context !== void 0) Object.assign(hrefOptions, { context: options.context, includeQueryState: true });
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
  sync(snapshot = this.requireCurrent(), options = {}) {
    const url = this.snapshotFullPath(snapshot, options.canonicalizePath ?? true);
    return this.syncController.commit(url, {
      mode: options.mode ?? "replace",
      source: "sync",
      state: options.state
    });
  }
  getCanonicalTarget(snapshot = this.requireCurrent()) {
    return this.canonical.targetFor(snapshot);
  }
  applyCanonical(snapshot = this.requireCurrent()) {
    const target = this.canonical.targetFor(snapshot);
    if (!target) return null;
    this.onCanonicalTarget?.(target, snapshot);
    if (target.type === "internal") {
      this.syncController.commit(targetToUrl(target), { mode: "replace", source: "canonical" });
    }
    return target;
  }
  rememberPostAuthRedirect(target) {
    return this.hostPolicy?.rememberPostAuthRedirect(
      target,
      this.history.current().origin,
      this.history.current().hostname
    ) ?? null;
  }
  peekSafePostAuthRedirect() {
    return this.hostPolicy?.peekSafePostAuthRedirect(
      this.history.current().origin,
      this.history.current().hostname
    ) ?? null;
  }
  consumeSafePostAuthRedirect() {
    return this.hostPolicy?.consumeSafePostAuthRedirect(
      this.history.current().origin,
      this.history.current().hostname
    ) ?? null;
  }
  getSocketServerOrigin(stateId) {
    return this.hostPolicy?.getSocketServerOrigin(stateId ?? this.current?.stateId) ?? null;
  }
  getAuthEntryUrl() {
    return this.hostPolicy?.getAuthEntryUrl() ?? null;
  }
  requireCurrent() {
    if (!this.hsm.current) throw new Error("HSM browser runtime has no current snapshot. Call start() first.");
    return this.hsm.current;
  }
  snapshotFullPath(snapshot, canonicalPath = true) {
    if (!snapshot.route) return this.history.current().fullPath;
    const pathname = canonicalPath ? snapshot.route.canonicalPathname || snapshot.route.pathname : snapshot.route.pathname;
    const query = snapshot.urlState?.projected ?? snapshot.route.query ?? {};
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === void 0 || value === null) continue;
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
  emitTransition(result) {
    this.onTransition?.(result);
    if (!result.ok) this.onError?.(result.error);
  }
};
function createHsmBrowserRuntime(options) {
  return new BrowserUrlRuntime(options);
}

exports.BrowserHistoryAdapter = BrowserHistoryAdapter;
exports.BrowserUrlRuntime = BrowserUrlRuntime;
exports.CanonicalNavigation = CanonicalNavigation;
exports.HostPolicyAdapter = HostPolicyAdapter;
exports.PopstateListener = PopstateListener;
exports.RedirectSafety = RedirectSafety;
exports.UrlSyncController = UrlSyncController;
exports.createHostPolicyAdapter = createHostPolicyAdapter;
exports.createHsmBrowserRuntime = createHsmBrowserRuntime;
exports.createRedirectSafety = createRedirectSafety;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map