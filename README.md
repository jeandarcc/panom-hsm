# panom-hsm

Universal hierarchical app state runtime for route, query, policy, backend, browser, and host-aware navigation.

`panom-hsm` lets you define a complex web app as a state tree instead of scattering routing, query-state, permissions, layout, async loaders, backend authorization, browser URL sync, and subdomain canonicalization across unrelated systems.

```bash
npm install panom-hsm
```

Optional integrations:

```bash
npm install @panomapp/subdomain-policy
npm install vue
```

## Why it exists

Traditional applications usually split the same decision across many layers:

- router decides which screen matches a URL
- stores hold local state
- query parsing is hand-written per page
- auth and permission checks are duplicated in frontend and backend
- layouts are selected outside the route model
- subdomain and canonical redirect rules live in separate config

`panom-hsm` uses one hierarchical state model as the application contract. The same model can drive frontend navigation, backend request authorization, URL state projection, host-aware canonical navigation, and policy decisions.

## Quick start

```ts
import { createHsm, query } from "panom-hsm";

const hsm = createHsm({
  id: "app",
  context: {
    user: { username: "yusuf" },
    profile: { tab: "posts", page: 1, onlyMine: false }
  },
  query: {
    tab: query.string("posts", { source: "profile.tab" }),
    page: query.number(1, { source: "profile.page" }),
    mine: query.boolean(false, { source: "profile.onlyMine" })
  },
  guards: {
    "profile.isOwner": ({ context, params }) => context.user?.username === params.username
  },
  states: {
    landing: {
      path: "/",
      layout: "marketing"
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
    }
  }
});

const snapshot = await hsm.resolveUrl("/profile/yusuf?tab=media&page=3&mine=true");

snapshot.stateId;             // "app.profile.owner"
snapshot.context.profile.tab; // "media"
snapshot.route?.pathname;     // "/profile/yusuf"
snapshot.policy?.layout;      // "social"
```

`app` is a semantic parent, but `url.hide` keeps it out of the public URL. The visible URL can be `/profile/yusuf` while the internal state remains `app.profile.owner`.

## Core concepts

### Hierarchical state tree

State IDs are semantic paths such as `app.profile.owner` or `cloud.media.detail`. Parent state configuration is inherited by children where appropriate.

```ts
states: {
  cloud: {
    path: "/cloud",
    layout: "cloud",
    permissions: ["cloud.view"],
    states: {
      media: {
        path: "/media",
        permissions: ["media.view"]
      }
    }
  }
}
```

### URL-projected state

Query parameters can be bound to context. HSM owns serialization, decoding, defaults, validation, and URL generation.

```ts
query: {
  tab: query.string("posts", { source: "profile.tab" }),
  page: query.number(1, { source: "profile.page" }),
  tags: query.stringArray([], { source: "media.tags" })
}
```

```ts
hsm.href("app.profile", { username: "yusuf" }, {
  context: { profile: { tab: "media", page: 3 } }
});
// /profile/yusuf?tab=media&page=3
```

Default-equivalent values are pruned by default, so URLs remain clean.

### Hidden and virtual routes

Semantic structure does not have to leak into public URLs.

```ts
states: {
  app: {
    path: "/app",
    url: { hide: true },
    states: {
      profile: { path: "/profile/:username" }
    }
  }
}
```

```ts
hsm.href("app.profile", { username: "yusuf" });
// /profile/yusuf
```

Use `url.mode: "virtual"` for grouping nodes that should not participate in route matching.

### Transitions, lifecycle, loaders, and events

```ts
states: {
  profile: {
    path: "/profile/:username",
    beforeEnter: "auth.required",
    loader: "loadProfile",
    onEnter: "trackProfileView",
    onLeave: "cancelProfileRequests",
    on: {
      OPEN_SETTINGS: "app.settings"
    }
  }
}
```

```ts
const result = await hsm.transitionUrl("/profile/yusuf");

if (!result.ok) {
  console.error(result.reason, result.error);
}
```

Loaders receive an `AbortSignal`, so superseded navigations can cancel pending async work.

### Policy engine

Permissions, capabilities, features, denials, and layouts are resolved from the active state path.

```ts
const canDelete = await hsm.can("media.delete");
const hasCamera = await hsm.canUse("camera.scan");
const music = await hsm.isFeatureEnabled("profile.music");
const layout = hsm.layout();
```

Rules can be declared globally:

```ts
policies: {
  permissions: {
    "media.delete": { guard: "media.isOwner" }
  },
  capabilities: {
    "camera.scan": { guard: "device.hasCamera" }
  },
  features: {
    "profile.music": { guard: "plan.isPro" }
  }
}
```

Debuggable explanations are available:

```ts
const decision = await hsm.explainPermission("media.delete");
```

## Schema and backend runtime

HSM configs can be compiled into a function-free portable schema. The schema can be shared with backend code while guards/actions/loaders remain environment-specific registry entries.

```ts
import { compileSchema, defineHsm } from "panom-hsm/schema";

const definition = defineHsm({
  id: "app",
  states: {
    app: {
      path: "/app",
      url: { hide: true },
      states: {
        profile: { path: "/profile/:username", permissions: ["profile.view"] }
      }
    }
  }
});

const schema = compileSchema(definition);
```

Backend usage:

```ts
import { createHsmBackend } from "panom-hsm/backend";

const backend = createHsmBackend({
  schema,
  guards: {
    "auth.required": async ({ context }) => Boolean(context.user)
  },
  context: async ({ request }) => ({ user: request.user })
});

app.get("/api/profile/:username", backend.requirePermission("profile.view"), handler);
```

Frontend policy is UX. Backend policy enforcement is the security boundary.

## Browser runtime

```ts
import { createHsmBrowserRuntime } from "panom-hsm/browser";

const runtime = createHsmBrowserRuntime({
  hsm,
  window,
  autoCanonicalize: true
});

await runtime.start();
await runtime.navigate("app.profile", { username: "yusuf" });
```

The browser runtime integrates `pushState`, `replaceState`, `popstate`, query-state projection, canonical URLs, and redirect safety.

## Subdomain policy integration

`panom-hsm` integrates with `@panomapp/subdomain-policy` through the browser runtime.

```ts
import { createHostPolicyAdapter, createHsmBrowserRuntime } from "panom-hsm/browser";

const hostPolicy = createHostPolicyAdapter({
  rootHostname: "example.com",
  rootRouteName: "landing.home",
  policies: [
    {
      subdomain: "app",
      rootRenderRoute: "app.feed",
      canonicalPathPrefix: "/app",
      requiresAuth: true,
      reachableDirectly: true,
      routeNames: ["app.feed", "app.profile"],
      landingStrategy: "root-for-landing",
      socketOriginStrategy: "root-origin"
    }
  ]
});

const runtime = createHsmBrowserRuntime({ hsm, window, hostPolicy });
```

Redirect safety rejects protocol-relative URLs, backslashes, encoded protocol-relative bypasses, unsupported protocols, and external origins outside the allowed host policy.

## Vue adapter

```ts
import { createApp } from "vue";
import { createHsmVue } from "panom-hsm/vue";

const app = createApp(App);
app.use(createHsmVue({ hsm }));
```

```ts
import { useHsm, useHsmState, useHsmPolicy } from "panom-hsm/vue";

const hsm = useHsm();
const state = useHsmState();
const policy = useHsmPolicy();

await hsm.transition("app.profile", { params: { username: "yusuf" } });

state.stateId.value;        // app.profile.owner
policy.can("profile.edit");
```

Render by state ID:

```vue
<template>
  <MachineOutlet :components="screens" />
</template>
```

## Devtools runtime

```ts
import { createHsmDevtools } from "panom-hsm/devtools";

const devtools = createHsmDevtools(hsm, {
  logger: (event) => console.debug(event.type, event.payload)
});

await hsm.start();
await hsm.transitionUrl("/profile/yusuf");

devtools.events();
devtools.inspect();
```

The devtools runtime records transition starts, successes, failures, snapshots, and errors. It is framework-neutral and can be used in tests, internal debug panels, or browser integrations.

## Exports

```txt
panom-hsm
panom-hsm/core
panom-hsm/schema
panom-hsm/backend
panom-hsm/browser
panom-hsm/runtime
panom-hsm/vue
panom-hsm/devtools
```

## Security notes

- Do not trust frontend-only policy checks for authorization.
- Enforce sensitive permissions on the backend with `createHsmBackend()`.
- Keep portable schemas function-free; use named guards/actions/loaders and implement them per runtime.
- Treat post-auth redirects as hostile input. Use `RedirectSafety` or browser runtime redirect helpers.
- Prefer canonical URL generation over string concatenation.

## License

MIT
