import type { AnyRecord } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";

export interface HsmAgentRuntimeAdapter<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: HsmMachine<TContext>;
  readonly hsmId: string;
  readonly resolveUrl: (url: string, options?: AnyRecord) => Promise<AnyRecord>;
  readonly transitionUrl: (url: string, options?: AnyRecord) => Promise<AnyRecord>;
  readonly transition: (stateId: string, options?: AnyRecord) => Promise<AnyRecord>;
  readonly send: (event: string, payload: unknown, options?: AnyRecord) => Promise<AnyRecord>;
  readonly href: (stateId: string, params?: AnyRecord, options?: AnyRecord) => string;
  readonly syncUrl: (url: string, context: TContext, options?: AnyRecord) => string;
  readonly routes: () => readonly AnyRecord[];
  readonly states: () => readonly string[];
}

export function createHsmAgentRuntimeAdapter<TContext extends AnyRecord = AnyRecord>(
  hsm: HsmMachine<TContext>
): HsmAgentRuntimeAdapter<TContext> {
  return {
    hsm,
    hsmId: hsm.id,
    resolveUrl: (url: string, options?: AnyRecord) => hsm.resolveUrl(url, options),
    transitionUrl: (url: string, options?: AnyRecord) => hsm.transitionUrl(url, options),
    transition: (stateId: string, options?: AnyRecord) => hsm.transition(stateId, options),
    send: (event: string, payload: unknown, options?: AnyRecord) => hsm.send(event, payload, options),
    href: (stateId: string, params?: AnyRecord, options?: AnyRecord) => hsm.href(stateId, params, options),
    syncUrl: (url: string, context: TContext, options?: AnyRecord) => hsm.syncUrl(url, context, options),
    routes: () => hsm.routes(),
    states: () => hsm.states()
  };
}
