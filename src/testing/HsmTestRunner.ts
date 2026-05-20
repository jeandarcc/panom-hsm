import type { AnyRecord, HsmSnapshot } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema } from "../schema/HsmSchema.js";
import { createRedirectSafety, RedirectSafety } from "../browser/RedirectSafety.js";
import { HsmTestContext } from "./HsmTestContext.js";
import { HsmTestStepRunner } from "./HsmTestStepRunner.js";
import type {
  HsmFinding,
  HsmProbeResult,
  HsmRuntimeAdapter,
  HsmSecurityProbe,
  HsmTest,
  HsmTestReportData,
  HsmTestResult,
  HsmTestStepResult
} from "./types.js";
import { HsmTestReport } from "./HsmTestReport.js";
import { groupFindingsBySeverity, nowIso, reportSummary } from "./HsmTestUtils.js";

export interface HsmTestRunnerOptions<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: HsmMachine<TContext>;
  readonly schema?: HsmSchema;
  readonly redirectSafety?: RedirectSafety;
  readonly baseUrl?: string;
  readonly contextProfiles?: Readonly<Record<string, TContext>>;
}

export class HsmTestRunner<TContext extends AnyRecord = AnyRecord> {
  private readonly stepRunner = new HsmTestStepRunner<TContext>();
  private readonly redirectSafety: RedirectSafety;
  private readonly adapter: HsmRuntimeAdapter<TContext>;
  private readonly contextProfiles: Readonly<Record<string, TContext>>;

  public constructor(private readonly options: HsmTestRunnerOptions<TContext>) {
    this.redirectSafety = options.redirectSafety ?? createRedirectSafety({
      rootHostname: "localhost",
      currentOrigin: "http://localhost"
    });
    this.adapter = this.createAdapter(options.hsm);
    this.contextProfiles = options.contextProfiles ?? { anonymous: {} as TContext };
  }

  public async run(tests: readonly HsmTest<TContext>[]): Promise<HsmTestReport> {
    const start = Date.now();
    const results: HsmTestResult<TContext>[] = [];
    const probeResults: HsmProbeResult[] = [];
    const findings: HsmFinding[] = [];

    for (const test of tests) {
      const testStart = Date.now();
      const testContext = await this.setupTestContext(test);
      const stepResults: HsmTestStepResult<TContext>[] = [];
      const testFindings: HsmFinding[] = [];
      const severity = test.severity ?? "high";

      for (let index = 0; index < test.steps.length; index += 1) {
        const step = test.steps[index];
        const backendMethods = this.backendMethodsForSnapshot(testContext.currentSnapshot);
        const result = await this.stepRunner.run(testContext, {
          testName: test.name,
          stepIndex: index,
          step,
          testSeverity: severity,
          backendMethods,
          redirectSafety: { validate: (input) => this.redirectSafety.validate(input) }
        });
        stepResults.push(result);
        testFindings.push(...result.findings);
      }

      const { findings: probeFindings, probeResults: testProbeResults } = await this.runSecurity(
        test,
        testContext.currentSnapshot
      );
      testFindings.push(...probeFindings);
      probeResults.push(...testProbeResults);

      const result: HsmTestResult<TContext> = {
        name: test.name,
        ok: testFindings.length === 0,
        durationMs: Date.now() - testStart,
        findings: Object.freeze(testFindings),
        steps: Object.freeze(stepResults)
      };

      results.push(result);
      findings.push(...testFindings);
    }

    const data: HsmTestReportData = {
      ok: findings.length === 0,
      summary: reportSummary(results, probeResults, findings),
      findings: Object.freeze(findings),
      findingsBySeverity: groupFindingsBySeverity(findings),
      tests: Object.freeze(results),
      probes: Object.freeze(probeResults),
      metadata: Object.freeze({
        generatedAt: nowIso(),
        durationMs: Date.now() - start,
        environment: Object.freeze({
          node: process.version,
          platform: process.platform,
          hsmId: this.options.hsm.id
        }),
        ...(this.options.schema?.metadata ? { schema: this.options.schema.metadata } : {})
      })
    };

    return new HsmTestReport(data);
  }

  private async setupTestContext(test: HsmTest<TContext>): Promise<HsmTestContext<TContext>> {
    const arrange = test.arrange;
    const baseContext = arrange?.context ?? (await this.defaultContext());
    const testContext = new HsmTestContext<TContext>(this.adapter, baseContext);

    await this.options.hsm.start({ context: baseContext });

    if (arrange?.url) {
      testContext.lastUrl = arrange.url;
      const result = await this.adapter.transitionUrl(arrange.url, { context: baseContext });
      testContext.lastTransition = result;
      if (result.ok) {
        testContext.currentSnapshot = result.snapshot;
        testContext.currentContext = result.snapshot.context as TContext;
      }
    } else if (arrange?.state) {
      const result = await this.adapter.transition(arrange.state, { context: baseContext, params: arrange.params });
      testContext.lastTransition = result;
      if (result.ok) {
        testContext.currentSnapshot = result.snapshot;
        testContext.currentContext = result.snapshot.context as TContext;
      }
    } else {
      const snapshot = this.options.hsm.current;
      testContext.currentSnapshot = snapshot;
      if (snapshot) testContext.currentContext = snapshot.context as TContext;
    }

    return testContext;
  }

  private async runSecurity(
    test: HsmTest<TContext>,
    snapshot: HsmSnapshot<TContext> | null
  ): Promise<{ findings: HsmFinding[]; probeResults: HsmProbeResult[] }> {
    if (!test.security || test.security.length === 0) return { findings: [], probeResults: [] };
    const contextProfiles = this.contextProfiles;
    const findings: HsmFinding[] = [];
    const probeResults: HsmProbeResult[] = [];

    for (const probe of test.security) {
      const start = Date.now();
      const probeFindings = await probe.run({
        hsm: { id: this.options.hsm.id },
        adapter: this.adapter,
        schema: this.options.schema,
        contextProfiles,
        redirectSafety: {
          validate: (input: string) => this.redirectSafety.validate(input)
        },
        baseUrl: this.options.baseUrl
      });

      const normalized = probeFindings.map((finding) => ({
        ...finding,
        severity: finding.severity ?? probe.defaultSeverity,
        testName: finding.testName ?? test.name,
        stateId: finding.stateId ?? snapshot?.stateId
      }));

      findings.push(...normalized);
      probeResults.push({
        name: probe.name,
        ok: normalized.length === 0,
        durationMs: Date.now() - start,
        findings: Object.freeze(normalized)
      });
    }

    return { findings, probeResults };
  }

  private createAdapter(hsm: HsmMachine<TContext>): HsmRuntimeAdapter<TContext> {
    return {
      hsm,
      hsmId: hsm.id,
      resolveUrl: (url, options = {}) => hsm.resolveUrl(url, options as AnyRecord),
      transitionUrl: (url, options = {}) => hsm.transitionUrl(url, options as AnyRecord),
      transition: (stateId, options = {}) => hsm.transition(stateId, options as AnyRecord),
      send: (event, payload, options = {}) => hsm.send(event, payload, options as AnyRecord),
      href: (stateId, params = {}, options = {}) => hsm.href(stateId, params, options as AnyRecord),
      syncUrl: (url, context, options = {}) => hsm.syncUrl(url, context, options as AnyRecord),
      routes: () => hsm.routes(),
      states: () => hsm.states()
    };
  }

  private backendMethodsForSnapshot(snapshot: HsmSnapshot<TContext> | null): readonly string[] | undefined {
    if (!snapshot || !this.options.schema) return undefined;
    const index = new Map(this.options.schema.index.states.map((state) => [state.id, state]));
    const active = snapshot.activePath ?? [];
    for (const stateId of [...active].reverse()) {
      const methods = index.get(stateId)?.backend?.methods;
      if (methods && methods.length > 0) return methods;
    }
    return undefined;
  }

  private async defaultContext(): Promise<TContext> {
    if (this.contextProfiles.anonymous) return this.contextProfiles.anonymous;
    return {} as TContext;
  }
}
