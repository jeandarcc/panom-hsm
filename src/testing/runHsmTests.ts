import type { AnyRecord } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema } from "../schema/HsmSchema.js";
import type { HsmTest } from "./types.js";
import { HsmTestRunner } from "./HsmTestRunner.js";
import type { HsmTestReport } from "./HsmTestReport.js";

export interface RunHsmTestsOptions<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: HsmMachine<TContext>;
  readonly tests: readonly HsmTest<TContext>[];
  readonly schema?: HsmSchema;
  readonly baseUrl?: string;
  readonly contextProfiles?: Readonly<Record<string, TContext>>;
}

export async function runHsmTests<TContext extends AnyRecord = AnyRecord>(
  options: RunHsmTestsOptions<TContext>
): Promise<HsmTestReport> {
  const runner = new HsmTestRunner({
    hsm: options.hsm,
    schema: options.schema,
    baseUrl: options.baseUrl,
    contextProfiles: options.contextProfiles
  });
  return runner.run(options.tests);
}
