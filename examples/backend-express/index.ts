import { compileSchema, defineHsm } from "panom-hsm/schema";
import { createHsmBackend } from "panom-hsm/backend";

const schema = compileSchema(defineHsm({
  id: "backend-example",
  states: {
    app: {
      path: "/app",
      url: { hide: true },
      states: {
        profile: {
          path: "/profile/:username",
          permissions: ["profile.view"],
          backend: { methods: ["GET"] }
        }
      }
    }
  }
}));

export const backend = createHsmBackend({
  schema,
  context: async ({ request }) => ({ user: request.user ?? null })
});

// app.get('/api/profile/:username', backend.requirePermission('profile.view'), handler)
