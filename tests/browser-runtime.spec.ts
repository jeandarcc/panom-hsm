import { describe, expect, it } from "vitest";
import { createHsm, query } from "../src/index.js";
import {
  BrowserHistoryAdapter,
  RedirectSafety,
  createHsmBrowserRuntime,
  createHostPolicyAdapter
} from "../src/browser/index.js";
import type { BrowserWindowLike } from "../src/browser/index.js";

function createMemoryWindow(initial = "https://example.com/"): BrowserWindowLike & { emitPopstate(): void } {
  let url = new URL(initial);
  const listeners = new Set<(event: PopStateEvent) => void>();
  const location = {} as BrowserWindowLike["location"];
  Object.defineProperties(location, {
    origin: { get: () => url.origin },
    hostname: { get: () => url.hostname },
    pathname: { get: () => url.pathname },
    search: { get: () => url.search },
    hash: { get: () => url.hash },
    href: { get: () => url.href }
  });

  let historyState: unknown = null;
  const history: BrowserWindowLike["history"] = {
    get state() {
      return historyState;
    },
    pushState(data: unknown, _unused: string, next?: string | URL | null) {
      historyState = data;
      if (next) url = new URL(next, url.href);
    },
    replaceState(data: unknown, _unused: string, next?: string | URL | null) {
      historyState = data;
      if (next) url = new URL(next, url.href);
    }
  };

  return {
    location,
    history,
    addEventListener(_type: "popstate", listener: (event: PopStateEvent) => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: "popstate", listener: (event: PopStateEvent) => void) {
      listeners.delete(listener);
    },
    emitPopstate() {
      for (const listener of listeners) listener(new PopStateEvent("popstate"));
    }
  };
}

function createAppHsm() {
  return createHsm({
    id: "browser-runtime",
    context: {
      profile: { tab: "posts", page: 1 }
    },
    query: {
      tab: query.string("posts", { source: "profile.tab" }),
      page: query.number(1, { source: "profile.page" })
    },
    states: {
      app: {
        path: "/app",
        url: { hide: true },
        states: {
          profile: {
            path: "/profile/:username"
          }
        }
      },
      cloud: {
        path: "/cloud",
        states: {
          media: { path: "/media" }
        }
      }
    }
  });
}

describe("browser runtime and host policy", () => {
  it("connects HSM navigation to browser history without exposing hidden semantic parents", async () => {
    const windowLike = createMemoryWindow("https://example.com/profile/yusuf?tab=media&page=3");
    const hsm = createAppHsm();
    const runtime = createHsmBrowserRuntime({ hsm, window: windowLike, autoCanonicalize: false });

    const snapshot = await runtime.start({ listen: false });
    expect(snapshot.stateId).toBe("app.profile");
    expect(snapshot.context.profile.tab).toBe("media");
    expect(snapshot.context.profile.page).toBe(3);

    const result = await runtime.navigate("app.profile", { username: "ali" }, { mode: "push" });
    expect(result.ok).toBe(true);
    expect(windowLike.location.pathname).toBe("/profile/ali");
  });

  it("bridges @panomapp/subdomain-policy canonical host decisions", async () => {
    const windowLike = createMemoryWindow("https://example.com/profile/yusuf");
    const hsm = createAppHsm();
    const hostPolicy = createHostPolicyAdapter({
      rootHostname: "example.com",
      rootRouteName: "app.profile",
      policies: [
        {
          subdomain: "app",
          rootRenderRoute: "app.profile",
          canonicalPathPrefix: "/app",
          requiresAuth: true,
          reachableDirectly: true,
          routeNames: ["app.profile"],
          landingStrategy: "root-for-landing",
          socketOriginStrategy: "root-origin"
        }
      ],
      getCurrentOrigin: () => windowLike.location.origin,
      getCurrentHostname: () => windowLike.location.hostname,
      getCurrentSearch: () => windowLike.location.search
    });

    const runtime = createHsmBrowserRuntime({ hsm, window: windowLike, hostPolicy, autoCanonicalize: false });
    const snapshot = await runtime.start({ listen: false });
    const target = runtime.getCanonicalTarget(snapshot);

    expect(target).toEqual({ type: "external", to: "https://app.example.com/" });
    expect(runtime.getSocketServerOrigin()).toBe("https://example.com");
  });

  it("rejects protocol-relative, backslash, encoded-bypass and external post-auth redirects", () => {
    const safety = new RedirectSafety({
      rootHostname: "example.com",
      allowedHostnames: ["example.com", "app.example.com"],
      currentOrigin: "https://example.com",
      currentHostname: "example.com"
    });

    expect(safety.validate("//evil.example.com/path")).toMatchObject({ ok: false, reason: "protocol_relative" });
    expect(safety.validate("/\\evil.example.com")).toMatchObject({ ok: false, reason: "backslash" });
    expect(safety.validate("/%2f%2fevil.example.com")).toMatchObject({ ok: false, reason: "encoded_protocol_relative" });
    expect(safety.validate("https://evil.example.com/profile")).toMatchObject({ ok: false, reason: "external_origin" });
    expect(safety.validate("/profile/yusuf")).toMatchObject({ ok: true, target: { type: "internal", to: "/profile/yusuf" } });
    expect(safety.validate("https://app.example.com/profile/yusuf")).toMatchObject({ ok: true, target: { type: "external" } });
  });

  it("offers a deterministic memory history adapter for non-DOM tests", () => {
    const history = new BrowserHistoryAdapter({ baseOrigin: "https://example.com" });
    expect(history.current().fullPath).toBe("/");
    history.push("/cloud/media?tab=images", "navigate");
    expect(history.current()).toMatchObject({
      origin: "https://example.com",
      hostname: "example.com",
      fullPath: "/cloud/media?tab=images"
    });
  });
});
