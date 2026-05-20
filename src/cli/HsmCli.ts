import path from "node:path";
import { runTestCommand } from "./commands/test.js";
import { runAuditCommand } from "./commands/audit.js";
import { runAgentsCommand } from "./commands/agents.js";

export interface HsmCliOptions {
  readonly argv: readonly string[];
  readonly cwd?: string;
}

export class HsmCli {
  private readonly argv: readonly string[];
  private readonly cwd: string;

  public constructor(options: HsmCliOptions) {
    this.argv = options.argv;
    this.cwd = options.cwd ?? process.cwd();
  }

  public async run(): Promise<number> {
    const [command, ...rest] = this.argv;

    if (!command || ["-h", "--help"].includes(command)) {
      this.printHelp();
      return 0;
    }

    if (command === "test") {
      return runTestCommand({ args: rest, cwd: this.cwd });
    }

    if (command === "audit") {
      return runAuditCommand({ args: rest, cwd: this.cwd });
    }

    if (command === "agents") {
      return runAgentsCommand({ args: rest, cwd: this.cwd });
    }

    console.error(`Unknown command: ${command}`);
    this.printHelp();
    return 1;
  }

  private printHelp(): void {
    const bin = path.basename(process.argv[1] ?? "hsm");
    console.log(`Usage: ${bin} <command> [options]`);
    console.log("\nCommands:");
    console.log("  test           Run HSM tests");
    console.log("  audit          Run HSM security audit");
    console.log("  agents         Run agent swarm commands");
    console.log("\nOptions:");
    console.log("  --config <path>   HSM config file");
    console.log("  --schema <path>   HSM schema file");
    console.log("  --tests <glob>    Test file glob");
    console.log("  --json            Output JSON report");
    console.log("  --report <path>   Write report to file");
    console.log("  --severity <lvl>  Filter findings by severity");
    console.log("  --fail-on <lvl>   Exit non-zero if findings >= severity");
    console.log("  --verbose         Verbose logging");
  }
}
