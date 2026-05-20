# HSM Testing And Audit

As HSM grows, the question "is it working correctly?" gets harder. This is why the testing and audit modules exist. They provide deterministic, schema-aware checks that validate both expected flows and security posture.

Testing focuses on expected outcomes. Audit focuses on suspicious outcomes. Both share a common report format so they can be used in CI, local workflows, and release gates.

## Goals

- verify URL resolution and state transitions
- validate query schema and query-bound state
- check policy and permission expectations
- surface security issues like open redirects or unauthenticated access
- detect frontend/backend policy drift

## Quick Start

The primary entry point is the testing module:

```ts
import {
	defineHsmTest,
	runHsmTests,
	probes,
} from "@panomapp/hsm/testing";

const loginFlow = defineHsmTest({
	name: "login-flow",
	arrange: {
		context: { user: null },
	},
	steps: [
		{
			type: "visit",
			url: "/login",
			expect: {
				state: "auth.login",
			},
		},
		{
			type: "event",
			event: "LOGIN_SUCCESS",
			payload: {
				user: {
					id: "u1",
					username: "yusuf",
				},
			},
			expect: {
				state: "app.feed",
				permissions: ["post.create"],
			},
		},
	],
	security: [
		probes.openRedirect(),
		probes.unauthenticatedAccess({
			protectedStates: ["app.*", "cloud.*"],
		}),
		probes.queryTampering(),
		probes.permissionEscalation(),
		probes.backendPolicyMismatch(),
	],
});

const report = await runHsmTests({
	hsm,
	tests: [loginFlow],
});

if (!report.ok) {
	console.error(report.toText());
	process.exit(1);
}
```

## Test Model

Tests are declarative objects created with `defineHsmTest`. Each test can define a scenario using steps and optional security probes.

```ts
const test = defineHsmTest({
	name: "cloud-auth",
	description: "Anonymous users cannot access cloud routes",
	arrange: {
		context: { user: null },
		url: "/",
	},
	tags: ["auth", "cloud"],
	steps: [
		{
			type: "visit",
			url: "/cloud/media",
			expect: {
				denied: true,
				redirectTo: "auth.login",
			},
		},
	],
	security: [
		probes.unauthenticatedAccess({
			protectedStates: ["cloud.*"],
		}),
	],
});
```

Supported top-level fields:

- `name` (string, required)
- `description` (string)
- `arrange` (initial context/url)
- `steps` (ordered list)
- `security` (optional probe list)
- `tags` (string list)
- `severity` (override default failure severity)
- `metadata` (arbitrary structured metadata)

## Steps

Steps model what a user or app would do. These are not unit test helpers, they are high-level scenario actions.

### Visit

Resolves a URL, performs routing logic, and applies query binding.

```ts
{
	type: "visit",
	url: "/profile/yusuf",
	expect: {
		state: "app.profile.viewer",
		params: { username: "yusuf" },
	},
}
```

### Event

Sends an HSM event through `hsm.send()` if available, or uses the runtime adapter if not.

```ts
{
	type: "event",
	event: "LOGIN_SUCCESS",
	payload: { user: { id: "u1" } },
	expect: { state: "app.feed" },
}
```

### Transition

Transitions directly to a state id. Use this for administrative or system-controlled moves.

```ts
{
	type: "transition",
	target: "cloud.media",
	expect: { state: "cloud.media" },
}
```

### Context

Applies a context patch or hydration update.

```ts
{
	type: "context",
	patch: { user: { id: "u1", role: "admin" } },
}
```

### Assert

Runs assertions against the current snapshot without changing state.

```ts
{
	type: "assert",
	expect: { permissions: ["media.delete"] },
}
```

## Assertions

Assertions are validated against the current runtime snapshot and policy metadata when available. Each failure produces a structured finding.

Supported expectations include:

- `state`, `notState`
- `denied`, `redirectTo`
- `permissions`, `notPermissions`
- `capabilities`, `features`
- `layout`
- `params`, `query`, `context`
- `backendAllowed`, `backendDenied`
- `urlSafe`, `canonicalUrl`

Example:

```ts
{
	type: "visit",
	url: "/settings/billing?plan=pro",
	expect: {
		state: "settings.billing",
		permissions: ["billing.view"],
		notPermissions: ["billing.admin"],
		urlSafe: true,
	},
}
```

Every failed assertion records:

- test name
- step index and type
- expected value
- actual value
- severity
- explanation
- recommendation when possible

## Security Probes

Probes are reusable audits that can run within a test or as a standalone audit. They are schema-aware and adapt to runtime capabilities through the HSM adapter.

### Open Redirect Probe

Detects unsafe redirect handling by testing protocol-relative, encoded, and script-based values.

```ts
probes.openRedirect();
```

### Unauthenticated Access Probe

Enumerates protected states and ensures they are not reachable with anonymous context.

```ts
probes.unauthenticatedAccess({
	protectedStates: ["app.*", "cloud.*", "admin.*"],
	unauthContext: { user: null },
});
```

### Permission Escalation Probe

Attempts query-based permission or role escalation and checks for suspicious gains.

```ts
probes.permissionEscalation();
```

### Query Tampering Probe

Tests query schema resilience with invalid types, large values, and duplicate keys.

```ts
probes.queryTampering();
```

### Backend Policy Mismatch Probe

Detects policy drift between frontend permissions and backend enforcement metadata.

```ts
probes.backendPolicyMismatch();
```

### Route Canonicalization Probe

Verifies alias and canonical URL behavior, checking for bypasses or hidden exposure.

```ts
probes.routeCanonicalization();
```

### Hidden Route Probe

Ensures hidden and virtual route nodes do not resolve unexpectedly.

```ts
probes.hiddenRoute();
```

### Backend Method Policy Probe

Validates that disallowed HTTP methods are denied by backend policy metadata.

```ts
probes.backendMethodPolicy();
```

## Audit Runner

Audits can run without user-defined tests. The default audit runs all supported probes with reasonable defaults.

```ts
import { runHsmAudit } from "@panomapp/hsm/audit";

const report = await runHsmAudit({
	hsm,
	contextProfiles: {
		anonymous: { user: null },
		user: { user: { id: "u1", role: "user" } },
		admin: { user: { id: "a1", role: "admin" } },
	},
});

if (!report.ok) {
	console.error(report.toText());
	process.exit(1);
}
```

Protected state inference uses guard names, permissions, backend metadata, and state id heuristics (for example `admin`, `cloud`, `billing`). You can override this behavior by passing explicit `protectedStates` to the unauthenticated access probe.

## Reports

Both tests and audits return a structured report with text and JSON serialization.

```ts
const report = await runHsmTests({ hsm, tests: [test] });

report.ok; // boolean
report.findings; // structured findings list
report.toText(); // human readable
report.toJson(); // machine readable
```

Text output format example:

```
HSM Audit Report
Result: FAILED
Duration: 142ms

Summary:
- Tests: 5 passed, 1 failed
- Security probes: 22 passed, 3 failed
- Critical: 1
- High: 2

Critical:
[open_redirect] Unsafe redirect accepted
URL: /login?redirect=//evil.example.com
Expected: rejected
Actual: accepted
Recommendation: Use RedirectSafety or strict internal-target validation.
```

## CLI Usage

The CLI is available as `hsm` once the package is installed.

```bash
hsm test
hsm test login-flow
hsm audit
hsm audit --json
hsm audit --severity high
hsm audit --report hsm-audit.json
```

Common scripts:

```json
{
	"scripts": {
		"hsm:test": "hsm test",
		"hsm:audit": "hsm audit"
	}
}
```

Supported flags:

- `--config <path>`
- `--schema <path>`
- `--tests <glob>`
- `--json`
- `--report <path>`
- `--severity <level>`
- `--fail-on <level>`
- `--verbose`

Discovery defaults:

- `hsm.test.ts`
- `hsm.tests.ts`
- `tests/hsm/**/*.test.ts`
- `tests/hsm/**/*.hsm.ts`
- `hsm.config.ts`
- `hsm.schema.json`

## CI Guidance

Testing and audit are designed to fail CI when a finding reaches or exceeds the configured severity. Use `--fail-on` to set the threshold.

```bash
hsm audit --fail-on high --report hsm-audit.json
```

## Notes

- The audit layer is not a replacement for full security testing. It detects common schema/runtime drift, route/auth regressions, and redirect mistakes.
- Frontend policy is a UX boundary. Backend policy remains the security boundary.

## Book End

Return to the entry page in [HSM Docs](./README.md).
