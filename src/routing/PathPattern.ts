import type { AnyRecord } from "../core/types.js";
import { HsmRouteBuildError } from "../errors/HsmErrors.js";
import { UrlTools } from "./UrlTools.js";

type SegmentKind = "static" | "param" | "wildcard";

interface CompiledSegment {
  readonly kind: SegmentKind;
  readonly raw: string;
  readonly name?: string;
}

export interface PathMatchResult {
  readonly params: AnyRecord;
  readonly score: number;
}

export class PathPattern {
  public readonly pattern: string;
  public readonly score: number;
  private readonly segments: readonly CompiledSegment[];

  public constructor(pattern: string) {
    this.pattern = UrlTools.normalizePathname(pattern);
    this.segments = this.compile(this.pattern);
    this.score = this.computeScore(this.segments);
  }

  public match(pathname: string): PathMatchResult | null {
    const incoming = this.split(UrlTools.normalizePathname(pathname));
    const params: AnyRecord = {};

    let patternIndex = 0;
    let pathIndex = 0;

    while (patternIndex < this.segments.length) {
      const segment = this.segments[patternIndex];
      if (!segment) return null;

      if (segment.kind === "wildcard") {
        const rest = incoming.slice(pathIndex).join("/");
        if (segment.name) params[segment.name] = rest;
        return { params, score: this.score };
      }

      const value = incoming[pathIndex];
      if (value === undefined) return null;

      if (segment.kind === "static" && segment.raw !== value) return null;
      if (segment.kind === "param") {
        if (!segment.name) return null;
        params[segment.name] = decodeURIComponent(value);
      }

      patternIndex += 1;
      pathIndex += 1;
    }

    if (pathIndex !== incoming.length) return null;
    return { params, score: this.score };
  }

  public build(params: AnyRecord = {}): string {
    if (this.segments.length === 0) return "/";

    const parts = this.segments.map((segment) => {
      if (segment.kind === "static") return segment.raw;
      if (segment.kind === "wildcard") {
        if (!segment.name) return "";
        const value = params[segment.name];
        if (value === undefined || value === null) {
          throw new HsmRouteBuildError(
            `Missing wildcard route param "${segment.name}" for pattern "${this.pattern}".`
          );
        }
        return String(value)
          .split("/")
          .filter(Boolean)
          .map((part) => encodeURIComponent(part))
          .join("/");
      }

      if (!segment.name) {
        throw new HsmRouteBuildError(`Invalid param segment in pattern "${this.pattern}".`);
      }

      const value = params[segment.name];
      if (value === undefined || value === null || value === "") {
        throw new HsmRouteBuildError(
          `Missing route param "${segment.name}" for pattern "${this.pattern}".`
        );
      }
      return encodeURIComponent(String(value));
    });

    return UrlTools.normalizePathname(parts.join("/"));
  }

  private compile(pattern: string): readonly CompiledSegment[] {
    return this.split(pattern).map((raw) => {
      if (raw === "*") return { kind: "wildcard", raw };
      if (raw.startsWith("*")) return { kind: "wildcard", raw, name: raw.slice(1) };
      if (raw.startsWith(":")) {
        const name = raw.slice(1);
        if (!name) throw new HsmRouteBuildError(`Invalid empty route param in "${pattern}".`);
        return { kind: "param", raw, name };
      }
      return { kind: "static", raw };
    });
  }

  private computeScore(segments: readonly CompiledSegment[]): number {
    if (segments.length === 0) return 1;

    return segments.reduce((score, segment) => {
      if (segment.kind === "static") return score + 100;
      if (segment.kind === "param") return score + 30;
      return score + 1;
    }, segments.length);
  }

  private split(pathname: string): readonly string[] {
    const normalized = UrlTools.normalizePathname(pathname);
    if (normalized === "/") return [];
    return normalized.replace(/^\//, "").split("/").filter(Boolean);
  }
}
