import type { HsmAuditReportData } from "./types.js";
import { JsonReporter } from "./reporters/JsonReporter.js";
import { TextReporter } from "./reporters/TextReporter.js";

export class HsmAuditReport {
  public constructor(private readonly data: HsmAuditReportData) {}

  public get ok(): boolean {
    return this.data.ok;
  }

  public get summary(): HsmAuditReportData["summary"] {
    return this.data.summary;
  }

  public get findings(): HsmAuditReportData["findings"] {
    return this.data.findings;
  }

  public toText(): string {
    return new TextReporter().render(this.data);
  }

  public toJson(): string {
    return new JsonReporter().render(this.data);
  }

  public toObject(): HsmAuditReportData {
    return this.data;
  }
}
