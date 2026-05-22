import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHsm, defineHsm, compileSchema, query } from "../src/index.js";
import { defineHsmAgentSuite } from "../src/agents/defineHsmAgentSuite.js";
import { HsmAgentRandom } from "../src/agents/HsmAgentRandom.js";
import { HsmAgentSafetyPolicy } from "../src/agents/HsmAgentSafetyPolicy.js";
import { createHsmAgentRuntimeAdapter } from "../src/agents/HsmAgentRuntimeAdapter.js";
import { HsmAgentContext } from "../src/agents/HsmAgentContext.js";
import { runHsmAgents } from "../src/agents/runHsmAgents.js";
import { HsmAgentReplayRunner } from "../src/agents/replay/HsmAgentReplayRunner.js";
import { agentProfiles } from "../src/agents/profiles/index.js";
import { visitRoutes, tamperQuery } from "../src/agents/actions/index.js";
import {
  anonymousCannotEnter,
  unsafeRedirectsNeverAccepted,
  frontendBackendPolicyMustMatch
} from "../src/agents/invariants/index.js";
import { runAgentsCommand } from "../src/cli/commands/agents.js";

interface TestContext {
  user: null | { id: string; role: string };
  auth: { role: string };
  redirectTo: string;
}

function createTestHsm() {
  return createHsm<TestContext>({
    id: "agent",
    context: {
      user: null,
      auth: { role: "user" },
      redirectTo: ""
    },
    guards: {
      requiresAuth: ({ context }) => Boolean(context.user),
      isAdmin: ({ context }) => context.auth.role === "admin"
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
      }
    }
  });
}

function createAgentContext() {
  const hsm = createTestHsm();
  const suite = defineHsmAgentSuite({
    name: "swarm",
    target: { origin: "http://localhost:3000" },
    agents: {
      count: 1,
      durationMs: 1000,
      profiles: [{ name: "anonymous", context: { user: null, auth: { role: "user" }, redirectTo: "" } }]
    }
  });
  const adapter = createHsmAgentRuntimeAdapter(hsm);
  return new HsmAgentContext({
    agentId: "agent-1",
    suite,
    profile: suite.agents.profiles[0]!,
    adapter,
    random: new HsmAgentRandom("seed"),
    safety: new HsmAgentSafetyPolicy(suite.safety),
    schema: compileSchema(defineHsm({ id: "agent", states: { landing: { path: "/" } } }), { generatedAt: false })
  });
}

describe("hsm agent swarm", () => {
  it("defineHsmAgentSuite normalizes config", () => {
    const suite = defineHsmAgentSuite({
      name: "suite",
      target: { origin: "http://localhost:3000" },
      agents: { count: 1, durationMs: 1000 }
    });
    expect(suite.kind).toBe("hsm-agent-suite");
    expect(suite.safety.blockExternalOrigins).toBe(true);
    expect(suite.agents.profiles.length).toBe(1);
  });

  it("seeded random produces deterministic sequences", () => {
    const a = new HsmAgentRandom("seed");
    const b = new HsmAgentRandom("seed");
    expect(a.next()).toBe(b.next());
    expect(a.next()).toBe(b.next());
  });

  it("safety policy rejects external targets by default", () => {
    const policy = new HsmAgentSafetyPolicy();
    const result = policy.validateTarget({ origin: "https://example.com", allowedOrigins: ["https://example.com"] });
    expect(result.ok).toBe(false);
  });

  it("safety policy rejects destructive actions by default", () => {
    const policy = new HsmAgentSafetyPolicy();
    expect(policy.isDestructiveAllowed()).toBe(false);
  });

  it("visit routes action records trace", async () => {
    const context = createAgentContext();
    const action = visitRoutes();
    const result = await action.run(context);
    expect(result.trace?.actionName).toBe("visit_routes");
  });

  it("query tampering action detects permission gain", async () => {
    const hsm = createTestHsm();
    const suite = defineHsmAgentSuite({
      name: "tamper",
      target: { origin: "http://localhost:3000" },
      agents: {
        count: 1,
        durationMs: 1000,
        profiles: [{ name: "anonymous", context: { user: null, auth: { role: "user" }, redirectTo: "" } }]
      }
    });
    const context = new HsmAgentContext({
      agentId: "agent-1",
      suite,
      profile: suite.agents.profiles[0]!,
      adapter: createHsmAgentRuntimeAdapter(hsm),
      random: new HsmAgentRandom("seed"),
      safety: new HsmAgentSafetyPolicy(suite.safety),
      schema: compileSchema(defineHsm({
        id: "agent",
        context: { user: null, auth: { role: "user" }, redirectTo: "" },
        query: { role: query.string("user", { source: "auth.role" }) },
        policies: { permissions: { "admin.panel": "isAdmin" } },
        guards: { isAdmin: ({ context }) => context.auth.role === "admin" },
        states: { landing: { path: "/", permissions: ["admin.panel"] } }
      }), { generatedAt: false })
    });
    const result = await tamperQuery().run(context);
    expect(result.findings.some((finding) => finding.title === "Permission escalated via query")).toBe(true);
  });

  it("anonymousCannotEnter invariant creates finding", async () => {
    const context = createAgentContext();
    context.setSnapshot({ stateId: "app.feed" });
    const invariant = anonymousCannotEnter(["app.*"]);
    const result = await invariant.run(context);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("unsafeRedirectsNeverAccepted invariant creates finding", async () => {
    const context = createAgentContext();
    context.setSnapshot({ urlState: { decoded: { redirect: "https://evil.example.com" } } });
    const invariant = unsafeRedirectsNeverAccepted();
    const result = await invariant.run(context);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("frontendBackendPolicyMustMatch creates finding", async () => {
    const context = createAgentContext();
    context.lastBackendResult = { ok: true, stateId: "app.feed", permissions: ["media.delete"], method: "GET" };
    const invariant = frontendBackendPolicyMustMatch();
    const result = await invariant.run(context);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("agent report includes replay command", async () => {
    const hsm = createHsm({ id: "agent", states: { landing: { path: "/" } } });
    const suite = defineHsmAgentSuite({
      name: "report",
      target: { origin: "http://localhost:3000" },
      agents: { count: 1, durationMs: 1000, profiles: [agentProfiles.anonymous()] }
    });
    const report = await runHsmAgents({ hsm, suite });
    expect(report.toObject().reproduction[0]).toContain("hsm agents replay");
  });

  it("headless replay reproduces failing step", async () => {
    const hsm = createHsm({ id: "agent", states: { landing: { path: "/" } } });
    const runner = new HsmAgentReplayRunner(hsm);
    const reportPath = await writeTempReport({
      ok: false,
      suiteName: "replay",
      target: { origin: "http://localhost:3000" },
      seed: "seed",
      durationMs: 10,
      agents: { total: 1, completed: 1, failed: 1 },
      steps: { total: 1 },
      findings: [],
      findingsBySeverity: { info: [], low: [], medium: [], high: [], critical: [] },
      agentSummaries: [],
      traces: [
        {
          agentId: "agent-1",
          seed: "seed",
          events: [
            {
              id: "agent-1:0:visit",
              agentId: "agent-1",
              sequence: 0,
              timestamp: new Date().toISOString(),
              actionName: "visit_routes",
              actionType: "routing",
              url: "/",
              expected: { state: "missing.state" }
            }
          ]
        }
      ],
      reproduction: ["hsm agents replay <report.json> --agent agent-1"],
      metadata: { generatedAt: new Date().toISOString(), environment: {} }
    });

    const result = await runner.replay(reportPath, { agentId: "agent-1" });
    expect(result.reproduced).toBe(true);
  });

  it("CLI run --json outputs valid JSON", async () => {
    const schemaPath = await writeTempSchema();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await runAgentsCommand({ args: ["run", "--schema", schemaPath, "--json", "--duration", "1"], cwd: process.cwd() });
    expect(code).toBe(0);
    const output = logSpy.mock.calls[0]?.[0];
    expect(() => JSON.parse(String(output))).not.toThrow();
    logSpy.mockRestore();
  });

  it("CLI replay missing browser dependency gives clear message", async () => {
    const schemaPath = await writeTempSchema();
    const reportPath = await writeTempReport({
      ok: true,
      suiteName: "replay",
      target: { origin: "http://localhost:3000" },
      seed: "seed",
      durationMs: 10,
      agents: { total: 1, completed: 1, failed: 0 },
      steps: { total: 1 },
      findings: [],
      findingsBySeverity: { info: [], low: [], medium: [], high: [], critical: [] },
      agentSummaries: [],
      traces: [
        {
          agentId: "agent-1",
          seed: "seed",
          events: [
            {
              id: "agent-1:0:visit",
              agentId: "agent-1",
              sequence: 0,
              timestamp: new Date().toISOString(),
              actionName: "visit_routes",
              actionType: "routing",
              url: "/"
            }
          ]
        }
      ],
      reproduction: [],
      metadata: { generatedAt: new Date().toISOString(), environment: {} }
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await runAgentsCommand({
      args: ["replay", reportPath, "--agent", "agent-1", "--browser", "--schema", schemaPath],
      cwd: process.cwd()
    });
    expect(code).toBe(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain("playwright");
    errorSpy.mockRestore();
  });

  it("secrets are redacted from report", async () => {
    const hsm = createHsm({ id: "agent", states: { landing: { path: "/" } } });
    const suite = defineHsmAgentSuite({
      name: "accounts",
      target: { origin: "http://localhost:3000" },
      agents: { count: 1, durationMs: 1000, profiles: [agentProfiles.user()] },
      accounts: {
        create: async () => ({
          id: "account-1",
          profile: "user",
          auth: { token: "secret-token" }
        })
      }
    });
    const report = await runHsmAgents({ hsm, suite });
    const account = report.toObject().agentSummaries[0]?.account;
    expect(account?.auth?.token).toBe("[redacted]");
  });
});

async function writeTempSchema(): Promise<string> {
  const schema = compileSchema(defineHsm({ id: "agent", states: { landing: { path: "/" } } }), { generatedAt: false });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hsm-agents-"));
  const filePath = path.join(dir, "hsm.schema.json");
  await fs.writeFile(filePath, JSON.stringify(schema, null, 2), "utf-8");
  return filePath;
}

async function writeTempReport(report: any): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hsm-agent-report-"));
  const filePath = path.join(dir, "report.json");
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
  return filePath;
}
