import type { HsmAgentDestructiveMode, HsmAgentSafetyConfig, HsmAgentTarget } from "./types.js";

const DEFAULT_POLICY: Required<HsmAgentSafetyConfig> = {
  blockExternalOrigins: true,
  destructiveActions: "disabled",
  blockPaymentRoutes: true,
  blockEmailRoutes: true,
  requireAllowedOrigin: true,
  maxRequestBodyBytes: 65_536,
  maxConcurrentAgents: 50,
  allowProductionTargets: false,
  allowlistedPaths: []
};

const PAYMENT_HINTS = ["/billing", "/payments", "/checkout", "/invoice", "/subscription", "/card", "/payout"];
const EMAIL_HINTS = ["/email", "/invite", "/newsletter", "/notify", "/smtp"];

export class HsmAgentSafetyPolicy {
  public readonly config: Required<HsmAgentSafetyConfig>;

  public constructor(config?: HsmAgentSafetyConfig) {
    this.config = { ...DEFAULT_POLICY, ...(config ?? {}) };
  }

  public validateTarget(target: HsmAgentTarget): { ok: boolean; reason?: string } {
    if (!target.origin) return { ok: false, reason: "missing_origin" };
    const allowed = target.allowedOrigins ?? [target.origin];
    const origin = normalizeOrigin(target.origin);
    if (this.config.requireAllowedOrigin && !allowed.map(normalizeOrigin).includes(origin)) {
      return { ok: false, reason: "origin_not_allowlisted" };
    }
    if (this.config.blockExternalOrigins && !this.isSafeOrigin(origin) && !this.config.allowProductionTargets) {
      return { ok: false, reason: "external_origin_blocked" };
    }
    if (!this.config.allowProductionTargets && this.isProductionOrigin(origin)) {
      return { ok: false, reason: "production_origin_blocked" };
    }
    return { ok: true };
  }

  public isAllowedOrigin(origin: string, allowed: readonly string[]): boolean {
    return allowed.map(normalizeOrigin).includes(normalizeOrigin(origin));
  }

  public isDestructiveAllowed(): boolean {
    return this.config.destructiveActions !== "disabled";
  }

  public isDestructiveMethod(method?: string): boolean {
    return Boolean(method && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()));
  }

  public shouldBlockUrl(pathname: string): boolean {
    if (this.config.allowlistedPaths.some((allowed) => pathname.startsWith(allowed))) return false;
    if (this.config.blockPaymentRoutes && PAYMENT_HINTS.some((hint) => pathname.includes(hint))) return true;
    if (this.config.blockEmailRoutes && EMAIL_HINTS.some((hint) => pathname.includes(hint))) return true;
    return false;
  }

  public redactHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
    if (!headers) return undefined;
    const redacted: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (isSensitiveHeader(key)) {
        redacted[key] = "[redacted]";
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  private isSafeOrigin(origin: string): boolean {
    const host = getHost(origin);
    return isLocalHost(host) || isPrivateHost(host);
  }

  private isProductionOrigin(origin: string): boolean {
    const host = getHost(origin);
    return !isLocalHost(host) && !isPrivateHost(host);
  }
}

function normalizeOrigin(origin: string): string {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.trim();
  }
}

function getHost(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isPrivateHost(host: string): boolean {
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("172.")) {
    const segment = Number(host.split(".")[1]);
    return segment >= 16 && segment <= 31;
  }
  return false;
}

function isSensitiveHeader(key: string): boolean {
  const lowered = key.toLowerCase();
  return ["authorization", "cookie", "set-cookie", "x-api-key", "x-auth-token"].includes(lowered);
}

export function normalizeSafetyPolicy(config?: HsmAgentSafetyConfig): Required<HsmAgentSafetyConfig> {
  return { ...DEFAULT_POLICY, ...(config ?? {}) };
}

export function normalizeDestructiveMode(mode?: HsmAgentDestructiveMode): HsmAgentDestructiveMode {
  return mode ?? "disabled";
}
