import { computed } from "vue";
import type { AnyRecord } from "../core/types.js";
import { useHsmRuntime } from "./useHsm.js";

export function useHsmState<TContext extends AnyRecord = AnyRecord>() {
  const runtime = useHsmRuntime<TContext>();
  return {
    snapshot: runtime.snapshot,
    ready: runtime.ready,
    error: runtime.error,
    stateId: computed(() => runtime.snapshot.value?.stateId ?? null),
    context: computed(() => runtime.snapshot.value?.context ?? null),
    params: computed(() => runtime.snapshot.value?.params ?? null),
    route: computed(() => runtime.snapshot.value?.route ?? null),
    is: (stateId: string) => runtime.snapshot.value?.is(stateId) ?? false,
    hasTag: (tag: string) => runtime.snapshot.value?.hasTag(tag) ?? false,
    refresh: runtime.refresh
  };
}
