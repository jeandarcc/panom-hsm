import type { HsmTestReportData } from "./types.js";
import { JsonReporter } from "./reporters/JsonReporter.js";
import { TextReporter } from "./reporters/TextReporter.js";

export class HsmTestReport {
  public constructor(private readonly data: HsmTestReportData) {}

  public get ok(): boolean {
    return this.data.ok;
  }

  public get summary(): HsmTestReportData["summary"] {
    return this.data.summary;
  }

  public get findings(): HsmTestReportData["findings"] {
    return this.data.findings;
  }

  public toText(): string {
    return new TextReporter().render(this.data);
  }

  public toJson(): string {
    return new JsonReporter().render(this.data);
  }

  public toObject(): HsmTestReportData {
    return this.data;
  }
}
