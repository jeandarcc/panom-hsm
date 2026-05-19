import type {
  AnyRecord,
  HsmResolvedRedirect,
  HsmResolvedState,
  HsmSnapshot,
  HsmStateId,
  HsmStateValue
} from "./types.js";
import { HsmPath } from "./HsmPath.js";

export class SnapshotFactory<TContext extends AnyRecord = AnyRecord> {
  public constructor(private readonly machineId: string) {}

  public create(
    resolved: HsmResolvedState<TContext>,
    redirect?: HsmResolvedRedirect
  ): HsmSnapshot<TContext> {
    const stateId = resolved.node.id;
    const activeIds = resolved.activePath.map((node) => node.id);
    const tags = [...resolved.tags];
    const route = resolved.route
      ? Object.freeze({
          pattern: resolved.route.pattern,
          canonicalPattern: resolved.route.canonicalPattern,
          pathname: resolved.route.pathname,
          canonicalPathname: resolved.route.canonicalPathname,
          query: Object.freeze({ ...resolved.route.query }),
          hash: resolved.route.hash,
          matchedStateId: resolved.route.stateId,
          kind: resolved.route.kind,
          isCanonical: resolved.route.isCanonical
        })
      : undefined;
    const urlState = resolved.urlState
      ? Object.freeze({
          raw: Object.freeze({ ...resolved.urlState.raw }),
          decoded: Object.freeze({ ...resolved.urlState.decoded }),
          unknown: Object.freeze({ ...resolved.urlState.unknown }),
          projected: Object.freeze({ ...resolved.urlState.projected }),
          context: Object.freeze({ ...resolved.urlState.context })
        })
      : undefined;

    const data = resolved.data ? this.freezeRecord(resolved.data) : undefined;
    const policy = resolved.policy ? this.freezePolicy(resolved.policy) : undefined;

    const snapshot: HsmSnapshot<TContext> = {
      machineId: this.machineId,
      stateId,
      value: this.toStateValue(stateId),
      context: Object.freeze({ ...resolved.context }),
      params: Object.freeze({ ...resolved.params }),
      meta: Object.freeze({ ...resolved.meta }),
      tags: Object.freeze(tags),
      activePath: Object.freeze(activeIds),
      ...(route ? { route } : {}),
      ...(urlState ? { urlState } : {}),
      ...(data ? { data } : {}),
      ...(policy ? { policy } : {}),
      ...(redirect ? { redirect } : {}),
      is: (candidate: HsmStateId) => HsmPath.isAncestor(candidate, stateId),
      hasTag: (tag: string) => tags.includes(tag),
      can: (permission: string) => policy?.decisions.permissions[permission]?.allowed ?? false,
      canUse: (capability: string) => policy?.decisions.capabilities[capability]?.allowed ?? false,
      feature: (feature: string) => policy?.decisions.features[feature]?.allowed ?? false
    };

    return Object.freeze(snapshot);
  }

  private freezeRecord(input: AnyRecord): Readonly<AnyRecord> {
    const output: AnyRecord = {};
    for (const [key, value] of Object.entries(input)) {
      output[key] = value && typeof value === "object" && !Array.isArray(value)
        ? Object.freeze({ ...(value as AnyRecord) })
        : value;
    }
    return Object.freeze(output);
  }

  private freezePolicy(policy: NonNullable<HsmResolvedState<TContext>["policy"]>): NonNullable<HsmSnapshot<TContext>["policy"]> {
    const freezeDecisionMap = (input: Readonly<Record<string, any>>): Readonly<Record<string, any>> => {
      const output: Record<string, any> = {};
      for (const [key, value] of Object.entries(input)) {
        output[key] = Object.freeze({
          ...value,
          inheritedFrom: Object.freeze([...(value.inheritedFrom ?? [])]),
          deniedBy: Object.freeze([...(value.deniedBy ?? [])])
        });
      }
      return Object.freeze(output);
    };

    return Object.freeze({
      permissions: Object.freeze([...policy.permissions]),
      capabilities: Object.freeze([...policy.capabilities]),
      features: Object.freeze([...policy.features]),
      deniedPermissions: Object.freeze([...policy.deniedPermissions]),
      deniedCapabilities: Object.freeze([...policy.deniedCapabilities]),
      deniedFeatures: Object.freeze([...policy.deniedFeatures]),
      ...(policy.layout ? { layout: policy.layout } : {}),
      decisions: Object.freeze({
        permissions: freezeDecisionMap(policy.decisions.permissions),
        capabilities: freezeDecisionMap(policy.decisions.capabilities),
        features: freezeDecisionMap(policy.decisions.features)
      })
    });
  }

  private toStateValue(stateId: HsmStateId): HsmStateValue {
    const parts = HsmPath.split(stateId);
    let value: HsmStateValue | undefined;

    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const part = parts[index];
      if (!part) continue;
      value = value === undefined ? part : { [part]: value };
    }

    return value ?? stateId;
  }
}
