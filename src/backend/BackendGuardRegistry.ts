import type { AnyRecord, HsmGuardMap } from "../core/types.js";
import { GuardRegistry } from "../guards/GuardRegistry.js";

export class BackendGuardRegistry<TContext extends AnyRecord = AnyRecord> extends GuardRegistry<TContext> {
  public constructor(guards: HsmGuardMap<TContext> = {}) {
    super(guards);
  }
}
