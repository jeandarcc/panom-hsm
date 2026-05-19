import type { AnyRecord } from "../core/types.js";

export interface ParsedHsmUrl {
  readonly pathname: string;
  readonly query: AnyRecord;
  readonly hash: string;
}

export class UrlTools {
  private constructor() {}

  public static parse(input: string, baseUrl = "http://hsm.local"): ParsedHsmUrl {
    const url = new URL(input, baseUrl);
    return {
      pathname: this.normalizePathname(url.pathname),
      query: this.searchParamsToRecord(url.searchParams),
      hash: url.hash.startsWith("#") ? url.hash.slice(1) : url.hash
    };
  }

  public static normalizePathname(pathname: string): string {
    const decoded = pathname.trim() || "/";
    const singleSlash = decoded.replace(/\/+/g, "/");
    if (singleSlash === "/") return "/";
    return `/${singleSlash.replace(/^\/+|\/+$/g, "")}`;
  }

  public static encodeQuery(query: AnyRecord | undefined): string {
    if (!query) return "";
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) params.append(key, String(item));
        continue;
      }
      params.set(key, String(value));
    }

    const serialized = params.toString();
    return serialized ? `?${serialized}` : "";
  }

  public static encodeHash(hash: string | undefined): string {
    if (!hash) return "";
    return hash.startsWith("#") ? hash : `#${hash}`;
  }

  private static searchParamsToRecord(params: URLSearchParams): AnyRecord {
    const output: AnyRecord = {};
    params.forEach((_value, key) => {
      if (Object.prototype.hasOwnProperty.call(output, key)) return;
      const values = params.getAll(key);
      output[key] = values.length > 1 ? values : values[0] ?? "";
    });
    return output;
  }
}
