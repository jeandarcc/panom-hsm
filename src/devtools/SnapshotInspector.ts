import type { AnyRecord, HsmSnapshot } from "../core/types.js";

export interface SnapshotInspection {
  readonly stateId: string;
  readonly activePath: readonly string[];
  readonly params: Readonly<AnyRecord>;
  readonly tags: readonly string[];
  readonly route?: {
    readonly pathname: string;
    readonly canonicalPathname: string;
    readonly pattern: string;
    readonly isCanonical: boolean;
  };
  readonly policy?: {
    readonly layout?: string;
    readonly permissions: readonly string[];
    readonly capabilities: readonly string[];
    readonly features: readonly string[];
    readonly deniedPermissions: readonly string[];
    readonly deniedCapabilities: readonly string[];
    readonly deniedFeatures: readonly string[];
  };
}

export class SnapshotInspector {
  public inspect(snapshot: HsmSnapshot): SnapshotInspection {
    const route = snapshot.route
      ? {
          pathname: snapshot.route.pathname,
          canonicalPathname: snapshot.route.canonicalPathname,
          pattern: snapshot.route.pattern,
          isCanonical: snapshot.route.isCanonical
        }
      : undefined;

    const policy = snapshot.policy
      ? {
          ...(snapshot.policy.layout ? { layout: snapshot.policy.layout } : {}),
          permissions: snapshot.policy.permissions,
          capabilities: snapshot.policy.capabilities,
          features: snapshot.policy.features,
          deniedPermissions: snapshot.policy.deniedPermissions,
          deniedCapabilities: snapshot.policy.deniedCapabilities,
          deniedFeatures: snapshot.policy.deniedFeatures
        }
      : undefined;

    return Object.freeze({
      stateId: snapshot.stateId,
      activePath: snapshot.activePath,
      params: snapshot.params,
      tags: snapshot.tags,
      ...(route ? { route } : {}),
      ...(policy ? { policy } : {})
    });
  }
}
