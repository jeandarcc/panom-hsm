import { describe, expect, it } from "vitest";
import type { AnyRecord } from "../src/core/types.js";
import type { HsmMachine } from "../src/core/HsmMachine.js";
import {
  compileSchema,
  createHsm,
  defineHsm,
  query
} from "../src/index.js";
import { defineHsmTest, runHsmAudit, runHsmTests, probes } from "../src/testing/index.js";
import { JsonReporter } from "../src/testing/reporters/JsonReporter.js";
import { TextReporter } from "../src/testing/reporters/TextReporter.js";

interface TestContext {
  user: null | { id: string; role: string };
  auth: { role: string };
  redirectTo: string;
}

function createTestHsm() {
  return createHsm<TestContext>({
    id: "test",
    initial: "landing",
    context: {
      user: null,
      auth: { role: "user" },
      redirectTo: ""
    },
    guards: {
      requiresAuth: ({ context }) => Boolean(context.user),
      isAdmin: ({ context }) => context.user?.role === "admin" || context.auth.role === "admin"
    },
    query: {
      redirect: query.string("", { source: "redirectTo" }),
      role: query.string("user", { source: "auth.role" })
    },
    policies: {
      permissions: {
        "admin.panel": "isAdmin"
      }
    },
    states: {
      landing: { path: "/", permissions: ["admin.panel"] },
      auth: {
        path: "/login",
        states: {
          login: {
            on: {
              LOGIN_SUCCESS: {
                target: "app.feed",
                context: { user: { id: "u1", role: "user" } }
              }
            }
          }
        }
      },
      app: {
        path: "/app",
        guard: "requiresAuth",
        states: {
          feed: { path: "/" }
        }
      },
      legacy: {
        path: "/old",
        url: { aliases: ["/legacy"], redirectAliases: false }
      }
    }
  });
}

function createAdapter<TContext extends AnyRecord>(hsm: HsmMachine<TContext>) {
  return {
    hsm,
    hsmId: hsm.id,
    resolveUrl: (url: string, options?: Record<string, unknown>) => hsm.resolveUrl(url, options),
    transitionUrl: (url: string, options?: Record<string, unknown>) => hsm.transitionUrl(url, options),
    transition: (stateId: string, options?: Record<string, unknown>) => hsm.transition(stateId, options),
    send: (event: string, payload: unknown, options?: Record<string, unknown>) => hsm.send(event, payload, options),
    href: (stateId: string, params?: Record<string, unknown>, options?: Record<string, unknown>) => hsm.href(stateId, params, options),
    syncUrl: (url: string, context: TContext, options?: Record<string, unknown>) => hsm.syncUrl(url, context, options),
    routes: () => hsm.routes(),
    states: () => hsm.states()
  };
}

describe("hsm testing and audit", () => {
  it("defineHsmTest normalizes config", () => {
    const test = defineHsmTest({
      name: "login-flow",
      steps: [{ type: "visit", url: "/" }]
    });

    expect(test.kind).toBe("hsm-test");
    expect(test.steps.length).toBe(1);
    expect(test.security).toEqual([]);
  });

  it("visit step resolves expected state", async () => {
    const hsm = createTestHsm();
    const test = defineHsmTest({
      name: "visit-login",
      steps: [
        { type: "visit", url: "/login", expect: { state: "auth.login" } }
      ]
    });

    const report = await runHsmTests<TestContext>({ hsm, tests: [test] });
    expect(report.ok).toBe(true);
  });

  it("event step transitions expected state", async () => {
    const hsm = createTestHsm();
    const test = defineHsmTest({
      name: "event-login",
      arrange: { url: "/login" },
      steps: [
        { type: "event", event: "LOGIN_SUCCESS", expect: { state: "app.feed" } }
      ]
    });

    const report = await runHsmTests<TestContext>({ hsm, tests: [test] });
    expect(report.ok).toBe(true);
  });

  it("assertion failures emit structured findings", async () => {
    const hsm = createTestHsm();
    const test = defineHsmTest({
      name: "assert-mismatch",
      steps: [
        { type: "visit", url: "/", expect: { state: "app.feed" } }
      ]
    });

    const report = await runHsmTests<TestContext>({ hsm, tests: [test] });
    expect(report.ok).toBe(false);
    expect(report.findings[0]?.testName).toBe("assert-mismatch");
  });

  it("open redirect probe catches protocol-relative targets", async () => {
    const hsm = createTestHsm();
    const schema = compileSchema(defineHsm({
      id: "test",
      context: { user: null, auth: { role: "user" }, redirectTo: "" },
      query: { redirect: query.string("", { source: "redirectTo" }) },
      states: { landing: { path: "/" } }
    }), { generatedAt: false });

    const report = await runHsmAudit({ hsm, schema, probes: [probes.openRedirect()] });
    expect(report.findings.some((finding) => finding.title === "Unsafe redirect accepted")).toBe(true);
  });

  it("unauthenticated access probe flags protected routes", async () => {
    const hsm = createHsm({
      id: "guardless",
      states: {
        cloud: { path: "/cloud" }
      }
    });

    const findings = await probes.unauthenticatedAccess({ protectedStates: ["cloud.*"] }).run({
      hsm: { id: hsm.id },
      adapter: createAdapter(hsm),
      contextProfiles: { anonymous: {} },
      schema: undefined
    });

    expect(findings.length).toBeGreaterThan(0);
  });

  it("permission escalation probe detects query-driven privilege", async () => {
    const hsm = createTestHsm();
    const findings = await probes.permissionEscalation().run({
      hsm: { id: hsm.id },
      adapter: createAdapter(hsm),
      contextProfiles: { anonymous: { user: null, auth: { role: "user" }, redirectTo: "" } },
      schema: undefined
    });

    expect(findings.some((finding) => finding.title === "Permission escalated via query")).toBe(true);
  });

  it("query tampering probe does not crash on invalid values", async () => {
    const config = defineHsm({
      id: "query",
      context: { profile: { page: 1 } },
      query: { page: query.number(1, { source: "profile.page" }) },
      states: { landing: { path: "/" } }
    });
    const schema = compileSchema(config, { generatedAt: false });
    const hsm = createHsm(config);

    const findings = await probes.queryTampering().run({
      hsm: { id: hsm.id },
      adapter: createAdapter(hsm),
      contextProfiles: { anonymous: { profile: { page: 1 } } },
      schema
    });

    expect(findings.some((finding) => finding.title === "Query tampering caused resolution failure")).toBe(false);
  });

  it("backend policy mismatch detects missing enforcement", async () => {
    const config = defineHsm({
      id: "backend",
      states: {
        cloud: { permissions: ["media.delete"] }
      }
    });
    const schema = compileSchema(config, { generatedAt: false });
    const hsm = createHsm(config);

    const findings = await probes.backendPolicyMismatch().run({
      hsm: { id: hsm.id },
      adapter: createAdapter(hsm),
      contextProfiles: { anonymous: {} },
      schema
    });

    expect(findings.some((finding) => finding.title === "Dangerous permission lacks backend policy")).toBe(true);
  });

  it("canonicalization probe flags alias without redirect", async () => {
    const hsm = createTestHsm();
    const findings = await probes.routeCanonicalization().run({
      hsm: { id: hsm.id },
      adapter: createAdapter(hsm),
      contextProfiles: { anonymous: { user: null, auth: { role: "user" }, redirectTo: "" } },
      schema: undefined
    });

    expect(findings.some((finding) => finding.title === "Alias did not redirect to canonical route")).toBe(true);
  });

  it("JSON reporter produces machine-readable output", async () => {
    const hsm = createTestHsm();
    const test = defineHsmTest({ name: "report", steps: [{ type: "visit", url: "/" }] });
    const report = await runHsmTests<TestContext>({ hsm, tests: [test] });
    const json = new JsonReporter().render(report.toObject());
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("text reporter includes severity and recommendations", async () => {
    const hsm = createTestHsm();
    const test = defineHsmTest({
      name: "report-text",
      steps: [{ type: "visit", url: "/", expect: { permissions: ["admin.panel"] } }]
    });
    const report = await runHsmTests<TestContext>({ hsm, tests: [test] });
    const text = new TextReporter().render(report.toObject());
    expect(text).toContain("Severity:");
    expect(text).toContain("Recommendation");
  });
});
