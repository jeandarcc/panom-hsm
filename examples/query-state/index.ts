import { createHsm, query } from "panom-hsm";

const hsm = createHsm({
  id: "query-state",
  context: { media: { tab: "all", page: 1, mine: false } },
  query: {
    tab: query.string("all", { source: "media.tab" }),
    page: query.number(1, { source: "media.page" }),
    mine: query.boolean(false, { source: "media.mine" })
  },
  states: {
    cloud: {
      path: "/cloud",
      states: { media: { path: "/media" } }
    }
  }
});

const snapshot = await hsm.resolveUrl("/cloud/media?tab=images&page=3&mine=true");
console.log(snapshot.context.media);
console.log(hsm.href("cloud.media", {}, { context: snapshot.context }));
