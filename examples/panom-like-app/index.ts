import { createHsm, query } from "panom-hsm";
import { createHostPolicyAdapter } from "panom-hsm/browser";

export const panomHsm = createHsm({
  id: "panom-like-app",
  context: {
    user: { username: "yusuf", plan: "pro" },
    profile: { tab: "posts", page: 1, mine: false }
  },
  query: {
    tab: query.string("posts", { source: "profile.tab" }),
    page: query.number(1, { source: "profile.page" }),
    mine: query.boolean(false, { source: "profile.mine" })
  },
  guards: {
    "profile.isOwner": ({ context, params }) => context.user?.username === params.username,
    "plan.isPro": ({ context }) => context.user?.plan === "pro"
  },
  policies: {
    features: {
      "cloud.bulkDelete": { guard: "plan.isPro" }
    }
  },
  states: {
    landing: {
      path: "/",
      layout: "marketing",
      states: {
        pricing: { path: "/pricing" }
      }
    },
    app: {
      path: "/app",
      url: { hide: true },
      layout: "social",
      permissions: ["app.access"],
      states: {
        profile: {
          path: "/profile/:username",
          permissions: ["profile.view"],
          resolve: [
            { target: "owner", guard: "profile.isOwner" },
            { target: "viewer" }
          ],
          states: {
            owner: { permissions: ["profile.edit", "media.delete"] },
            viewer: { permissions: ["note.create"] }
          }
        }
      }
    },
    cloud: {
      path: "/cloud",
      layout: "cloud",
      permissions: ["cloud.view"],
      states: {
        media: {
          path: "/media",
          permissions: ["media.view"],
          features: ["cloud.bulkDelete"]
        }
      }
    }
  }
});

export const hostPolicy = createHostPolicyAdapter({
  rootHostname: "panom.app",
  rootRouteName: "landing",
  policies: [
    {
      subdomain: "cloud",
      rootRenderRoute: "cloud.media",
      canonicalPathPrefix: "/cloud",
      requiresAuth: true,
      reachableDirectly: true,
      routeNames: ["cloud.media"],
      landingStrategy: "root-for-landing",
      socketOriginStrategy: "root-origin"
    }
  ]
});
