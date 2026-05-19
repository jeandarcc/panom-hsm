import { createApp } from "vue";
import { createHsm } from "panom-hsm";
import { createHsmVue } from "panom-hsm/vue";
import App from "./App.vue";

const hsm = createHsm({
  id: "vue-example",
  states: {
    landing: { path: "/", layout: "marketing" },
    app: {
      path: "/app",
      url: { hide: true },
      layout: "social",
      states: { profile: { path: "/profile/:username" } }
    }
  }
});

createApp(App).use(createHsmVue({ hsm })).mount("#app");
