import type { HsmSchema } from "../../schema/HsmSchema.js";
import type { HsmFinding, HsmProbeContext, HsmSecurityProbe } from "../types.js";
import { buildFinding } from "./ProbeUtils.js";

const REDIRECT_KEYS = ["redirect", "returnTo", "return_to", "next", "continue", "target", "to", "dest"];

const PAYLOADS = [
  "https://evil.example.com",
  "//evil.example.com",
  "/\\evil.example.com",
  "/\\\\evil.example.com",
  "%2F%2Fevil.example.com",
  "%5C%5Cevil.example.com",
  "https:%2F%2Fevil.example.com",
  "javascript:alert(1)",
  "data:text/html,evil",
  "http://evil.example.com",
  "https://example.com.evil.example.com"
];

const SAFE_TARGETS = ["/profile/yusuf", "/cloud/media", "/login"];

export interface OpenRedirectProbeOptions {
  readonly keys?: readonly string[];
}

export class OpenRedirectProbe implements HsmSecurityProbe {
  public readonly name = "open_redirect";
  public readonly description = "Detect unsafe redirect values accepted through query-bound state.";
  public readonly defaultSeverity = "critical" as const;

  public constructor(private readonly options: OpenRedirectProbeOptions = {}) {}

  public async run(context: HsmProbeContext): Promise<readonly HsmFinding[]> {
    const findings: HsmFinding[] = [];
    const keys = this.options.keys ?? REDIRECT_KEYS;
    const schema = context.schema as HsmSchema | undefined;
    const bindingKeys = schema?.query ? Object.keys(schema.query) : keys;
    const targets = bindingKeys.filter((key) => keys.includes(key));

    if (targets.length === 0) return findings;

    const baseRoute = context.adapter.routes()[0] as { canonicalPattern?: string; pattern?: string } | undefined;
    const basePath = baseRoute?.canonicalPattern ?? baseRoute?.pattern ?? "/";

    for (const key of targets) {
      for (const payload of PAYLOADS) {
        const url = `${basePath}?${encodeURIComponent(key)}=${encodeURIComponent(payload)}`;
        try {
          const snapshot = await context.adapter.resolveUrl(url, { context: context.contextProfiles.anonymous ?? {} });
          const accepted = snapshot.urlState?.decoded?.[key];
          if (!accepted) continue;

          const safety = context.redirectSafety?.validate(String(accepted));
          if (safety && !safety.ok) {
            findings.push(buildFinding({
              id: `open-redirect:${key}:${payload}`,
              title: "Unsafe redirect accepted",
              severity: safety.reason === "encoded_protocol_relative" ? "high" : "critical",
              category: "security",
              message: `Query key "${key}" accepted an unsafe redirect target.`,
              recommendation: "Use RedirectSafety or strict internal-target validation before applying redirects.",
              expected: "rejected",
              actual: accepted,
              probeName: this.name,
              url,
              evidence: { key, payload, reason: safety.reason }
            }));
          }
        } catch {
          // Ignore route failures; focus on acceptance of unsafe values.
        }
      }

      for (const safe of SAFE_TARGETS) {
        const url = `${basePath}?${encodeURIComponent(key)}=${encodeURIComponent(safe)}`;
        try {
          const snapshot = await context.adapter.resolveUrl(url, { context: context.contextProfiles.anonymous ?? {} });
          const accepted = snapshot.urlState?.decoded?.[key];
          const safety = context.redirectSafety?.validate(String(accepted));
          if (accepted && safety && !safety.ok) {
            findings.push(buildFinding({
              id: `open-redirect:safe:${key}:${safe}`,
              title: "Safe redirect rejected",
              severity: "medium",
              category: "security",
              message: `Query key "${key}" rejected a safe internal redirect target.`,
              recommendation: "Ensure internal redirects pass RedirectSafety validation.",
              expected: "accepted",
              actual: accepted,
              probeName: this.name,
              url,
              evidence: { key, safe, reason: safety.reason }
            }));
          }
        } catch {
          // Ignore route failures; focus on acceptance of unsafe values.
        }
      }
    }

    return findings;
  }
}

export function openRedirect(options?: OpenRedirectProbeOptions): OpenRedirectProbe {
  return new OpenRedirectProbe(options);
}
