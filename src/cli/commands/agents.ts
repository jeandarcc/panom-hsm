import path from "node:path";
import { createHsmFromSchema } from "../../schema/createHsmFromSchema.js";
import { HsmTestDiscovery } from "../../testing/HsmTestDiscovery.js";
import { loadHsm, loadSchema } from "../hsmLoader.js";
import { defineHsmAgentSuite } from "../../agents/defineHsmAgentSuite.js";
import { runHsmAgents } from "../../agents/runHsmAgents.js";
import { agentActions } from "../../agents/actions/index.js";
import { agentInvariants } from "../../agents/invariants/index.js";
import { agentProfiles } from "../../agents/profiles/index.js";
import { AgentJsonReporter } from "../../agents/reporters/AgentJsonReporter.js";
import { AgentTextReporter } from "../../agents/reporters/AgentTextReporter.js";
import { HsmAgentReplayRunner } from "../../agents/replay/HsmAgentReplayRunner.js";
import { ReplayTraceLoader } from "../../agents/replay/ReplayTraceLoader.js";
import { HsmAgentDiscovery } from "../../agents/HsmAgentDiscovery.js";
import { HsmAgentFileLoader } from "../../agents/HsmAgentFileLoader.js";
import type { HsmAgentReportData } from "../../agents/types.js";
import { filterBySeverity, severityRank, writeReport } from "../cliUtils.js";

interface AgentsCommandOptions {
  readonly args: readonly string[];
  readonly cwd: string;
}

interface ParsedAgentArgs {
  readonly config?: string;
  readonly schema?: string;
  readonly target?: string;
  readonly agents?: number;
  readonly durationMs?: number;
  readonly maxSteps?: number;
  readonly seed?: string;
  readonly profile?: string;
  readonly json?: boolean;
  readonly report?: string;
  readonly severity?: string;
  readonly failOn?: string;
  readonly allowProductionTarget?: boolean;
  readonly mode?: string;
  readonly browser?: boolean;
  readonly pauseOnFail?: boolean;
  readonly agentId?: string;
}

export async function runAgentsCommand(options: AgentsCommandOptions): Promise<number> {
  const [subcommand, ...rest] = options.args;
  if (!subcommand || ["-h", "--help"].includes(subcommand)) {
    printAgentsHelp();
    return 0;
  }

  if (subcommand === "run") {
    return runAgents(rest, options.cwd);
  }

  if (subcommand === "replay") {
    return replayAgents(rest, options.cwd);
  }

  if (subcommand === "report") {
    return reportAgents(rest);
  }

  console.error(`Unknown agents command: ${subcommand}`);
  printAgentsHelp();
  return 1;
}

async function runAgents(args: readonly string[], cwd: string): Promise<number> {
  const parsed = parseAgentArgs(args);
  const discovery = new HsmAgentDiscovery({ cwd });
  const suitePath = parsed.config ?? (await discovery.discoverSuite());
  const loader = new HsmAgentFileLoader();

  const loadedSuite = suitePath
    ? await loader.loadSuite(suitePath)
    : defineHsmAgentSuite({
      name: "agent-swarm",
      target: {
        origin: parsed.target ?? "http://localhost:3000",
        allowedOrigins: [parsed.target ?? "http://localhost:3000"]
      },
      agents: {
        count: parsed.agents ?? 5,
        durationMs: parsed.durationMs ?? 30_000,
        seed: parsed.seed,
        profiles: [agentProfiles.anonymous()]
      },
      actions: [
        agentActions.visitRoutes(),
        agentActions.tamperQuery(),
        agentActions.callBackendRoutes(),
        agentActions.followCanonicalAliases(),
        agentActions.tryPermissionBoundActions(),
        agentActions.tryRedirectPayloads(),
        agentActions.sendRandomEvent(),
        agentActions.runLoaders()
      ],
      invariants: [
        agentInvariants.anonymousCannotEnter(["app.*", "cloud.*", "admin.*"]),
        agentInvariants.queryCannotGrant(["admin", "role", "permissions", "plan"]),
        agentInvariants.frontendBackendPolicyMustMatch(),
        agentInvariants.unsafeRedirectsNeverAccepted(),
        agentInvariants.viewerCannotGetOwnerPermissions(),
        agentInvariants.noUnexpectedPermissionGain()
      ]
    });

  const suiteWithTarget = parsed.target
    ? defineHsmAgentSuite({
      ...loadedSuite,
      target: {
        origin: parsed.target,
        allowedOrigins: [parsed.target]
      }
    })
    : loadedSuite;

  const suiteWithOverrides = {
    ...suiteWithTarget,
    safety: {
      ...suiteWithTarget.safety,
      allowProductionTargets: parsed.allowProductionTarget
        ? true
        : suiteWithTarget.safety.allowProductionTargets
    },
    agents: {
      ...suiteWithTarget.agents,
      mode: parsed.mode ? (parsed.mode as any) : suiteWithTarget.agents.mode,
      count: parsed.agents ?? suiteWithTarget.agents.count,
      durationMs: parsed.durationMs ?? suiteWithTarget.agents.durationMs,
      maxSteps: parsed.maxSteps ?? suiteWithTarget.agents.maxSteps,
      seed: parsed.seed ?? suiteWithTarget.agents.seed
    }
  };

  const testDiscovery = new HsmTestDiscovery({ cwd });
  const schemaPath = parsed.schema ?? suiteWithOverrides.hsm?.schemaPath ?? (await testDiscovery.discoverSchema());
  const schema = schemaPath ? await loadSchema(schemaPath) : undefined;

  const configPath = suiteWithOverrides.hsm?.configPath ?? (await testDiscovery.discoverConfig());
  const hsm = configPath
    ? (await loadHsm(configPath, schema)).hsm
    : schema
      ? createHsmFromSchema(schema)
      : undefined;

  if (!hsm) {
    console.error("Unable to load HSM config or schema for agents.");
    return 1;
  }

  const filteredSuite = parsed.profile
    ? { ...suiteWithOverrides, agents: { ...suiteWithOverrides.agents, profiles: suiteWithOverrides.agents.profiles.filter((p) => p.name === parsed.profile) } }
    : suiteWithOverrides;

  if (filteredSuite.agents.profiles.length === 0) {
    console.error("No matching agent profiles found.");
    return 1;
  }

  const report = await runHsmAgents({
    hsm,
    schema,
    suite: filteredSuite
  });

  const data = report.toObject();
  const filtered = parsed.severity ? filterAgentReport(data, parsed.severity) : data;
  const output = parsed.json ? new AgentJsonReporter().render(filtered) : new AgentTextReporter().render(filtered);
  console.log(output);
  await writeReport(output, parsed.report);

  const failOn = parsed.failOn ?? "high";
  const hasBlocking = filtered.findings.some((finding) => severityRank(finding.severity) >= severityRank(failOn));
  return hasBlocking ? 1 : 0;
}

async function replayAgents(args: readonly string[], cwd: string): Promise<number> {
  const parsed = parseAgentArgs(args);
  const reportPath = args[0];
  if (!reportPath) {
    console.error("Provide a report path for replay.");
    return 1;
  }
  if (!parsed.agentId) {
    console.error("Provide --agent <id> for replay.");
    return 1;
  }

  const discovery = new HsmTestDiscovery({ cwd });
  const schemaPath = parsed.schema ?? (await discovery.discoverSchema());
  const schema = schemaPath ? await loadSchema(schemaPath) : undefined;
  const configPath = await discovery.discoverConfig();
  const hsm = configPath
    ? (await loadHsm(configPath, schema)).hsm
    : schema
      ? createHsmFromSchema(schema)
      : undefined;

  if (!hsm) {
    console.error("Unable to load HSM config or schema for replay.");
    return 1;
  }

  const runner = new HsmAgentReplayRunner(hsm);
  try {
    const result = await runner.replay(reportPath, {
      agentId: parsed.agentId,
      browser: parsed.browser,
      pauseOnFail: parsed.pauseOnFail
    });
    if (!result.ok) {
      console.error(result.message ?? "Replay failed.");
      return 1;
    }
    console.log(result.message ?? "Replay completed.");
    return result.reproduced ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function reportAgents(args: readonly string[]): Promise<number> {
  const parsed = parseAgentArgs(args);
  const reportPath = args[0];
  if (!reportPath) {
    console.error("Provide a report path.");
    return 1;
  }
  const loader = new ReplayTraceLoader();
  const report = await loader.loadReport(reportPath);
  const filtered = parsed.severity ? filterAgentReport(report, parsed.severity) : report;
  const output = parsed.json ? new AgentJsonReporter().render(filtered) : new AgentTextReporter().render(filtered);
  console.log(output);
  return 0;
}

function parseAgentArgs(args: readonly string[]): ParsedAgentArgs {
  const parsed: Record<string, unknown> = {};
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];
    if (!current) continue;
    if (current === "--config") { parsed.config = next; index += 1; }
    if (current === "--schema") { parsed.schema = next; index += 1; }
    if (current === "--target") { parsed.target = next; index += 1; }
    if (current === "--agents") { parsed.agents = Number(next); index += 1; }
    if (current === "--duration") { parsed.durationMs = parseDuration(next); index += 1; }
    if (current === "--max-steps") { parsed.maxSteps = Number(next); index += 1; }
    if (current === "--seed") { parsed.seed = next; index += 1; }
    if (current === "--profile") { parsed.profile = next; index += 1; }
    if (current === "--json") parsed.json = true;
    if (current === "--report") { parsed.report = next; index += 1; }
    if (current === "--severity") { parsed.severity = next; index += 1; }
    if (current === "--fail-on") { parsed.failOn = next; index += 1; }
    if (current === "--allow-production-target") parsed.allowProductionTarget = true;
    if (current === "--mode") { parsed.mode = next; index += 1; }
    if (current === "--browser") parsed.browser = true;
    if (current === "--pause-on-fail") parsed.pauseOnFail = true;
    if (current === "--agent") { parsed.agentId = next; index += 1; }
  }
  return parsed as ParsedAgentArgs;
}

function parseDuration(input?: string): number | undefined {
  if (!input) return undefined;
  if (/^\d+$/.test(input)) return Number(input);
  const match = input.match(/^(\d+)(ms|s|m)$/);
  if (!match) return undefined;
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === "ms") return value;
  if (unit === "s") return value * 1000;
  if (unit === "m") return value * 60_000;
  return undefined;
}

function filterAgentReport(report: HsmAgentReportData, min: string): HsmAgentReportData {
  const findings = filterBySeverity(report.findings, min as any);
  return {
    ...report,
    findings,
    findingsBySeverity: {
      info: findings.filter((finding) => finding.severity === "info"),
      low: findings.filter((finding) => finding.severity === "low"),
      medium: findings.filter((finding) => finding.severity === "medium"),
      high: findings.filter((finding) => finding.severity === "high"),
      critical: findings.filter((finding) => finding.severity === "critical")
    }
  };
}

function printAgentsHelp(): void {
  const bin = path.basename(process.argv[1] ?? "hsm");
  console.log(`Usage: ${bin} agents <command> [options]`);
  console.log("\nCommands:");
  console.log("  run            Run the agent swarm");
  console.log("  replay         Replay a failing agent trace");
  console.log("  report         Print a report file");
  console.log("\nOptions:");
  console.log("  --config <path>     Agent suite config file");
  console.log("  --schema <path>     HSM schema file");
  console.log("  --target <origin>   Target origin");
  console.log("  --agents <count>    Number of agents");
  console.log("  --duration <time>   Duration (ms, s, m)");
  console.log("  --max-steps <num>   Max steps per agent");
  console.log("  --seed <seed>       Seed for deterministic runs");
  console.log("  --profile <name>    Limit to a single profile");
  console.log("  --json              Output JSON report");
  console.log("  --report <path>     Write report to file");
  console.log("  --severity <lvl>    Filter findings by severity");
  console.log("  --fail-on <lvl>     Exit non-zero if findings >= severity");
  console.log("  --allow-production-target  Allow non-local targets");
  console.log("  --mode <mode>       simulation|http|browser");
  console.log("  --agent <id>        Agent id for replay");
  console.log("  --browser           Browser replay (playwright)");
  console.log("  --pause-on-fail     Pause on failing steps");
}
