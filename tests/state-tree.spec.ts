import { describe, expect, it } from "vitest";
import { createHsm, HsmGuardRejectedError } from "../src/index.js";

interface PanomContext {
  user: null | { username: string };
}

describe("state tree core", () => {
  it("starts at nested initial state", async () => {
    const hsm = createHsm<PanomContext>({
      id: "panom",
      initial: "landing",
      context: { user: null },
      states: {
        landing: {
          initial: "home",
          states: {
            home: {},
            pricing: {}
          }
        }
      }
    });

    const snapshot = await hsm.start();

    expect(snapshot.stateId).toBe("landing.home");
    expect(snapshot.is("landing")).toBe(true);
  });

  it("runs guards across active path", async () => {
    const hsm = createHsm<PanomContext>({
      id: "panom",
      context: { user: null },
      guards: {
        requiresAuth: ({ context }) => Boolean(context.user)
      },
      states: {
        app: {
          guard: "requiresAuth",
          states: {
            feed: {}
          }
        }
      }
    });

    await expect(hsm.resolve("app.feed")).rejects.toBeInstanceOf(HsmGuardRejectedError);
    await expect(
      hsm.resolve("app.feed", { context: { user: { username: "yusuf" } } })
    ).resolves.toMatchObject({ stateId: "app.feed" });
  });

  it("passes params into guards", async () => {
    const hsm = createHsm<PanomContext>({
      id: "panom",
      context: { user: { username: "yusuf" } },
      guards: {
        isOwnProfile: ({ context, params }) => context.user?.username === params.username
      },
      states: {
        app: {
          states: {
            profile: {
              states: {
                owner: { guard: "isOwnProfile" },
                viewer: {}
              }
            }
          }
        }
      }
    });

    await expect(
      hsm.resolve("app.profile.owner", { params: { username: "yusuf" } })
    ).resolves.toMatchObject({ stateId: "app.profile.owner" });

    await expect(
      hsm.resolve("app.profile.owner", { params: { username: "alice" } })
    ).rejects.toBeInstanceOf(HsmGuardRejectedError);
  });
});
