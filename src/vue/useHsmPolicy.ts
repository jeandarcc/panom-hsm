import { computed } from "vue";
import type { AnyRecord } from "../core/types.js";
import { useHsmRuntime } from "./useHsm.js";

export function useHsmPolicy<TContext extends AnyRecord = AnyRecord>() {
  const runtime = useHsmRuntime<TContext>();
  return {
    policy: computed(() => runtime.snapshot.value?.policy ?? null),
    layout: computed(() => runtime.snapshot.value?.policy?.layout),
    permissions: computed(() => runtime.snapshot.value?.policy?.permissions ?? []),
    capabilities: computed(() => runtime.snapshot.value?.policy?.capabilities ?? []),
    features: computed(() => runtime.snapshot.value?.policy?.features ?? []),
    can: (permission: string) => runtime.snapshot.value?.can(permission) ?? false,
    canUse: (capability: string) => runtime.snapshot.value?.canUse(capability) ?? false,
    feature: (feature: string) => runtime.snapshot.value?.feature(feature) ?? false
  };
}
