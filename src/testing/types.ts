import type { AnyRecord, HsmSnapshot, HsmTransitionResult } from "../core/types.js";

export type HsmFindingSeverity = "info" | "low" | "medium" | "high" | "critical";
export type HsmFindingCategory =
  | "assertion"
  | "probe"
  | "runtime"
  | "configuration"
  | "security"
  | "policy"
  | "routing"
  | "query"
  | "backend";

export interface HsmFinding {
  readonly id: string;
  readonly title: string;
  readonly severity: HsmFindingSeverity;
  readonly category: HsmFindingCategory;
  readonly testName?: string;
  readonly probeName?: string;
  readonly stateId?: string;
  readonly route?: string;
  readonly url?: string;
  readonly stepIndex?: number;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly message: string;
  readonly recommendation?: string;
  readonly evidence?: Readonly<AnyRecord>;
}

export interface HsmTestExpectation {
  readonly state?: string;
  readonly notState?: string;
  readonly denied?: boolean;
  readonly redirectTo?: string;
  readonly permissions?: readonly string[];
  readonly notPermissions?: readonly string[];
  readonly capabilities?: readonly string[];
  readonly features?: readonly string[];
  readonly layout?: string;
  readonly params?: Readonly<AnyRecord>;
  readonly query?: Readonly<AnyRecord>;
  readonly context?: Readonly<AnyRecord>;
  readonly backendAllowed?: readonly string[];
  readonly backendDenied?: readonly string[];
  readonly urlSafe?: boolean;
  readonly canonicalUrl?: string;
}

export interface HsmTestArrange<TContext extends AnyRecord = AnyRecord> {
  readonly context?: TContext;
  readonly url?: string;
  readonly state?: string;
  readonly params?: Readonly<AnyRecord>;
}

export interface HsmTestVisitStep {
  readonly type: "visit";
  readonly url: string;
  readonly followRedirects?: boolean;
  readonly canonicalizeAliases?: boolean;
  readonly preserveUnknownQuery?: boolean;
  readonly hydrateQuery?: boolean;
  readonly expect?: HsmTestExpectation;
}

export interface HsmTestEventStep {
  readonly type: "event";
  readonly event: string;
  readonly payload?: unknown;
  readonly expect?: HsmTestExpectation;
}

export interface HsmTestTransitionStep {
  readonly type: "transition";
  readonly target: string;
  readonly params?: Readonly<AnyRecord>;
  readonly expect?: HsmTestExpectation;
}

export interface HsmTestContextStep<TContext extends AnyRecord = AnyRecord> {
  readonly type: "context";
  readonly patch: Partial<TContext>;
}

export interface HsmTestAssertStep {
  readonly type: "assert";
  readonly expect: HsmTestExpectation;
}

export type HsmTestStep<TContext extends AnyRecord = AnyRecord> =
  | HsmTestVisitStep
  | HsmTestEventStep
  | HsmTestTransitionStep
  | HsmTestContextStep<TContext>
  | HsmTestAssertStep;

export interface HsmTestConfig<TContext extends AnyRecord = AnyRecord> {
  readonly name: string;
  readonly description?: string;
  readonly arrange?: HsmTestArrange<TContext>;
  readonly steps: readonly HsmTestStep<TContext>[];
  readonly security?: readonly HsmSecurityProbe[];
  readonly tags?: readonly string[];
  readonly severity?: HsmFindingSeverity;
  readonly metadata?: Readonly<AnyRecord>;
}

export interface HsmTest<TContext extends AnyRecord = AnyRecord> extends HsmTestConfig<TContext> {
  readonly kind: "hsm-test";
}

export interface HsmTestStepResult<TContext extends AnyRecord = AnyRecord> {
  readonly step: HsmTestStep<TContext>;
  readonly snapshot: HsmSnapshot<TContext> | null;
  readonly transition?: HsmTransitionResult<TContext>;
  readonly findings: readonly HsmFinding[];
}

export interface HsmTestResult<TContext extends AnyRecord = AnyRecord> {
  readonly name: string;
  readonly ok: boolean;
  readonly durationMs: number;
  readonly findings: readonly HsmFinding[];
  readonly steps: readonly HsmTestStepResult<TContext>[];
}

export interface HsmReportSummary {
  readonly tests: { total: number; passed: number; failed: number };
  readonly probes: { total: number; passed: number; failed: number };
  readonly severities: Record<HsmFindingSeverity, number>;
}

export interface HsmReportMetadata {
  readonly generatedAt: string;
  readonly durationMs: number;
  readonly environment: Readonly<AnyRecord>;
  readonly schema?: Readonly<AnyRecord>;
}

export interface HsmTestReportData {
  readonly ok: boolean;
  readonly summary: HsmReportSummary;
  readonly findings: readonly HsmFinding[];
  readonly findingsBySeverity: Record<HsmFindingSeverity, readonly HsmFinding[]>;
  readonly tests: readonly HsmTestResult[];
  readonly probes: readonly HsmProbeResult[];
  readonly metadata: HsmReportMetadata;
}

export interface HsmAuditReportData {
  readonly ok: boolean;
  readonly summary: HsmReportSummary;
  readonly findings: readonly HsmFinding[];
  readonly findingsBySeverity: Record<HsmFindingSeverity, readonly HsmFinding[]>;
  readonly probes: readonly HsmProbeResult[];
  readonly metadata: HsmReportMetadata;
}

export interface HsmProbeResult {
  readonly name: string;
  readonly ok: boolean;
  readonly durationMs: number;
  readonly findings: readonly HsmFinding[];
}

export interface HsmProbeContext<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: { id: string };
  readonly adapter: HsmRuntimeAdapter<TContext>;
  readonly schema?: Readonly<AnyRecord>;
  readonly contextProfiles: Readonly<Record<string, TContext>>;
  readonly redirectSafety?: RedirectSafetyAdapter;
  readonly baseUrl?: string;
}

export interface HsmRuntimeAdapter<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: unknown;
  readonly hsmId: string;
  readonly resolveUrl: (url: string, options?: AnyRecord) => Promise<HsmSnapshot<TContext>>;
  readonly transitionUrl: (url: string, options?: AnyRecord) => Promise<HsmTransitionResult<TContext>>;
  readonly transition: (stateId: string, options?: AnyRecord) => Promise<HsmTransitionResult<TContext>>;
  readonly send: (event: string, payload: unknown, options?: AnyRecord) => Promise<HsmTransitionResult<TContext>>;
  readonly href: (stateId: string, params?: AnyRecord, options?: AnyRecord) => string;
  readonly syncUrl: (url: string, context: TContext, options?: AnyRecord) => string;
  readonly routes: () => readonly AnyRecord[];
  readonly states: () => readonly string[];
}

export interface HsmSecurityProbe {
  readonly name: string;
  readonly description: string;
  readonly defaultSeverity: HsmFindingSeverity;
  run(context: HsmProbeContext): Promise<readonly HsmFinding[]>;
}

export interface RedirectSafetyAdapter {
  validate(input: string): { ok: boolean; normalized?: string; reason?: string };
}
