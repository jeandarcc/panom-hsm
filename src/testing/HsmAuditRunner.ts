import type { AnyRecord } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema } from "../schema/HsmSchema.js";
import { createRedirectSafety, RedirectSafety } from "../browser/RedirectSafety.js";
import type {
  HsmAuditReportData,
  HsmFinding,
  HsmProbeResult,
  HsmRuntimeAdapter,
  HsmSecurityProbe
} from "./types.js";
import { HsmAuditReport } from "./HsmAuditReport.js";
import { groupFindingsBySeverity, nowIso, reportSummary } from "./HsmTestUtils.js";

export interface HsmAuditRunnerOptions<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: HsmMachine<TContext>;
  readonly schema?: HsmSchema;
  readonly probes: readonly HsmSecurityProbe[];
  readonly baseUrl?: string;
  readonly redirectSafety?: RedirectSafety;
  readonly contextProfiles?: Readonly<Record<string, TContext>>;
}

export class HsmAuditRunner<TContext extends AnyRecord = AnyRecord> {
  private readonly adapter: HsmRuntimeAdapter<TContext>;
  private readonly redirectSafety: RedirectSafety;
  private readonly contextProfiles: Readonly<Record<string, TContext>>;

  public constructor(private readonly options: HsmAuditRunnerOptions<TContext>) {
    this.adapter = this.createAdapter(options.hsm);
    this.redirectSafety = options.redirectSafety ?? createRedirectSafety({
      rootHostname: "localhost",
      currentOrigin: "http://localhost"
    });
    this.contextProfiles = options.contextProfiles ?? { anonymous: {} as TContext };
  }

  public async run(): Promise<HsmAuditReport> {
    const start = Date.now();
    const findings: HsmFinding[] = [];
    const probeResults: HsmProbeResult[] = [];

    for (const probe of this.options.probes) {
      const probeStart = Date.now();
      const probeFindings = await probe.run({
        hsm: { id: this.options.hsm.id },
        adapter: this.adapter,
        schema: this.options.schema,
        contextProfiles: this.contextProfiles,
        redirectSafety: { validate: (input: string) => this.redirectSafety.validate(input) },
        baseUrl: this.options.baseUrl
      });

      const normalized = probeFindings.map((finding) => ({
        ...finding,
        severity: finding.severity ?? probe.defaultSeverity,
        probeName: finding.probeName ?? probe.name
      }));

      const ok = normalized.length === 0;
      probeResults.push({
        name: probe.name,
        ok,
        durationMs: Date.now() - probeStart,
        findings: Object.freeze(normalized)
      });
      findings.push(...normalized);
    }

    const summary = reportSummary([], probeResults, findings);
    const data: HsmAuditReportData = {
      ok: findings.length === 0,
      summary,
      findings: Object.freeze(findings),
      findingsBySeverity: groupFindingsBySeverity(findings),
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

    return new HsmAuditReport(data);
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
}

