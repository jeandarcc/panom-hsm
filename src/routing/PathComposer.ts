import type { AnyRecord } from "../core/types.js";
import { HsmRouteBuildError } from "../errors/HsmErrors.js";
import { UrlTools } from "./UrlTools.js";

export class PathComposer {
  private constructor() {}

  public static join(fragments: readonly (string | undefined)[]): string | null {
    const defined = fragments.filter((fragment): fragment is string => fragment !== undefined);
    if (defined.length === 0) return null;

    const parts: string[] = [];

    for (const fragment of defined) {
      const normalized = fragment.trim();
      if (!normalized || normalized === "/") continue;
      parts.push(...normalized.split("/").filter(Boolean));
    }

    return parts.length === 0 ? "/" : UrlTools.normalizePathname(parts.join("/"));
  }

  public static appendSearchAndHash(pathname: string, query?: AnyRecord, hash?: string): string {
    return `${pathname}${UrlTools.encodeQuery(query)}${UrlTools.encodeHash(hash)}`;
  }

  public static assertRelativeOrAbsolutePath(path: string): void {
    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path)) {
      throw new HsmRouteBuildError(`External URL is not a routable HSM path: ${path}`);
    }
  }
}
