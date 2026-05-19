import { describe, expect, it } from "vitest";
import {
  compileSchema,
  createHsm,
  createHsmBackend,
  createHsmFromSchema,
  defineHsm,
  hsmExpressMiddleware,
  requireHsmPermission
} from "../src/index.js";

describe("policy engine", () => {
  it("inherits allow policies and resolves layout from the deepest explicit state", async () => {
    const hsm = createHsm({
      id: "panom",
      initial: "app",
      context: { user: { role: "user" }, device: { camera: true } },
      guards: {
        isAdmin: ({ context }) => context.user.role === "admin",
        hasCamera: ({ context }) => context.device.camera === true
      },
      policies: {
        permissions: {
          "profile.edit": true,
          "admin.panel": "isAdmin"
        },
        capabilities: {
          "camera.scan": "hasCamera"
        },
        features: {
          "profile.music": true
        }
      },
      states: {
        app: {
          layout: "social",
          permissions: ["app.access"],
          capabilities: ["camera.scan"],
          states: {
            profile: {
              path: "/profile/:username",
              permissions: ["profile.view", "profile.edit", "admin.panel"],
              features: ["profile.music"]
            }
          }
        }
      }
    });

    const snapshot = await hsm.resolve("app.profile", { params: { username: "yusuf" } });

    expect(snapshot.policy?.permissions).toEqual(["app.access", "profile.edit", "profile.view"]);
    expect(snapshot.policy?.capabilities).toEqual(["camera.scan"]);
    expect(snapshot.policy?.features).toEqual(["profile.music"]);
    expect(snapshot.policy?.layout).toBe("social");
    expect(snapshot.can("profile.edit")).toBe(true);
    expect(snapshot.can("admin.panel")).toBe(false);
    expect(snapshot.canUse("camera.scan")).toBe(true);
    expect(snapshot.feature("profile.music")).toBe(true);
  });

  it("supports deny policies that override inherited parent permissions", async () => {
    const hsm = createHsm({
      id: "panom",
      states: {
        cloud: {
          permissions: ["media.delete", "media.view"],
          states: {
            trash: {
              denyPermissions: ["media.delete"]
            }
          }
        }
      }
    });

    const snapshot = await hsm.resolve("cloud.trash");

    expect(snapshot.can("media.view")).toBe(true);
    expect(snapshot.can("media.delete")).toBe(false);
    expect(snapshot.policy?.deniedPermissions).toContain("media.delete");
    await hsm.transition("cloud.trash");
    expect((await hsm.explainPermission("media.delete")).reason).toBe("state_denied");
  });

  it("exposes ergonomic policy helpers on the machine current snapshot", async () => {
    const hsm = createHsm({
      id: "panom",
      initial: "app",
      states: {
        app: {
          layout: "social",
          permissions: ["feed.view"],
          capabilities: ["camera.scan"],
          features: ["arc.login"]
        }
      }
    });

    await hsm.start();

    expect(await hsm.can("feed.view")).toBe(true);
    expect(await hsm.cannot("media.delete")).toBe(true);
    expect(await hsm.canUse("camera.scan")).toBe(true);
    expect(await hsm.isFeatureEnabled("arc.login")).toBe(true);
    expect(hsm.permissions()).toEqual(["feed.view"]);
    expect(hsm.capabilities()).toEqual(["camera.scan"]);
    expect(hsm.features()).toEqual(["arc.login"]);
    expect(hsm.layout()).toBe("social");
  });

  it("serializes and rehydrates policy definitions through universal schema", async () => {
    const config = defineHsm({
      id: "panom",
      guards: {
        isPro: ({ context }) => context.plan === "pro"
      },
      policies: {
        features: {
          "cloud.bulkDelete": {
            guard: "isPro",
            description: "Bulk deletion is restricted to paid plans."
          }
        }
      },
      states: {
        cloud: {
          features: ["cloud.bulkDelete"]
        }
      }
    });

    const schema = compileSchema(config, { generatedAt: false });
    expect(schema.policies?.features?.["cloud.bulkDelete"]?.guard?.refs).toEqual(["isPro"]);
    expect(schema.index.guards).toContain("isPro");

    const hsm = createHsmFromSchema(schema, {
      context: { plan: "free" },
      guards: {
        isPro: ({ context }) => context.plan === "pro"
      }
    });

    const free = await hsm.resolve("cloud");
    expect(free.feature("cloud.bulkDelete")).toBe(false);

    const pro = await hsm.resolve("cloud", { context: { plan: "pro" } });
    expect(pro.feature("cloud.bulkDelete")).toBe(true);
  });

  it("enforces backend permission middleware using the shared schema contract", async () => {
    const schema = compileSchema({
      id: "panom",
      states: {
        cloud: {
          path: "/cloud",
          permissions: ["cloud.view", "media.delete"],
          backend: { methods: ["DELETE"] }
        }
      }
    }, { generatedAt: false });

    const backend = createHsmBackend({ schema });
    const allowed = await backend.resolveRequest({ method: "DELETE", url: "/cloud" }, { requirePermission: "media.delete" });
    expect(allowed.ok).toBe(true);

    const denied = await backend.resolveRequest({ method: "DELETE", url: "/cloud" }, { requirePermission: "billing.manage" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe("permission_denied");
  });

  it("provides express adapter helpers for permissions", async () => {
    const schema = compileSchema({
      id: "panom",
      states: {
        app: {
          path: "/app",
          permissions: ["app.access"]
        }
      }
    }, { generatedAt: false });
    const backend = createHsmBackend({ schema });
    const middleware = requireHsmPermission(backend, "app.access");

    let nextCalled = false;
    const req = { method: "GET", url: "/app" } as any;
    const res = { status: () => res, json: () => undefined } as any;
    await middleware(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(req.hsm.ok).toBe(true);

    const defaultMiddleware = hsmExpressMiddleware(backend, { requirePermission: "missing.permission" });
    let status = 0;
    let body: unknown;
    await defaultMiddleware(
      { method: "GET", url: "/app" } as any,
      { status: (code: number) => { status = code; return { json: (value: unknown) => { body = value; } }; } } as any,
      () => undefined
    );
    expect(status).toBe(403);
    expect(body).toEqual(expect.objectContaining({ error: "permission_denied" }));
  });
});
