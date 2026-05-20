import { HsmTestDiscovery } from "../../testing/HsmTestDiscovery.js";
import { HsmTestFileLoader } from "../../testing/HsmTestFileLoader.js";
import { runHsmTests } from "../../testing/runHsmTests.js";
import { TextReporter } from "../../testing/reporters/TextReporter.js";
import { parseArgs, filterReport, severityRank, writeReport } from "../cliUtils.js";
import { loadHsm, loadSchema } from "../hsmLoader.js";

interface TestCommandOptions {
  readonly args: readonly string[];
  readonly cwd: string;
}

export async function runTestCommand(options: TestCommandOptions): Promise<number> {
  const [maybeName, ...rest] = options.args;
  const nameFilter = maybeName && !maybeName.startsWith("--") ? maybeName : undefined;
  const parsed = parseArgs(nameFilter ? rest : options.args);
  const discovery = new HsmTestDiscovery({ cwd: options.cwd, patterns: parsed.tests ? [parsed.tests] : undefined });
  const loader = new HsmTestFileLoader({ cwd: options.cwd });

  const testFiles = await discovery.discoverTests();
  if (testFiles.length === 0) {
    console.error("No HSM test files found.");
    return 1;
  }

  const configPath = parsed.config ?? (await discovery.discoverConfig());
  if (!configPath) {
    console.error("No hsm.config.* file found. Provide --config.");
    return 1;
  }

  const schemaPath = parsed.schema ?? (await discovery.discoverSchema());
  const schema = schemaPath ? await loadSchema(schemaPath) : undefined;
  const { hsm, schema: resolvedSchema } = await loadHsm(configPath, schema);

  const tests = (await Promise.all(testFiles.map((file) => loader.loadTests(file)))).flat();
  const filteredTests = nameFilter ? tests.filter((test) => test.name === nameFilter) : tests;
  if (filteredTests.length === 0) {
    console.error(nameFilter ? `No HSM tests found with name "${nameFilter}".` : "No HSM tests found.");
    return 1;
  }
  const report = await runHsmTests({ hsm, schema: resolvedSchema, tests: filteredTests });

  const filtered = parsed.severity ? filterReport(report.toObject(), parsed.severity) : report.toObject();
  const output = parsed.json ? JSON.stringify(filtered, null, 2) : new TextReporter().render(filtered);
  console.log(output);

  await writeReport(output, parsed.report);

  const failOn = parsed.failOn ?? "high";
  const hasBlocking = filtered.findings.some((finding) => severityRank(finding.severity) >= severityRank(failOn));
  return hasBlocking ? 1 : 0;
}
