import { computed, defineComponent, h, type Component, type PropType } from "vue";
import type { AnyRecord, HsmSnapshot } from "../core/types.js";
import { useHsmState } from "./useHsmState.js";

export interface MachineOutletSlotProps<TContext extends AnyRecord = AnyRecord> {
  readonly snapshot: HsmSnapshot<TContext>;
  readonly stateId: string;
}

export const MachineOutlet = defineComponent({
  name: "MachineOutlet",
  props: {
    components: {
      type: Object as PropType<Record<string, Component>>,
      default: () => ({})
    },
    fallback: {
      type: [Object, Function, String] as PropType<Component | string | null>,
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
      const slotProps: MachineOutletSlotProps = { snapshot, stateId: snapshot.stateId };
      if (slots.default) return slots.default(slotProps);
      const component = selected.value ?? props.fallback;
      return component ? h(component as any, { snapshot, stateId: snapshot.stateId }) : null;
    };
  }
});
