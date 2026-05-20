import type { AnyRecord, HsmSnapshot, HsmTransitionResult } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema } from "../schema/HsmSchema.js";
import type { HsmFinding, HsmFindingSeverity } from "../testing/types.js";
import type { HsmAgentContext } from "./HsmAgentContext.js";

export type HsmAgentRuntimeMode = "simulation" | "http" | "browser";
export type HsmAgentRisk = "low" | "medium" | "high";
export type HsmAgentDestructiveMode = "disabled" | "sandbox-only" | "allowed";

export interface HsmAgentTarget {
  readonly origin: string;
  readonly allowedOrigins?: readonly string[];
}

export interface HsmAgentSafetyConfig {
  readonly blockExternalOrigins?: boolean;
  readonly destructiveActions?: HsmAgentDestructiveMode;
  readonly blockPaymentRoutes?: boolean;
  readonly blockEmailRoutes?: boolean;
  readonly requireAllowedOrigin?: boolean;
  readonly maxRequestBodyBytes?: number;
  readonly maxConcurrentAgents?: number;
  readonly allowProductionTargets?: boolean;
  readonly allowlistedPaths?: readonly string[];
}

export interface HsmAgentAccount {
  readonly id: string;
  readonly profile: string;
  readonly username?: string;
  readonly email?: string;
  readonly metadata?: Readonly<AnyRecord>;
  readonly auth?: {
    readonly token?: string;
    readonly cookies?: Readonly<Record<string, string>>;
    readonly headers?: Readonly<Record<string, string>>;
  };
}

export interface HsmAgentAccountProvider<TProfile extends HsmAgentProfile = HsmAgentProfile> {
  readonly create?: (profile: TProfile) => Promise<HsmAgentAccount>;
  readonly destroy?: (account: HsmAgentAccount) => Promise<void>;
  readonly keepAccounts?: boolean;
}

export interface HsmAgentProfile<TContext extends AnyRecord = AnyRecord> {
  readonly name: string;
  readonly context: TContext;
  readonly risk?: HsmAgentRisk;
  readonly requiresAccount?: boolean;
  readonly expectedPermissions?: readonly string[];
  readonly allowedActions?: readonly string[];
}

export interface HsmAgentConfig<TContext extends AnyRecord = AnyRecord> {
  readonly count: number;
  readonly durationMs?: number;
  readonly maxSteps?: number;
  readonly seed?: string;
  readonly profiles?: readonly HsmAgentProfile<TContext>[];
  readonly mode?: HsmAgentRuntimeMode;
}

export interface HsmAgentSuiteConfig<TContext extends AnyRecord = AnyRecord> {
  readonly name: string;
  readonly target: HsmAgentTarget;
  readonly hsm?: {
    readonly schemaPath?: string;
    readonly configPath?: string;
  };
  readonly accounts?: HsmAgentAccountProvider;
  readonly agents: HsmAgentConfig<TContext>;
  readonly actions?: readonly HsmAgentAction[];
  readonly invariants?: readonly HsmAgentInvariant[];
  readonly safety?: HsmAgentSafetyConfig;
  readonly metadata?: Readonly<AnyRecord>;
}

export interface HsmAgentSuite<TContext extends AnyRecord = AnyRecord> extends HsmAgentSuiteConfig<TContext> {
  readonly kind: "hsm-agent-suite";
  readonly safety: Required<HsmAgentSafetyConfig>;
  readonly agents: Required<Pick<HsmAgentConfig<TContext>, "count" | "profiles" | "seed" | "mode">> & HsmAgentConfig<TContext>;
  readonly target: Required<Pick<HsmAgentTarget, "origin" | "allowedOrigins">> & HsmAgentTarget;
}

export interface HsmAgentActionResult {
  readonly ok: boolean;
  readonly findings: readonly HsmAgentFinding[];
  readonly trace?: HsmAgentTraceEvent;
  readonly snapshot?: HsmSnapshot<AnyRecord> | null;
  readonly transition?: HsmTransitionResult<AnyRecord> | null;
}

export interface HsmAgentAction {
  readonly name: string;
  readonly category: string;
  readonly risk: HsmAgentRisk;
  readonly weight: number;
  canRun(context: HsmAgentContext): boolean;
  run(context: HsmAgentContext): Promise<HsmAgentActionResult>;
}

export interface HsmAgentInvariantResult {
  readonly ok: boolean;
  readonly findings: readonly HsmAgentFinding[];
}

export interface HsmAgentInvariant {
  readonly name: string;
  readonly description: string;
  readonly severity: HsmFindingSeverity;
  run(context: HsmAgentContext): Promise<HsmAgentInvariantResult>;
}

export interface HsmAgentTraceEvent {
  readonly id: string;
  readonly agentId: string;
  readonly sequence: number;
  readonly timestamp: string;
  readonly actionName: string;
  readonly actionType: string;
  readonly input?: Readonly<AnyRecord>;
  readonly url?: string;
  readonly method?: string;
  readonly request?: Readonly<AnyRecord>;
  readonly response?: Readonly<AnyRecord>;
  readonly hsmStateBefore?: string;
  readonly hsmStateAfter?: string;
  readonly contextDiff?: Readonly<AnyRecord>;
  readonly permissionsBefore?: readonly string[];
  readonly permissionsAfter?: readonly string[];
  readonly expected?: Readonly<AnyRecord>;
  readonly actual?: Readonly<AnyRecord>;
  readonly findings?: readonly HsmAgentFinding[];
  readonly randomDecision?: Readonly<AnyRecord>;
  readonly seed?: string;
  readonly screenshotPath?: string;
  readonly networkEvidence?: Readonly<AnyRecord>;
}

export interface HsmAgentTrace {
  readonly agentId: string;
  readonly seed: string;
  readonly events: readonly HsmAgentTraceEvent[];
}

export interface HsmAgentFinding extends HsmFinding {
  readonly agentId?: string;
  readonly action?: string;
  readonly stepIndex?: number;
  readonly method?: string;
  readonly replay?: string;
}

export interface HsmAgentReportAgentSummary {
  readonly agentId: string;
  readonly profile: string;
  readonly seed: string;
  readonly ok: boolean;
  readonly steps: number;
  readonly findings: number;
  readonly account?: HsmAgentAccount;
}

export interface HsmAgentReportData {
  readonly ok: boolean;
  readonly suiteName: string;
  readonly target: HsmAgentTarget;
  readonly seed: string;
  readonly durationMs: number;
  readonly agents: {
    readonly total: number;
    readonly completed: number;
    readonly failed: number;
  };
  readonly steps: { readonly total: number };
  readonly findings: readonly HsmAgentFinding[];
  readonly findingsBySeverity: Record<HsmFindingSeverity, readonly HsmAgentFinding[]>;
  readonly agentSummaries: readonly HsmAgentReportAgentSummary[];
  readonly traces: readonly HsmAgentTrace[];
  readonly reproduction: readonly string[];
  readonly metadata: {
    readonly generatedAt: string;
    readonly environment: Readonly<AnyRecord>;
    readonly schema?: Readonly<AnyRecord>;
  };
}

export interface RunHsmAgentsOptions<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: HsmMachine<TContext>;
  readonly schema?: HsmSchema;
  readonly suite: HsmAgentSuite<TContext>;
}
