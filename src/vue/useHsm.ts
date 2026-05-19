import { inject } from "vue";
import type { AnyRecord } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import { hsmVueRuntimeKey, type HsmVueRuntime } from "./symbols.js";

export function useHsmRuntime<TContext extends AnyRecord = AnyRecord>(): HsmVueRuntime<TContext> {
  const runtime = inject(hsmVueRuntimeKey, null) as HsmVueRuntime<TContext> | null;
  if (!runtime) {
    throw new Error("panom-hsm Vue runtime was not provided. Install createHsmVue({ hsm }) on the app first.");
  }
  return runtime;
}

export function useHsm<TContext extends AnyRecord = AnyRecord>(): HsmMachine<TContext> {
  return useHsmRuntime<TContext>().hsm;
}
