import { describe, expect, it } from "vitest";
import { createHsm, HsmRouteNotFoundError } from "../src/index.js";

interface PanomContext {
  user: null | { username: string };
}

function createPanomHsm(user: PanomContext["user"] = { username: "yusuf" }) {
  return createHsm<PanomContext>({
    id: "panom",
    initial: "landing",
    context: { user },
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
          pricing: { path: "/pricing" },
          oldPricing: { path: "/plans", redirect: "landing.pricing" }
        }
      },
      app: {
        path: "/app",
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
        guard: "requiresAuth",
        initial: "dashboard",
        states: {
          dashboard: { path: "/" },
          media: { path: "/media" }
        }
      }
    }
  });
}

describe("routing and href generation", () => {
  it("matches nested URL routes and extracts params", async () => {
    const hsm = createPanomHsm();

    const snapshot = await hsm.resolveUrl("/app/profile/yusuf?tab=posts#top");

    expect(snapshot.stateId).toBe("app.profile.owner");
    expect(snapshot.params).toEqual({ username: "yusuf" });
    expect(snapshot.route).toMatchObject({
      matchedStateId: "app.profile",
      pattern: "/app/profile/:username",
      pathname: "/app/profile/yusuf",
      query: { tab: "posts" },
      hash: "top"
    });
    expect(snapshot.hasTag("profile:owner")).toBe(true);
  });

  it("uses semantic child resolution for the same URL", async () => {
    const hsm = createPanomHsm({ username: "yusuf" });

    await expect(hsm.resolveUrl("/app/profile/alice")).resolves.toMatchObject({
      stateId: "app.profile.viewer"
    });
  });

  it("generates hrefs from semantic state ids", () => {
    const hsm = createPanomHsm();

    expect(hsm.href("app.profile.owner", { username: "yusuf" })).toBe("/app/profile/yusuf");
    expect(hsm.href("cloud.media", {}, { query: { filter: "large" }, hash: "usage" })).toBe(
      "/cloud/media?filter=large#usage"
    );
  });

  it("follows internal state redirects", async () => {
    const hsm = createPanomHsm();

    await expect(hsm.resolveUrl("/plans")).resolves.toMatchObject({
      stateId: "landing.pricing",
      route: { pathname: "/pricing" }
    });
  });

  it("can expose redirect snapshots without following", async () => {
    const hsm = createPanomHsm();

    const snapshot = await hsm.resolveUrl("/plans", { followRedirects: false });

    expect(snapshot.stateId).toBe("landing.oldPricing");
    expect(snapshot.redirect).toEqual({
      from: "/plans",
      to: "/pricing",
      stateId: "landing.oldPricing"
    });
  });

  it("rejects unknown routes", () => {
    const hsm = createPanomHsm();

    expect(() => hsm.matchUrl("/missing")).toThrow(HsmRouteNotFoundError);
  });
});
