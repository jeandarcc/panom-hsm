import { describe, expect, it } from "vitest";
import { createHsm } from "../src/index.js";

interface Ctx {
  user: null | { username: string };
  profile: { tab: string };
  blocked: boolean;
}

function createRuntimeHsm(log: string[] = []) {
  return createHsm<Ctx>({
    id: "panom",
    initial: "app",
    context: {
      user: { username: "yusuf" },
      profile: { tab: "posts" },
      blocked: false
    },
    guards: {
      canLeave: ({ context }) => !context.blocked,
      requiresAuth: ({ context }) => Boolean(context.user),
      isOwnProfile: ({ context, params }) => context.user?.username === params.username
    },
    actions: {
      mark: ({ stateId, toStateId }) => {
        log.push(`action:${stateId}->${toStateId}`);
      },
      eventAction: ({ event }) => {
        log.push(`event:${event?.type}`);
      }
    },
    loaders: {
      loadProfile: async ({ params, signal }) => {
        if (signal.aborted) throw new DOMException("aborted", "AbortError");
        return { username: params.username, loaded: true };
      }
    },
    states: {
      app: {
        path: "/",
        guard: "requiresAuth",
        initial: "feed",
        states: {
          feed: {
            path: "/",
            beforeLeave: "canLeave",
            onLeave: "mark",
            on: {
              OPEN_PROFILE: {
                target: "profile",
                actions: "eventAction",
                params: ({ event }) => ({ username: (event.payload as { username: string }).username })
              }
            }
          },
          profile: {
            path: "/profile/:username",
            loader: "loadProfile",
            beforeEnter: "requiresAuth",
            onEnter: "mark",
            afterEnter: "mark",
            resolve: [
              { target: "owner", guard: "isOwnProfile" },
              { target: "viewer" }
            ],
            states: {
              owner: {},
              viewer: {}
            }
          }
        }
      }
    }
  });
}

describe("transition runtime", () => {
  it("runs guarded transition lifecycle, loaders, commits snapshots and stores data", async () => {
    const log: string[] = [];
    const hsm = createRuntimeHsm(log);
    await hsm.start();

    const result = await hsm.transition("app.profile", {
      params: { username: "yusuf" }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    expect(result.snapshot.stateId).toBe("app.profile.owner");
    expect(hsm.current?.stateId).toBe("app.profile.owner");
    expect(result.snapshot.data?.["app.profile"]).toEqual({ username: "yusuf", loaded: true });
    expect(result.lifecycle).toEqual([
      { phase: "beforeLeave", stateId: "app.feed" },
      { phase: "beforeEnter", stateId: "app.profile" },
      { phase: "load", stateId: "app.profile" },
      { phase: "onLeave", stateId: "app.feed" },
      { phase: "onEnter", stateId: "app.profile" },
      { phase: "afterEnter", stateId: "app.profile" }
    ]);
    expect(log).toEqual([
      "action:app.feed->app.profile.owner",
      "action:app.profile->app.profile.owner",
      "action:app.profile->app.profile.owner"
    ]);
  });

  it("returns controlled failures and does not commit when beforeLeave rejects", async () => {
    const hsm = createRuntimeHsm();
    await hsm.start({ context: { user: { username: "yusuf" }, profile: { tab: "posts" }, blocked: true } });

    const result = await hsm.transition("app.profile", { params: { username: "yusuf" } });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toBe("guard_failed");
    expect(result.from?.stateId).toBe("app.feed");
    expect(hsm.current?.stateId).toBe("app.feed");
  });

  it("dispatches events from the active state and transitions semantically", async () => {
    const log: string[] = [];
    const hsm = createRuntimeHsm(log);
    await hsm.start();

    const result = await hsm.send("OPEN_PROFILE", { username: "alice" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    expect(result.snapshot.stateId).toBe("app.profile.viewer");
    expect(result.snapshot.params).toEqual({ username: "alice" });
    expect(log[0]).toBe("event:OPEN_PROFILE");
  });

  it("aborts superseded transitions", async () => {
    const releaseFirstLoader: { current: null | (() => void) } = { current: null };

    const hsm = createHsm<Ctx>({
      id: "abortable",
      context: { user: { username: "yusuf" }, profile: { tab: "posts" }, blocked: false },
      loaders: {
        slow: ({ signal }) => new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
          releaseFirstLoader.current = () => resolve("done");
        }),
        fast: () => "fast"
      },
      states: {
        app: {
          initial: "a",
          states: {
            a: {},
            b: { loader: "slow" },
            c: { loader: "fast" }
          }
        }
      }
    });

    await hsm.start();
    const first = hsm.transition("app.b");
    const second = await hsm.transition("app.c");
    releaseFirstLoader.current?.();
    const firstResult = await first;

    expect(second.ok).toBe(true);
    expect(firstResult.ok).toBe(false);
    if (firstResult.ok) throw new Error("expected abort");
    expect(firstResult.reason).toBe("aborted");
    expect(hsm.current?.stateId).toBe("app.c");
  });
});
