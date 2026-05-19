import { describe, expect, it } from "vitest";
import { createHsm, query } from "../src/index.js";
import { createHsmVueRuntime } from "../src/vue/index.js";
import { createHsmDevtools } from "../src/devtools/index.js";

function createApp() {
  return createHsm({
    id: "final-test",
    context: { profile: { tab: "posts" } },
    query: {
      tab: query.string("posts", { source: "profile.tab" })
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
            permissions: ["profile.view"]
          }
        }
      }
    }
  });
}

describe("Vue adapter and devtools", () => {
  it("keeps a Vue shallow ref in sync with HSM transitions", async () => {
    const hsm = createApp();
    const runtime = createHsmVueRuntime({ hsm });

    expect(runtime.snapshot.value).toBeNull();
    await hsm.start();
    expect(runtime.snapshot.value?.stateId).toBe("landing");

    await hsm.transition("app.profile", { params: { username: "yusuf" } });
    expect(runtime.snapshot.value?.stateId).toBe("app.profile");
    expect(runtime.snapshot.value?.params.username).toBe("yusuf");
    expect(runtime.snapshot.value?.policy?.layout).toBe("social");
  });

  it("records transition timeline entries and exposes snapshot inspections", async () => {
    const hsm = createApp();
    const devtools = createHsmDevtools(hsm, { timelineLimit: 20 });

    await hsm.start();
    await hsm.transition("app.profile", { params: { username: "yusuf" } });

    const events = devtools.events();
    expect(events.some((event) => event.type === "transition:start")).toBe(true);
    expect(events.some((event) => event.type === "transition:success")).toBe(true);
    expect(devtools.inspect()).toMatchObject({
      stateId: "app.profile",
      policy: {
        layout: "social",
        permissions: ["app.access", "profile.view"]
      }
    });
  });
});
