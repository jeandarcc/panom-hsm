import type { AnyRecord, HsmMachineConfig } from "./types.js";
import { HsmMachine } from "./HsmMachine.js";

export function createHsm<TContext extends AnyRecord = AnyRecord>(
  config: HsmMachineConfig<TContext>
): HsmMachine<TContext> {
  return new HsmMachine(config);
}
