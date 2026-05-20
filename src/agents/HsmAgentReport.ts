import type { HsmAgentReportData } from "./types.js";
import { AgentTextReporter } from "./reporters/AgentTextReporter.js";
import { AgentJsonReporter } from "./reporters/AgentJsonReporter.js";

export class HsmAgentReport {
  public constructor(private readonly data: HsmAgentReportData) {}

  public get ok(): boolean {
    return this.data.ok;
  }

  public get findings(): HsmAgentReportData["findings"] {
    return this.data.findings;
  }

  public toText(): string {
    return new AgentTextReporter().render(this.data);
  }

  public toJson(): string {
    return new AgentJsonReporter().render(this.data);
  }

  public toObject(): HsmAgentReportData {
    return this.data;
  }
}
