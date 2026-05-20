import type { AnyRecord, HsmSnapshot, HsmTransitionResult } from "../core/types.js";
import type {
  HsmFinding,
  HsmFindingSeverity,
  HsmRuntimeAdapter,
  HsmTestExpectation
} from "./types.js";

interface AssertionContext<TContext extends AnyRecord = AnyRecord> {
  readonly testName: string;
  readonly stepIndex: number;
  readonly stepType: string;
  readonly severity: HsmFindingSeverity;
  readonly snapshot: HsmSnapshot<TContext> | null;
  readonly transition?: HsmTransitionResult<TContext> | null;
  readonly adapter: HsmRuntimeAdapter<TContext>;
  readonly lastUrl?: string | null;
  readonly backendMethods?: readonly string[];
  readonly redirectSafety?: { validate: (input: string) => { ok: boolean; normalized?: string; reason?: string } };
}

export class HsmAssertions {
  public static evaluate<TContext extends AnyRecord = AnyRecord>(
    expect: HsmTestExpectation,
    context: AssertionContext<TContext>
  ): HsmFinding[] {
    const findings: HsmFinding[] = [];
    const snapshot = context.snapshot;
    const transition = context.transition ?? undefined;

    const fail = (title: string, message: string, expected?: unknown, actual?: unknown, recommendation?: string) => {
      findings.push({
        id: `${context.testName}:${context.stepIndex}:${title}`,
        title,
        severity: context.severity,
        category: "assertion",
        testName: context.testName,
        stepIndex: context.stepIndex,
        expected,
        actual,
        message,
        recommendation,
        stateId: snapshot?.stateId,
        route: snapshot?.route?.pathname,
        url: context.lastUrl ?? undefined
      });
    };

    if (expect.state) {
      if (!snapshot) {
        fail("missing_snapshot", "Expected a resolved snapshot, but none was available.", expect.state, null);
      } else if (snapshot.stateId !== expect.state) {
        fail("state_mismatch", `Expected state ${expect.state} but resolved ${snapshot.stateId}.`, expect.state, snapshot.stateId);
      }
    }

    if (expect.notState && snapshot?.stateId === expect.notState) {
      fail("unexpected_state", `State ${expect.notState} should not be active.`, expect.notState, snapshot.stateId);
    }

    if (expect.denied !== undefined) {
      const denied = transition ? !transition.ok : false;
      if (expect.denied !== denied) {
        fail("denied_mismatch", `Expected denied=${expect.denied} but got ${denied}.`, expect.denied, denied);
      }
    }

    if (expect.redirectTo) {
      const redirect = transition && transition.ok ? transition.redirect : snapshot?.redirect;
      if (!redirect) {
        fail("missing_redirect", "Expected a redirect, but no redirect was emitted.", expect.redirectTo, null);
      } else if (redirect.to !== expect.redirectTo) {
        fail("redirect_mismatch", "Redirect target did not match expected value.", expect.redirectTo, redirect.to);
      }
    }

    if (expect.permissions) {
      if (!snapshot?.policy) {
        fail("permissions_missing", "Expected permissions but policy snapshot was unavailable.", expect.permissions, null);
      } else {
        const missing = expect.permissions.filter((perm) => !snapshot.policy?.permissions.includes(perm));
        if (missing.length > 0) {
          fail("permissions_missing", "Expected permissions are missing.", expect.permissions, snapshot.policy?.permissions, "Ensure guards/policies grant the permission.");
        }
      }
    }

    if (expect.notPermissions) {
      if (!snapshot?.policy) {
        fail("permissions_unexpected", "Expected permissions to be denied but policy snapshot was unavailable.", expect.notPermissions, null);
      } else {
        const present = expect.notPermissions.filter((perm) => snapshot.policy?.permissions.includes(perm));
        if (present.length > 0) {
          fail("permissions_unexpected", "Permissions should be denied but are allowed.", expect.notPermissions, snapshot.policy?.permissions, "Ensure denyPermissions or guard rules are applied.");
        }
      }
    }

    if (expect.capabilities) {
      if (!snapshot?.policy) {
        fail("capabilities_missing", "Expected capabilities but policy snapshot was unavailable.", expect.capabilities, null);
      } else {
        const missing = expect.capabilities.filter((cap) => !snapshot.policy?.capabilities.includes(cap));
        if (missing.length > 0) {
          fail("capabilities_missing", "Expected capabilities are missing.", expect.capabilities, snapshot.policy?.capabilities);
        }
      }
    }

    if (expect.features) {
      if (!snapshot?.policy) {
        fail("features_missing", "Expected features but policy snapshot was unavailable.", expect.features, null);
      } else {
        const missing = expect.features.filter((feature) => !snapshot.policy?.features.includes(feature));
        if (missing.length > 0) {
          fail("features_missing", "Expected features are missing.", expect.features, snapshot.policy?.features);
        }
      }
    }

    if (expect.layout !== undefined) {
      const layout = snapshot?.policy?.layout;
      if (layout !== expect.layout) {
        fail("layout_mismatch", "Layout did not match expected value.", expect.layout, layout);
      }
    }

    if (expect.params) {
      if (!snapshot) {
        fail("missing_snapshot", "Expected params but no snapshot was available.", expect.params, null);
      } else if (!this.matchesSubset(snapshot.params, expect.params)) {
        fail("params_mismatch", "Resolved params did not match expected values.", expect.params, snapshot.params);
      }
    }

    if (expect.query) {
      const actual = snapshot?.urlState?.decoded ?? snapshot?.route?.query ?? {};
      if (!this.matchesSubset(actual, expect.query)) {
        fail("query_mismatch", "Resolved query did not match expected values.", expect.query, actual);
      }
    }

    if (expect.context) {
      if (!snapshot) {
        fail("missing_snapshot", "Expected context but no snapshot was available.", expect.context, null);
      } else if (!this.matchesSubset(snapshot.context as AnyRecord, expect.context)) {
        fail("context_mismatch", "Resolved context did not match expected values.", expect.context, snapshot.context);
      }
    }

    if (expect.backendAllowed) {
      if (!context.backendMethods) {
        fail("backend_allowed_mismatch", "Backend policy metadata was unavailable.", expect.backendAllowed, null);
      } else {
        const denied = expect.backendAllowed.filter((method) => !context.backendMethods?.includes(method.toUpperCase()));
        if (denied.length > 0) {
          fail("backend_allowed_mismatch", "Backend methods expected to be allowed were denied.", expect.backendAllowed, context.backendMethods);
        }
      }
    }

    if (expect.backendDenied) {
      if (!context.backendMethods) {
        fail("backend_denied_mismatch", "Backend policy metadata was unavailable.", expect.backendDenied, null);
      } else {
        const allowed = expect.backendDenied.filter((method) => context.backendMethods?.includes(method.toUpperCase()));
        if (allowed.length > 0) {
          fail("backend_denied_mismatch", "Backend methods expected to be denied were allowed.", expect.backendDenied, context.backendMethods);
        }
      }
    }

    if (expect.urlSafe !== undefined && context.lastUrl) {
      const safety = context.redirectSafety?.validate(context.lastUrl);
      if (expect.urlSafe && safety && !safety.ok) {
        fail("unsafe_url", "URL failed redirect safety validation.", true, safety.reason, "Use RedirectSafety or sanitize redirect inputs.");
      }
      if (!expect.urlSafe && safety && safety.ok) {
        fail("unsafe_url_expected", "URL should be considered unsafe but passed validation.", false, true);
      }
    }

    if (expect.canonicalUrl) {
      if (!snapshot || !context.lastUrl) {
        fail("missing_canonical", "Expected canonical URL, but no snapshot or URL was available.", expect.canonicalUrl, null);
      } else {
        const canonical = context.adapter.syncUrl(context.lastUrl, snapshot.context as TContext, { canonicalizePath: true });
        if (canonical !== expect.canonicalUrl) {
          fail("canonical_mismatch", "Canonical URL did not match expected value.", expect.canonicalUrl, canonical);
        }
      }
    }

    return findings;
  }

  private static matchesSubset(base: AnyRecord, expected: AnyRecord): boolean {
    for (const [key, value] of Object.entries(expected)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const child = base[key];
        if (!child || typeof child !== "object") return false;
        if (!this.matchesSubset(child as AnyRecord, value as AnyRecord)) return false;
      } else if (Array.isArray(value)) {
        if (!Array.isArray(base[key])) return false;
        if (value.some((item, index) => base[key]?.[index] !== item)) return false;
      } else if (base[key] !== value) {
        return false;
      }
    }
    return true;
  }
}
