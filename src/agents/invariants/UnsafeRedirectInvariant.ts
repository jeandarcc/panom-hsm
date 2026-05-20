import type { HsmAgentFinding, HsmAgentInvariant, HsmAgentInvariantResult } from "../types.js";
import type { HsmAgentContext } from "../HsmAgentContext.js";

const REDIRECT_KEYS = ["redirect", "returnTo", "return_to", "next", "continue", "target", "to", "dest"];

export class UnsafeRedirectInvariant implements HsmAgentInvariant {
  public readonly name = "unsafe_redirect";
  public readonly description = "Unsafe redirects must never be accepted.";
  public readonly severity = "critical" as const;

  public async run(context: HsmAgentContext): Promise<HsmAgentInvariantResult> {
    const findings: HsmAgentFinding[] = [];
    const decoded = context.snapshot?.urlState?.decoded ?? {};
    for (const key of REDIRECT_KEYS) {
      const value = decoded?.[key];
      if (!value) continue;
      const safety = context.toProbeContext().redirectSafety?.validate(String(value));
      if (safety && !safety.ok) {
        findings.push(context.toFinding({
          id: `unsafe_redirect:${key}`,
          title: "Unsafe redirect accepted",
          severity: "critical",
          category: "security",
          message: "Unsafe redirect payload was accepted by URL state.",
          recommendation: "Validate redirect targets using RedirectSafety.",
          expected: "rejected",
          actual: value,
          evidence: { key, reason: safety.reason }
        }, { action: context.lastAction }));
      }
    }

    return { ok: findings.length === 0, findings };
  }
}

export function unsafeRedirectsNeverAccepted(): UnsafeRedirectInvariant {
  return new UnsafeRedirectInvariant();
}
