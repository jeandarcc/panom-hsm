import { createHsm } from "panom-hsm";

const hsm = createHsm({
  id: "basic-routing",
  states: {
    landing: { path: "/" },
    app: {
      path: "/app",
      url: { hide: true },
      states: {
        profile: { path: "/profile/:username" }
      }
    }
  }
});

console.log(hsm.href("app.profile", { username: "yusuf" }));
console.log(await hsm.resolveUrl("/profile/yusuf"));
