import type { InjectionKey, ShallowRef } from "vue";
import type { AnyRecord, HsmSnapshot } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";

export interface HsmVueRuntime<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: HsmMachine<TContext>;
  readonly snapshot: ShallowRef<HsmSnapshot<TContext> | null>;
  readonly ready: ShallowRef<boolean>;
  readonly error: ShallowRef<unknown>;
  refresh(): void;
}

export const hsmVueRuntimeKey: InjectionKey<HsmVueRuntime<any>> = Symbol("panom-hsm-vue-runtime");
