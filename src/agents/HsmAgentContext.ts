import type { AnyRecord } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema } from "../schema/HsmSchema.js";
import { createRedirectSafety } from "../browser/RedirectSafety.js";
import type { HsmFinding, HsmProbeContext } from "../testing/types.js";
import { HsmAgentRandom } from "./HsmAgentRandom.js";
import { HsmAgentTraceBuilder } from "./HsmAgentTrace.js";
import type {
  HsmAgentAccount,
  HsmAgentFinding,
  HsmAgentProfile,
  HsmAgentRuntimeMode,
  HsmAgentSuite
} from "./types.js";
import type { HsmAgentRuntimeAdapter } from "./HsmAgentRuntimeAdapter.js";
import { toAgentFinding } from "./HsmAgentFindingBridge.js";
import { HsmAgentSafetyPolicy } from "./HsmAgentSafetyPolicy.js";

export class HsmAgentContext<TContext extends AnyRecord = AnyRecord> {
  public readonly agentId: string;
  public readonly suite: HsmAgentSuite<TContext>;
  public readonly profile: HsmAgentProfile<TContext>;
  public readonly account?: HsmAgentAccount;
  public readonly adapter: HsmAgentRuntimeAdapter<TContext>;
  public readonly random: HsmAgentRandom;
  public readonly safety: HsmAgentSafetyPolicy;
  public readonly schema?: HsmSchema;
  public readonly mode: HsmAgentRuntimeMode;
  public readonly trace: HsmAgentTraceBuilder;
  public readonly flags = new Map<string, boolean>();
  public snapshot: AnyRecord | null = null;
  public baselinePermissions: readonly string[] = [];
  public baselineCapabilities: readonly string[] = [];
  public baselineFeatures: readonly string[] = [];
  public lastAction?: string;
  public lastBackendResult?: {
    ok?: boolean;
    stateId?: string;
    method?: string;
    url?: string;
    permissions?: readonly string[];
  };
  public stepIndex = 0;

  public constructor(options: {
    agentId: string;
    suite: HsmAgentSuite<TContext>;
    profile: HsmAgentProfile<TContext>;
    account?: HsmAgentAccount;
    adapter: HsmAgentRuntimeAdapter<TContext>;
    random: HsmAgentRandom;
    safety: HsmAgentSafetyPolicy;
    schema?: HsmSchema;
  }) {
    this.agentId = options.agentId;
    this.suite = options.suite;
    this.profile = options.profile;
    this.account = options.account;
    this.adapter = options.adapter;
    this.random = options.random;
    this.safety = options.safety;
    this.schema = options.schema;
    this.mode = options.suite.agents.mode ?? "simulation";
    this.trace = new HsmAgentTraceBuilder(options.agentId, options.random.getSeed());
  }

  public setSnapshot(snapshot: AnyRecord | null): void {
    this.snapshot = snapshot;
  }

  public setBaseline(snapshot: AnyRecord | null): void {
    if (!snapshot) return;
    this.baselinePermissions = snapshot.policy?.permissions ?? [];
    this.baselineCapabilities = snapshot.policy?.capabilities ?? [];
    this.baselineFeatures = snapshot.policy?.features ?? [];
  }

  public toProbeContext(): HsmProbeContext<TContext> {
    return {
      hsm: { id: this.adapter.hsmId },
      adapter: this.adapter,
      schema: this.schema,
      baseUrl: this.suite.target.origin,
      contextProfiles: {
        anonymous: this.profile.context,
        agent: this.profile.context
      },
      redirectSafety: createRedirectSafety()
    };
  }

  public toFinding(finding: HsmFinding, details?: { action?: string; method?: string }): HsmAgentFinding {
    return toAgentFinding(finding, {
      agentId: this.agentId,
      action: details?.action ?? this.lastAction,
      stepIndex: this.stepIndex,
      method: details?.method,
      replay: this.buildReplayCommand()
    });
  }

  public buildReplayCommand(): string {
    return `hsm agents replay <report.json> --agent ${this.agentId}`;
  }

  public withContext(hsm: HsmMachine<TContext>): { context: TContext } {
    return { context: this.profile.context };
  }
}
