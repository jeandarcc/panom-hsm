import { createHsm } from "panom-hsm";
import { createHsmBrowserRuntime } from "panom-hsm/browser";

const hsm = createHsm({
  id: "browser-example",
  states: {
    app: {
      path: "/app",
      url: { hide: true },
      states: { feed: { path: "/" } }
    }
  }
});

export const runtime = createHsmBrowserRuntime({
  hsm,
  window,
  autoCanonicalize: true
});

await runtime.start();
