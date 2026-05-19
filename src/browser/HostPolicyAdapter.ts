import {
  createSubdomainPolicyRuntime,
  type NavigationTarget,
  type SubdomainPolicyRuntime,
  type SubdomainPolicyRuntimeDependencies
} from "@panomapp/subdomain-policy/runtime";
import type { HsmSnapshot } from "../core/types.js";
import type { HostPolicyAdapterOptions, RedirectSafetyResult } from "./types.js";
import { RedirectSafety } from "./RedirectSafety.js";

function isRuntime(value: SubdomainPolicyRuntime | SubdomainPolicyRuntimeDependencies): value is SubdomainPolicyRuntime {
  return Boolean(value && typeof value === "object" && "getCanonicalNavigationTarget" in value && "registry" in value);
}

function snapshotFullPath(snapshot: HsmSnapshot): string {
  const route = snapshot.route;
  if (!route) return "/";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(route.query ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
    } else {
      query.set(key, String(value));
    }
  }
  const search = query.toString();
  const hash = route.hash ? `#${route.hash}` : "";
  return `${route.canonicalPathname || route.pathname}${search ? `?${search}` : ""}${hash}`;
}

function configuredHostnames(runtime: SubdomainPolicyRuntime): readonly string[] {
  return Object.freeze([
    runtime.rootHostname,
    ...runtime.registry.all().map((policy) => `${policy.subdomain}.${runtime.rootHostname}`)
  ]);
}

/**
 * Bridge between panom-hsm snapshots and @panomapp/subdomain-policy.
 */
export class HostPolicyAdapter {
  public readonly runtime: SubdomainPolicyRuntime;
  private readonly strictRedirectSafety: boolean;

  public constructor(options: HostPolicyAdapterOptions | SubdomainPolicyRuntime | SubdomainPolicyRuntimeDependencies) {
    if ("runtime" in options) {
      this.runtime = options.runtime;
      this.strictRedirectSafety = options.strictRedirectSafety ?? true;
    } else {
      this.runtime = isRuntime(options) ? options : createSubdomainPolicyRuntime(options);
      this.strictRedirectSafety = true;
    }
  }

  public get allowedHostnames(): readonly string[] {
    return configuredHostnames(this.runtime);
  }

  public getPolicyForHostname(hostname: string) {
    return this.runtime.getPolicyForHostname(hostname);
  }

  public getPolicyForState(stateId: string) {
    return this.runtime.getPolicyForRouteName(stateId);
  }

  public isStateHandledBySubdomain(stateId: string, subdomain: string): boolean {
    return this.runtime.isRouteHandledBySubdomain(stateId, subdomain);
  }

  public getPolicyLandingUrl(subdomain: string): string {
    return this.runtime.getPolicyLandingUrl(subdomain);
  }

  public getPolicyLandingUrlForState(stateId: string): string {
    return this.runtime.getPolicyLandingUrlForRoute(stateId);
  }

  public buildAbsoluteUrlForState(stateId: string, path = "/"): string {
    return this.runtime.buildAbsolutePolicyUrlForRoute(stateId, path);
  }

  public getSocketServerOrigin(stateId?: string): string {
    return this.runtime.getSocketServerOrigin(stateId);
  }

  public getAuthEntryUrl(): string {
    return this.runtime.getAuthEntryUrl();
  }

  public getCanonicalTarget(hostname: string, snapshot: HsmSnapshot): NavigationTarget | null {
    if (!snapshot.route) return null;
    return this.runtime.getCanonicalNavigationTarget(hostname, {
      name: snapshot.stateId,
      fullPath: snapshotFullPath(snapshot),
      path: snapshot.route.canonicalPathname || snapshot.route.pathname
    });
  }

  public rememberPostAuthRedirect(target: string, currentOrigin?: string, currentHostname?: string): RedirectSafetyResult {
    const safety = this.redirectSafety(currentOrigin, currentHostname);
    const result = safety.validate(target);
    if (result.ok || !this.strictRedirectSafety) {
      this.runtime.rememberPostAuthRedirect(result.ok ? result.normalized : target);
    }
    return result;
  }

  public peekSafePostAuthRedirect(currentOrigin?: string, currentHostname?: string): NavigationTarget | null {
    const target = this.runtime.peekSafePostAuthRedirect();
    if (!target || !this.strictRedirectSafety) return target;
    const safety = this.redirectSafety(currentOrigin, currentHostname);
    return safety.validate(target.to).ok ? target : null;
  }

  public consumeSafePostAuthRedirect(currentOrigin?: string, currentHostname?: string): NavigationTarget | null {
    const target = this.runtime.consumeSafePostAuthRedirect();
    if (!target || !this.strictRedirectSafety) return target;
    const safety = this.redirectSafety(currentOrigin, currentHostname);
    return safety.validate(target.to).ok ? target : null;
  }

  public isDebugEnabled(): boolean {
    return this.runtime.isSubdomainDebugEnabled();
  }

  public debug(event: string, payload: Record<string, unknown>): void {
    this.runtime.logSubdomainDebug(event, payload);
  }

  public redirectSafety(currentOrigin?: string, currentHostname?: string): RedirectSafety {
    const options: import("./types.js").RedirectSafetyOptions = {
      rootHostname: this.runtime.rootHostname,
      allowedHostnames: this.allowedHostnames
    };
    if (currentOrigin !== undefined) Object.assign(options, { currentOrigin });
    if (currentHostname !== undefined) Object.assign(options, { currentHostname });
    return new RedirectSafety(options);
  }
}

export function createHostPolicyAdapter(
  options: HostPolicyAdapterOptions | SubdomainPolicyRuntime | SubdomainPolicyRuntimeDependencies
): HostPolicyAdapter {
  return new HostPolicyAdapter(options);
}
