import type { AnyRecord } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema } from "../schema/HsmSchema.js";

const PROTECTED_HINTS = ["cloud", "app", "admin", "billing", "settings", "media", "owner"];
const PUBLIC_HINTS = ["landing", "auth", "help", "about", "pricing"];

export function inferProtectedStates<TContext extends AnyRecord = AnyRecord>(
  hsm: HsmMachine<TContext>,
  schema?: HsmSchema
): readonly string[] {
  const protectedStates = new Set<string>();

  for (const stateId of hsm.states()) {
    const lowered = stateId.toLowerCase();
    if (PUBLIC_HINTS.some((hint) => lowered.includes(hint))) continue;
    if (PROTECTED_HINTS.some((hint) => lowered.includes(hint))) {
      protectedStates.add(stateId);
    }
  }

  if (schema) {
    for (const state of schema.index.states) {
      const hasPermission = (state.policies?.permissions?.length ?? 0) > 0;
      const hasBackend = Boolean(state.backend?.methods?.length || state.backend?.guards?.refs?.length);
      if (hasPermission || hasBackend) protectedStates.add(state.id);
    }
  }

  return Object.freeze([...protectedStates]);
}
