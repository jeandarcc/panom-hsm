import type { AnyRecord } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema } from "../schema/HsmSchema.js";
import type { HsmSecurityProbe } from "./types.js";
import { HsmAuditRunner } from "./HsmAuditRunner.js";
import type { HsmAuditRunnerOptions } from "./HsmAuditRunner.js";
import { probes } from "./probes/index.js";
import { inferProtectedStates } from "./HsmAuditDefaults.js";
import type { HsmAuditReport } from "./HsmAuditReport.js";

export interface RunHsmAuditOptions<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: HsmMachine<TContext>;
  readonly schema?: HsmSchema;
  readonly probes?: readonly HsmSecurityProbe[];
  readonly baseUrl?: string;
  readonly contextProfiles?: Readonly<Record<string, TContext>>;
}

export async function runHsmAudit<TContext extends AnyRecord = AnyRecord>(
  options: RunHsmAuditOptions<TContext>
): Promise<HsmAuditReport> {
  const defaultProbes = () => {
    const protectedStates = inferProtectedStates(options.hsm, options.schema);
    return probes.defaultAudit().map((probe) => {
      if (probe.name === "unauthenticated_access") {
        return probes.unauthenticatedAccess({ protectedStates });
      }
      return probe;
    });
  };
  const runner = new HsmAuditRunner({
    hsm: options.hsm,
    schema: options.schema,
    probes: options.probes ?? defaultProbes(),
    baseUrl: options.baseUrl,
    contextProfiles: options.contextProfiles
  } as unknown as HsmAuditRunnerOptions<TContext>);
  return runner.run();
}
