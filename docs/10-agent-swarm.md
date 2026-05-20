# HSM Agent Swarm

Agent Swarm is a state-aware testing system that explores your application using the HSM schema, route graph, query schema, and policy metadata. It is deterministic, reproducible, and integrates with HSM Testing & Audit findings.

This is a defensive QA and security tool. It is designed for your own local/staging environments only.

## Safety First

Agent Swarm enforces a safety boundary:

- only allow known origins (default: localhost/private networks)
- block external origins by default
- block payment/email routes by default
- block destructive methods unless explicitly allowed
- never follow redirects to external origins

You must provide an allowed target origin. If you need to run against a non-local target, use `--allow-production-target` plus an explicit `allowedOrigins` list.

## Quick Start

```ts
import {
  defineHsmAgentSuite,
  runHsmAgents,
  agentProfiles,
  agentActions,
  agentInvariants
} from "@panomapp/hsm/agents";

const suite = defineHsmAgentSuite({
  name: "security-swarm",
  target: {
    origin: "http://localhost:8080",
    allowedOrigins: ["http://localhost:8080"]
  },
  hsm: {
    schemaPath: "./hsm.schema.json"
  },
  agents: {
    count: 20,
    durationMs: 60_000,
    seed: "0x91ac",
    profiles: [
      agentProfiles.anonymous(),
      agentProfiles.user(),
      agentProfiles.owner(),
      agentProfiles.lowPrivilege()
    ]
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
  ],
  safety: {
    blockExternalOrigins: true,
    destructiveActions: "sandbox-only"
  }
});

const report = await runHsmAgents({ hsm, suite });
if (!report.ok) {
  console.error(report.toText());
  process.exit(1);
}
```

## Suite Model

Suites define how the swarm is configured:

- `target`: origin + allowlist
- `hsm`: schema path or config path
- `agents`: count, duration, seed, profiles
- `actions`: the behaviors to run per step
- `invariants`: checks enforced after every action
- `safety`: runtime safeguards

## Deterministic Seeds

Every run is deterministic when the seed is fixed. Each agent receives a deterministic child seed. Reports include both the global seed and per-agent seeds.

```bash
hsm agents run --seed 0x91ac
```

## Actions

Actions are state-aware behaviors. Each action returns a trace event and findings when something suspicious happens.

Common actions include:

- visiting canonical routes
- tampering with query state
- calling backend routes (simulation or HTTP)
- following canonical alias rules
- testing permission-bound transitions
- injecting redirect payloads
- sending random HSM events
- triggering loader-backed states

## Invariants

Invariants run after every action. These enforce global safety properties:

- anonymous profiles cannot enter protected states
- query state cannot grant sensitive permissions
- frontend and backend policy must align
- unsafe redirect targets are never accepted
- viewer profiles cannot gain owner/admin permissions
- no unexpected permission gain compared to baseline

## Reports

Reports are structured and replayable. They include:

- per-agent summaries
- findings grouped by severity
- trace events with inputs and outcomes
- replay commands

```ts
report.ok;
report.findings;
report.toText();
report.toJson();
```

## CLI

```bash
hsm agents run --schema hsm.schema.json --target http://localhost:8080
hsm agents run --agents 50 --duration 5m --seed 0x91ac
hsm agents run --json --report reports/hsm-agent-report.json

hsm agents replay reports/hsm-agent-report.json --agent agent-12
hsm agents replay reports/hsm-agent-report.json --agent agent-12 --browser --pause-on-fail

hsm agents report reports/hsm-agent-report.json
hsm agents report reports/hsm-agent-report.json --json
```

## Replay

Headless replay re-runs trace steps using the HSM runtime. Browser replay uses Playwright (optional):

```bash
npm install -D playwright
hsm agents replay reports/hsm-agent-report.json --agent agent-12 --browser
```

## Notes

- Agent Swarm reuses the HSM Testing & Audit probes where possible.
- It is not a replacement for full security testing, but it catches common route/auth/redirect regressions and schema drift.

## Book End

Return to the entry page in [HSM Docs](./README.md).
