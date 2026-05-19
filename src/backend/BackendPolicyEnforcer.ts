import type { AnyRecord, HsmPolicyKind, HsmSnapshot } from "../core/types.js";
import type { HsmBackendResolveFailureReason } from "./types.js";

export interface BackendPolicyFailure {
  readonly reason: HsmBackendResolveFailureReason;
  readonly status: number;
  readonly message: string;
  readonly kind: HsmPolicyKind;
  readonly key: string;
}

export class BackendPolicyEnforcer<TContext extends AnyRecord = AnyRecord> {
  public checkAll(snapshot: HsmSnapshot<TContext>, requirements: {
    readonly permissions?: string | readonly string[];
    readonly capabilities?: string | readonly string[];
    readonly features?: string | readonly string[];
  }): BackendPolicyFailure | null {
    const permission = this.check(snapshot, "permission", requirements.permissions);
    if (permission) return permission;
    const capability = this.check(snapshot, "capability", requirements.capabilities);
    if (capability) return capability;
    return this.check(snapshot, "feature", requirements.features);
  }

  private check(
    snapshot: HsmSnapshot<TContext>,
    kind: HsmPolicyKind,
    required: string | readonly string[] | undefined
  ): BackendPolicyFailure | null {
    if (!required) return null;
    const keys = Array.isArray(required) ? required : [required];
    for (const key of keys) {
      const allowed = kind === "permission"
        ? snapshot.can(key)
        : kind === "capability"
          ? snapshot.canUse(key)
          : snapshot.feature(key);
      if (!allowed) return this.failure(kind, key, snapshot.stateId);
    }
    return null;
  }

  private failure(kind: HsmPolicyKind, key: string, stateId: string): BackendPolicyFailure {
    const reason = kind === "permission"
      ? "permission_denied"
      : kind === "capability"
        ? "capability_unavailable"
        : "feature_disabled";
    return Object.freeze({
      reason,
      status: 403,
      kind,
      key,
      message: `${kind} "${key}" is not allowed for resolved state "${stateId}".`
    });
  }
}
