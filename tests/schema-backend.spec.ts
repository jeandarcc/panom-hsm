import { describe, expect, it } from "vitest";
import {
  compileSchema,
  createHsmBackend,
  createHsmFromSchema,
  defineHsm,
  query,
  schemaFromJson,
  schemaToJson,
  HsmSchemaFunctionError
} from "../src/index.js";

interface Ctx {
  user: null | { username: string; role?: string };
  profile: { tab: string; page: number; mine: boolean };
}

const config = defineHsm<Ctx>({
  id: "panom",
  version: "0.6.0",
  context: {
    user: { username: "yusuf", role: "owner" },
    profile: { tab: "posts", page: 1, mine: false }
  },
  query: {
    tab: query.string("posts", { source: "profile.tab" }),
    page: query.number(1, { source: "profile.page" }),
    mine: query.boolean(false, { source: "profile.mine" })
  },
  guards: {
    requiresAuth: ({ context }) => Boolean(context.user),
    isOwnProfile: ({ context, params }) => context.user?.username === params.username,
    backendOwnerOnly: ({ context }) => context.user?.role === "owner"
  },
  states: {
    app: {
      path: "/app",
      url: { hide: true, aliases: ["/app"], redirectAliases: true },
      guard: "requiresAuth",
      initial: "feed",
      meta: { layout: "social" },
      states: {
        feed: {
          path: "/",
          tags: ["public-app"]
        },
        profile: {
          path: "/profile/:username",
          resolve: [
            { target: "owner", guard: "isOwnProfile" },
            { target: "viewer" }
          ],
          states: {
            owner: {
              tags: ["profile", "owner"],
              permissions: ["profile.edit", "media.delete"],
              backend: {
                methods: ["GET", "DELETE"],
                guards: "backendOwnerOnly",
                meta: { api: "profile-owner" }
              }
            },
            viewer: {
              tags: ["profile"],
              permissions: ["profile.view"],
              backend: { methods: ["GET"] }
            }
          }
        }
      }
    }
  }
});

const runtimeGuards = config.guards ?? {};

describe("universal schema and backend bridge", () => {
  it("compiles a function-free portable schema with route, query and policy indexes", () => {
    const schema = compileSchema(config, { source: "tests/panom.hsm.ts", generatedAt: false });

    expect(schema.kind).toBe("panom-hsm.schema");
    expect(schema.version).toBe("0.6.0");
    expect(schema.index.guards).toEqual(["backendOwnerOnly", "isOwnProfile", "requiresAuth"]);
    expect(schema.index.routes.some((route) => route.stateId === "app.profile" && route.canonicalPattern === "/profile/:username")).toBe(true);
    expect(schema.query?.["page"]?.type).toBe("number");
    expect(schema.index.states.find((state) => state.id === "app.profile.owner")?.policies?.permissions).toEqual([
      "profile.edit",
      "media.delete"
    ]);
    expect(JSON.stringify(schema)).not.toContain("=>");
  });

  it("round-trips schema JSON and hydrates a frontend runtime from it", async () => {
    const schema = compileSchema(config, { generatedAt: false });
    const json = schemaToJson(schema);
    const restored = schemaFromJson(json);
    const hsm = createHsmFromSchema<Ctx>(restored, {
      context: config.context as Ctx,
      guards: runtimeGuards
    });

    const snapshot = await hsm.resolveUrl("/profile/yusuf?tab=media&page=3&mine=true");

    expect(snapshot.stateId).toBe("app.profile.owner");
    expect(snapshot.context.profile).toEqual({ tab: "media", page: 3, mine: true });
    expect(hsm.href("app.profile", { username: "yusuf" }, { context: snapshot.context as Ctx })).toBe("/profile/yusuf?tab=media&page=3&mine=true");
  });

  it("rejects inline functions when compiling a portable schema", () => {
    expect(() => compileSchema({
      id: "bad",
      states: {
        app: {
          guard: () => true
        }
      }
    })).toThrow(HsmSchemaFunctionError);
  });

  it("resolves backend requests through the same HSM contract", async () => {
    const schema = compileSchema(config, { generatedAt: false });
    const backend = createHsmBackend<Ctx>({
      schema,
      context: ({ request }) => ({
        user: request.user as Ctx["user"],
        profile: { tab: "posts", page: 1, mine: false }
      }),
      guards: runtimeGuards
    });

    const result = await backend.resolveRequest({
      method: "DELETE",
      url: "/profile/yusuf?tab=media&page=2",
      user: { username: "yusuf", role: "owner" }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    expect(result.snapshot.stateId).toBe("app.profile.owner");
    expect(result.canonicalUrl).toBe("/profile/yusuf?tab=media&page=2");
  });

  it("enforces backend method and backend-only guards", async () => {
    const schema = compileSchema(config, { generatedAt: false });
    const backend = createHsmBackend<Ctx>({
      schema,
      context: ({ request }) => ({
        user: request.user as Ctx["user"],
        profile: { tab: "posts", page: 1, mine: false }
      }),
      guards: runtimeGuards
    });

    const methodFailure = await backend.resolveRequest({
      method: "POST",
      url: "/profile/other",
      user: { username: "yusuf", role: "owner" }
    });
    expect(methodFailure.ok).toBe(false);
    if (methodFailure.ok) throw new Error("expected failure");
    expect(methodFailure.reason).toBe("method_not_allowed");
    expect(methodFailure.status).toBe(405);

    const guardFailure = await backend.resolveRequest({
      method: "DELETE",
      url: "/profile/yusuf",
      user: { username: "yusuf", role: "viewer" }
    });
    expect(guardFailure.ok).toBe(false);
    if (guardFailure.ok) throw new Error("expected failure");
    expect(guardFailure.reason).toBe("guard_failed");
    expect(guardFailure.status).toBe(403);
  });
});
