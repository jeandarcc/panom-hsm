import type { AnyRecord } from "../../core/types.js";
import type { HsmAgentProfile } from "../types.js";

export const AgentProfiles = {
  anonymous<TContext extends AnyRecord = AnyRecord>(): HsmAgentProfile<TContext> {
    return {
      name: "anonymous",
      context: {} as TContext,
      risk: "low",
      requiresAccount: false
    };
  },
  user<TContext extends AnyRecord = AnyRecord>(): HsmAgentProfile<TContext> {
    return {
      name: "user",
      context: { user: { id: "user", role: "user" } } as TContext,
      risk: "medium",
      requiresAccount: true
    };
  },
  owner<TContext extends AnyRecord = AnyRecord>(): HsmAgentProfile<TContext> {
    return {
      name: "owner",
      context: { user: { id: "owner", role: "owner" } } as TContext,
      risk: "medium",
      requiresAccount: true
    };
  },
  lowPrivilege<TContext extends AnyRecord = AnyRecord>(): HsmAgentProfile<TContext> {
    return {
      name: "lowPrivilege",
      context: { user: { id: "viewer", role: "viewer" } } as TContext,
      risk: "low",
      requiresAccount: false
    };
  },
  expiredSession<TContext extends AnyRecord = AnyRecord>(): HsmAgentProfile<TContext> {
    return {
      name: "expiredSession",
      context: { user: null, session: { expired: true } } as TContext,
      risk: "low",
      requiresAccount: false
    };
  },
  quotaExceeded<TContext extends AnyRecord = AnyRecord>(): HsmAgentProfile<TContext> {
    return {
      name: "quotaExceeded",
      context: { user: { id: "user", role: "user" }, quota: { exceeded: true } } as TContext,
      risk: "medium",
      requiresAccount: true
    };
  },
  admin<TContext extends AnyRecord = AnyRecord>(): HsmAgentProfile<TContext> {
    return {
      name: "admin",
      context: { user: { id: "admin", role: "admin" } } as TContext,
      risk: "high",
      requiresAccount: true
    };
  }
};
