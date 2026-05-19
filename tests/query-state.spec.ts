import { describe, expect, it } from "vitest";
import { createHsm, HsmQueryParseError, query } from "../src/index.js";

interface PanomContext {
  user: null | { username: string };
  profile: {
    tab: string;
    page: number;
    onlyMine: boolean;
    tags: string[];
    modal: string;
  };
}

function createQueryHsm(overrides: Partial<PanomContext["profile"]> = {}) {
  const profile = {
    tab: "posts",
    page: 1,
    onlyMine: false,
    tags: [],
    modal: "",
    ...overrides
  };

  return createHsm<PanomContext>({
    id: "panom",
    context: {
      user: { username: "yusuf" },
      profile
    },
    guards: {
      isOwnProfile: ({ context, params }) => context.user?.username === params.username,
      pageIsLoaded: ({ context }) => context.profile.page > 0
    },
    query: {
      tab: query.string("posts", {
        source: "context.profile.tab",
        validate: ({ value }) => ["posts", "media", "likes"].includes(String(value))
      }),
      page: query.number(1, {
        source: "profile.page",
        validate: ({ value }) => typeof value === "number" && value > 0
      }),
      mine: query.boolean(false, {
        source: "profile.onlyMine"
      }),
      tags: query.stringArray([], {
        source: "profile.tags"
      }),
      modal: query.string("", {
        source: "profile.modal",
        expose: false
      })
    },
    states: {
      app: {
        path: "/app",
        states: {
          profile: {
            path: "/profile/:username",
            guard: "pageIsLoaded",
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

describe("URL-projected state", () => {
  it("hydrates query-bound context before guard and semantic resolution", async () => {
    const hsm = createQueryHsm();

    const snapshot = await hsm.resolveUrl(
      "/app/profile/yusuf?tab=media&page=3&mine=true&tags=image&tags=video&debug=1"
    );

    expect(snapshot.stateId).toBe("app.profile.owner");
    expect(snapshot.context.profile).toEqual({
      tab: "media",
      page: 3,
      onlyMine: true,
      tags: ["image", "video"],
      modal: ""
    });
    expect(snapshot.urlState?.decoded).toMatchObject({
      tab: "media",
      page: 3,
      mine: true,
      tags: ["image", "video"]
    });
    expect(snapshot.urlState?.unknown).toEqual({ debug: "1" });
    expect(snapshot.urlState?.projected).toEqual({
      tab: "media",
      page: "3",
      mine: "true",
      tags: ["image", "video"]
    });
  });

  it("projects selected context fields into hrefs and prunes default values", () => {
    const hsm = createQueryHsm({ tab: "media", page: 2 });

    const url = hsm.href(
      "app.profile.owner",
      { username: "yusuf" },
      {
        context: {
          user: { username: "yusuf" },
          profile: {
            tab: "media",
            page: 2,
            onlyMine: false,
            tags: [],
            modal: "compose"
          }
        }
      }
    );

    expect(url).toBe("/app/profile/yusuf?tab=media&page=2");
  });

  it("syncs an existing URL from context while preserving unknown query params", () => {
    const hsm = createQueryHsm();

    const url = hsm.syncUrl(
      "/app/profile/yusuf?debug=1&tab=media&page=4#bio",
      {
        user: { username: "yusuf" },
        profile: {
          tab: "posts",
          page: 1,
          onlyMine: false,
          tags: [],
          modal: "hidden"
        }
      },
      { preserveUnknownQuery: true }
    );

    expect(url).toBe("/app/profile/yusuf?debug=1#bio");
  });

  it("can preserve unknown query params in resolved projected state", async () => {
    const hsm = createQueryHsm();

    const snapshot = await hsm.resolveUrl("/app/profile/yusuf?tab=likes&debug=1", {
      preserveUnknownQuery: true
    });

    expect(snapshot.urlState?.projected).toEqual({ debug: "1", tab: "likes" });
  });

  it("falls back to defaults for invalid query values by default", async () => {
    const hsm = createQueryHsm({ page: 5 });

    const snapshot = await hsm.resolveUrl("/app/profile/yusuf?page=not-a-number");

    expect(snapshot.context.profile.page).toBe(1);
    expect(snapshot.urlState?.projected).toEqual({});
  });

  it("supports strict invalid-query policy", async () => {
    const hsm = createHsm<PanomContext>({
      id: "strict",
      context: {
        user: { username: "yusuf" },
        profile: { tab: "posts", page: 1, onlyMine: false, tags: [], modal: "" }
      },
      query: {
        page: query.number(1, {
          source: "profile.page",
          invalid: "throw"
        })
      },
      states: {
        app: {
          path: "/app"
        }
      }
    });

    await expect(hsm.resolveUrl("/app?page=nah")).rejects.toBeInstanceOf(HsmQueryParseError);
  });
});
