import type { AnyRecord } from "../core/types.js";
import type { HsmTest, HsmTestConfig } from "./types.js";

export function defineHsmTest<TContext extends AnyRecord = AnyRecord>(
  config: HsmTestConfig<TContext>
): HsmTest<TContext> {
  if (!config.name || config.name.trim().length === 0) {
    throw new Error("defineHsmTest requires a non-empty name.");
  }
  if (!config.steps || config.steps.length === 0) {
    throw new Error(`defineHsmTest requires at least one step for "${config.name}".`);
  }

  return Object.freeze({
    ...config,
    kind: "hsm-test",
    steps: Object.freeze([...config.steps]),
    security: Object.freeze([...(config.security ?? [])]),
    tags: Object.freeze([...(config.tags ?? [])])
  });
}
