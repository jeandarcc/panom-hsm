import { runHsmAudit } from "../../testing/runHsmAudit.js";
import { probes } from "../../testing/probes/index.js";
import { TextReporter } from "../../testing/reporters/TextReporter.js";
import { parseArgs, filterReport, severityRank, writeReport } from "../cliUtils.js";
import { HsmTestDiscovery } from "../../testing/HsmTestDiscovery.js";
import { loadHsm, loadSchema } from "../hsmLoader.js";
import { inferProtectedStates } from "../../testing/HsmAuditDefaults.js";

interface AuditCommandOptions {
  readonly args: readonly string[];
  readonly cwd: string;
}

export async function runAuditCommand(options: AuditCommandOptions): Promise<number> {
  const parsed = parseArgs(options.args);
  const discovery = new HsmTestDiscovery({ cwd: options.cwd });

  const configPath = parsed.config ?? (await discovery.discoverConfig());
  if (!configPath) {
    console.error("No hsm.config.* file found. Provide --config.");
    return 1;
  }

  const schemaPath = parsed.schema ?? (await discovery.discoverSchema());
  const schema = schemaPath ? await loadSchema(schemaPath) : undefined;
  const { hsm, schema: resolvedSchema } = await loadHsm(configPath, schema);

  const protectedStates = inferProtectedStates(hsm, resolvedSchema);
  const auditProbes = probes.defaultAudit().map((probe) => {
    if (probe.name === "unauthenticated_access") {
      return probes.unauthenticatedAccess({ protectedStates });
    }
    return probe;
  });

  const report = await runHsmAudit({ hsm, schema: resolvedSchema, probes: auditProbes });
  const filtered = parsed.severity ? filterReport(report.toObject(), parsed.severity) : report.toObject();

  const output = parsed.json ? JSON.stringify(filtered, null, 2) : new TextReporter().render(filtered);
  console.log(output);
  await writeReport(output, parsed.report);

  const failOn = parsed.failOn ?? "high";
  const hasBlocking = filtered.findings.some((finding) => severityRank(finding.severity) >= severityRank(failOn));
  return hasBlocking ? 1 : 0;
}
