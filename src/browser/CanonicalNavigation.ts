import type { HsmSnapshot } from "../core/types.js";
import type { BrowserHistoryAdapter } from "./BrowserHistoryAdapter.js";
import type { CanonicalNavigationOptions, NavigationTarget } from "./types.js";
import type { HostPolicyAdapter } from "./HostPolicyAdapter.js";

/** Applies host-aware canonical navigation decisions returned by subdomain-policy. */
export class CanonicalNavigation {
  public constructor(
    private readonly hostPolicy: HostPolicyAdapter | null,
    private readonly history: BrowserHistoryAdapter
  ) {}

  public targetFor(snapshot: HsmSnapshot, options: CanonicalNavigationOptions = {}): NavigationTarget | null {
    if (!this.hostPolicy) return null;
    const hostname = options.hostname ?? this.history.current().hostname;
    return this.hostPolicy.getCanonicalTarget(hostname, snapshot);
  }

  public apply(snapshot: HsmSnapshot, options: CanonicalNavigationOptions = {}): NavigationTarget | null {
    const target = this.targetFor(snapshot, options);
    if (!target) return null;

    if (target.type === "internal") {
      this.history.commit({
        mode: options.replace ?? true ? "replace" : "push",
        source: "canonical",
        url: target.to
      });
    }

    return target;
  }
}
