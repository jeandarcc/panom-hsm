import type { AnyRecord } from "../core/types.js";
import type { HsmSchema } from "../schema/HsmSchema.js";
import { buildSamplePath, sampleParams } from "../testing/probes/ProbeUtils.js";

export interface HsmAgentRouteSample {
  readonly stateId: string;
  readonly pattern: string;
  readonly canonical: string;
  readonly isAlias: boolean;
}

export class HsmAgentStateModel {
  public constructor(private readonly schema?: HsmSchema) {}

  public listRoutes(): readonly HsmAgentRouteSample[] {
    if (!this.schema) return [];
    return this.schema.index.routes.map((route) => ({
      stateId: route.stateId,
      pattern: route.pattern,
      canonical: route.canonicalPattern,
      isAlias: route.isAlias
    }));
  }

  public buildSamplePath(pattern: string): string {
    return buildSamplePath(pattern);
  }

  public sampleParams(pattern: string): AnyRecord {
    return sampleParams(pattern);
  }
}
