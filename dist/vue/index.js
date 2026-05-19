import { defineComponent, computed, h, inject, shallowRef } from 'vue';

// src/vue/createHsmVue.ts

// src/vue/symbols.ts
var hsmVueRuntimeKey = /* @__PURE__ */ Symbol("panom-hsm-vue-runtime");

// src/vue/createHsmVue.ts
function readCurrent(hsm) {
  return hsm.current;
}
function updateSnapshot(hsm, snapshot, ready, error, caught) {
  if (caught !== void 0) {
    error.value = caught;
    return;
  }
  snapshot.value = readCurrent(hsm);
  ready.value = snapshot.value !== null;
  error.value = null;
}
function patchAsyncMethod(hsm, methodName, snapshot, ready, error, onError) {
  const target = hsm;
  const original = target[methodName];
  if (typeof original !== "function") return;
  if (original.__panomHsmVuePatched) return;
  const wrapped = async (...args) => {
    try {
      const result = await original.apply(hsm, args);
      const maybeTransition = result;
      if (maybeTransition && typeof maybeTransition === "object" && "ok" in maybeTransition) {
        if (maybeTransition.ok) {
          snapshot.value = maybeTransition.snapshot;
          ready.value = true;
          error.value = null;
        } else {
          updateSnapshot(hsm, snapshot, ready, error, maybeTransition.error);
          onError?.(maybeTransition.error);
        }
      } else {
        updateSnapshot(hsm, snapshot, ready, error);
      }
      return result;
    } catch (caught) {
      updateSnapshot(hsm, snapshot, ready, error, caught);
      onError?.(caught);
      throw caught;
    }
  };
  Object.defineProperty(wrapped, "__panomHsmVuePatched", { value: true });
  target[methodName] = wrapped;
}
function createHsmVueRuntime(options) {
  const snapshot = shallowRef(options.hsm.current);
  const ready = shallowRef(snapshot.value !== null);
  const error = shallowRef(null);
  const runtime = {
    hsm: options.hsm,
    snapshot,
    ready,
    error,
    refresh() {
      updateSnapshot(options.hsm, snapshot, ready, error);
    }
  };
  if (options.bindTransitions ?? true) {
    patchAsyncMethod(options.hsm, "start", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "transition", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "transitionUrl", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "navigate", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "send", snapshot, ready, error, options.onError);
  }
  return runtime;
}
function createHsmVue(options) {
  const runtime = createHsmVueRuntime(options);
  return {
    runtime,
    install(app) {
      app.provide(hsmVueRuntimeKey, runtime);
      app.config.globalProperties.$hsm = runtime.hsm;
    }
  };
}
function useHsmRuntime() {
  const runtime = inject(hsmVueRuntimeKey, null);
  if (!runtime) {
    throw new Error("panom-hsm Vue runtime was not provided. Install createHsmVue({ hsm }) on the app first.");
  }
  return runtime;
}
function useHsm() {
  return useHsmRuntime().hsm;
}
function useHsmState() {
  const runtime = useHsmRuntime();
  return {
    snapshot: runtime.snapshot,
    ready: runtime.ready,
    error: runtime.error,
    stateId: computed(() => runtime.snapshot.value?.stateId ?? null),
    context: computed(() => runtime.snapshot.value?.context ?? null),
    params: computed(() => runtime.snapshot.value?.params ?? null),
    route: computed(() => runtime.snapshot.value?.route ?? null),
    is: (stateId) => runtime.snapshot.value?.is(stateId) ?? false,
    hasTag: (tag) => runtime.snapshot.value?.hasTag(tag) ?? false,
    refresh: runtime.refresh
  };
}
function useHsmPolicy() {
  const runtime = useHsmRuntime();
  return {
    policy: computed(() => runtime.snapshot.value?.policy ?? null),
    layout: computed(() => runtime.snapshot.value?.policy?.layout),
    permissions: computed(() => runtime.snapshot.value?.policy?.permissions ?? []),
    capabilities: computed(() => runtime.snapshot.value?.policy?.capabilities ?? []),
    features: computed(() => runtime.snapshot.value?.policy?.features ?? []),
    can: (permission) => runtime.snapshot.value?.can(permission) ?? false,
    canUse: (capability) => runtime.snapshot.value?.canUse(capability) ?? false,
    feature: (feature) => runtime.snapshot.value?.feature(feature) ?? false
  };
}
var MachineOutlet = defineComponent({
  name: "MachineOutlet",
  props: {
    components: {
      type: Object,
      default: () => ({})
    },
    fallback: {
      type: [Object, Function, String],
      default: null
    }
  },
  setup(props, { slots }) {
    const state = useHsmState();
    const selected = computed(() => {
      const snapshot = state.snapshot.value;
      if (!snapshot) return null;
      return props.components[snapshot.stateId] ?? null;
    });
    return () => {
      const snapshot = state.snapshot.value;
      if (!snapshot) return null;
      const slotProps = { snapshot, stateId: snapshot.stateId };
      if (slots.default) return slots.default(slotProps);
      const component = selected.value ?? props.fallback;
      return component ? h(component, { snapshot, stateId: snapshot.stateId }) : null;
    };
  }
});

export { MachineOutlet, createHsmVue, createHsmVueRuntime, hsmVueRuntimeKey, useHsm, useHsmPolicy, useHsmRuntime, useHsmState };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map