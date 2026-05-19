import { describe, expect, it } from "vitest";
import { createHsm, HsmRouteNotFoundError, query } from "../src/index.js";

interface PanomContext {
  user: null | { username: string };
  profile: {
    tab: string;
    page: number;
    onlyMine: boolean;
  };
}

function createProjectedPanomHsm(user: PanomContext["user"] = { username: "yusuf" }) {
  return createHsm<PanomContext>({
    id: "panom",
    context: {
      user,
      profile: {
        tab: "posts",
        page: 1,
        onlyMine: false
      }
    },
    query: {
      tab: query.string("posts", { source: "profile.tab" }),
      page: query.number(1, { source: "profile.page" }),
      mine: query.boolean(false, { source: "profile.onlyMine" })
    },
    guards: {
      requiresAuth: ({ context }) => Boolean(context.user),
      isOwnProfile: ({ context, params }) => context.user?.username === params.username
    },
    states: {
      landing: {
        path: "/",
        initial: "home",
        states: {
          home: { path: "/" },
          pricing: { path: "/pricing" }
        }
      },
      app: {
        path: "/app",
        url: {
          hide: true,
          aliases: ["/app"],
          redirectAliases: true,
          priority: 20
        },
        guard: "requiresAuth",
        initial: "feed",
        states: {
          feed: { path: "/" },
          profile: {
            path: "/profile/:username",
            resolve: [
              { target: "owner", guard: "isOwnProfile" },
              { target: "viewer" }
            ],
            states: {
              owner: { tags: ["profile:owner"] },
              viewer: { tags: ["profile:viewer"] }
            }
          }
        }
      },
      cloud: {
        path: "/cloud",
        states: {
          media: { path: "/media" }
        }
      },
      system: {
        path: "/system",
        url: { mode: "virtual" },
        states: {
          offline: { path: "/offline" }
        }
      }
    }
  });
}

describe("route projection", () => {
  it("hides semantic parent segments while preserving the internal state path", async () => {
    const hsm = createProjectedPanomHsm();

    expect(hsm.href("app.profile.owner", { username: "yusuf" })).toBe("/profile/yusuf");

    const snapshot = await hsm.resolveUrl("/profile/yusuf?tab=media&page=3&mine=true");

    expect(snapshot.stateId).toBe("app.profile.owner");
    expect(snapshot.activePath).toEqual(["app", "app.profile", "app.profile.owner"]);
    expect(snapshot.context.profile).toEqual({ tab: "media", page: 3, onlyMine: true });
    expect(snapshot.route).toMatchObject({
      pattern: "/profile/:username",
      canonicalPattern: "/profile/:username",
      pathname: "/profile/yusuf",
      canonicalPathname: "/profile/yusuf",
      matchedStateId: "app.profile",
      kind: "canonical",
      isCanonical: true
    });
  });

  it("matches hidden-parent aliases and emits canonical redirects", async () => {
    const hsm = createProjectedPanomHsm();

    const snapshot = await hsm.resolveUrl("/app/profile/yusuf?tab=media#top", {
      followRedirects: false
    });

    expect(snapshot.stateId).toBe("app.profile.owner");
    expect(snapshot.route).toMatchObject({
      pattern: "/app/profile/:username",
      canonicalPattern: "/profile/:username",
      pathname: "/app/profile/yusuf",
      canonicalPathname: "/profile/yusuf",
      kind: "alias",
      isCanonical: false
    });
    expect(snapshot.redirect).toEqual({
      from: "/app/profile/yusuf",
      to: "/profile/yusuf?tab=media#top",
      stateId: "app.profile"
    });
  });

  it("follows alias canonicalization into the public projected URL", async () => {
    const hsm = createProjectedPanomHsm();

    const snapshot = await hsm.resolveUrl("/app/profile/yusuf?tab=media#top");

    expect(snapshot.stateId).toBe("app.profile.owner");
    expect(snapshot.route).toMatchObject({
      pathname: "/profile/yusuf",
      canonicalPathname: "/profile/yusuf",
      kind: "canonical",
      isCanonical: true
    });
  });

  it("keeps virtual grouping nodes out of public URLs and route matching", () => {
    const hsm = createProjectedPanomHsm();

    expect(hsm.href("system.offline")).toBe("/offline");
    expect(hsm.matchUrl("/offline")).toMatchObject({
      stateId: "system.offline",
      pattern: "/offline",
      canonicalPattern: "/offline"
    });
    expect(() => hsm.matchUrl("/system/offline")).toThrow(HsmRouteNotFoundError);
  });

  it("uses projected-route priority and tries the next candidate when guards reject", async () => {
    const authed = createProjectedPanomHsm({ username: "yusuf" });
    const anonymous = createProjectedPanomHsm(null);

    await expect(authed.resolveUrl("/")).resolves.toMatchObject({
      stateId: "app.feed",
      route: { matchedStateId: "app.feed", pathname: "/" }
    });

    await expect(anonymous.resolveUrl("/")).resolves.toMatchObject({
      stateId: "landing.home",
      route: { matchedStateId: "landing", pathname: "/" }
    });
  });

  it("can canonicalize a URL while also projecting query-bound state", () => {
    const hsm = createProjectedPanomHsm();

    expect(
      hsm.syncUrl("/app/profile/yusuf?legacy=1", {
        user: { username: "yusuf" },
        profile: { tab: "media", page: 3, onlyMine: true }
      }, {
        canonicalizePath: true,
        preserveUnknownQuery: true
      })
    ).toBe("/profile/yusuf?legacy=1&tab=media&page=3&mine=true");
  });
});
