import type {
  AnyRecord,
  HsmHrefOptions,
  HsmRouteEntry,
  HsmRouteMatch
} from "../core/types.js";
import type { StateNode } from "../core/StateNode.js";
import { StateTree } from "../core/StateTree.js";
import { HsmMissingStateError, HsmRouteNotFoundError } from "../errors/HsmErrors.js";
import { PathComposer } from "./PathComposer.js";
import { PathPattern } from "./PathPattern.js";
import { RouteProjection } from "./RouteProjection.js";
import { UrlTools } from "./UrlTools.js";

interface InternalRouteEntry<TContext extends AnyRecord = AnyRecord>
  extends HsmRouteEntry<TContext> {
  readonly compiled: PathPattern;
  readonly canonicalCompiled: PathPattern;
}

/**
 * Public URL index generated from the semantic state tree.
 *
 * The table stores canonical route entries for href generation and also alias entries for
 * backwards-compatible matching. A state can therefore keep an internal id such as
 * `app.profile.owner` while exposing `/profile/:username` as the canonical public URL.
 */
export class RouteTable<TContext extends AnyRecord = AnyRecord> {
  private readonly canonicalByStateId = new Map<string, InternalRouteEntry<TContext>>();
  private readonly orderedEntries: readonly InternalRouteEntry<TContext>[];

  public constructor(private readonly tree: StateTree<TContext>) {
    const entries = this.buildEntries();
    this.orderedEntries = Object.freeze(entries.sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority;
      if (right.score !== left.score) return right.score - left.score;
      if (left.isAlias !== right.isAlias) return left.isAlias ? 1 : -1;
      return right.pattern.length - left.pattern.length;
    }));
  }

  public get entries(): readonly HsmRouteEntry<TContext>[] {
    return this.orderedEntries.map(({ compiled: _compiled, canonicalCompiled: _canonicalCompiled, ...entry }) => entry);
  }

  public match(input: string, baseUrl?: string): HsmRouteMatch<TContext> {
    const first = this.matchAll(input, baseUrl)[0];
    if (!first) {
      const parsed = UrlTools.parse(input, baseUrl);
      throw new HsmRouteNotFoundError(parsed.pathname);
    }
    return first;
  }

  public matchAll(input: string, baseUrl?: string): readonly HsmRouteMatch<TContext>[] {
    const parsed = UrlTools.parse(input, baseUrl);
    const matches: HsmRouteMatch<TContext>[] = [];

    for (const entry of this.orderedEntries) {
      const result = entry.compiled.match(parsed.pathname);
      if (!result) continue;

      const canonicalPathname = entry.canonicalCompiled.build(result.params);
      matches.push(Object.freeze({
        entry,
        state: entry.state,
        stateId: entry.stateId,
        params: Object.freeze(result.params),
        pathname: parsed.pathname,
        canonicalPathname,
        query: Object.freeze(parsed.query),
        hash: parsed.hash,
        pattern: entry.pattern,
        canonicalPattern: entry.canonicalPattern,
        kind: entry.kind,
        isCanonical: !entry.isAlias && parsed.pathname === canonicalPathname
      }));
    }

    return Object.freeze(matches);
  }

  public href(stateId: string, params: AnyRecord = {}, options: HsmHrefOptions = {}): string {
    const entry = this.routeForState(stateId);
    const pathname = entry.canonicalCompiled.build(params);
    return PathComposer.appendSearchAndHash(pathname, options.query, options.hash);
  }

  public routeForState(stateId: string): InternalRouteEntry<TContext> {
    let node: StateNode<TContext> | null = this.tree.get(stateId);

    while (node) {
      const entry = this.canonicalByStateId.get(node.id);
      if (entry) return entry;
      node = node.parent;
    }

    throw new HsmMissingStateError(stateId);
  }

  private buildEntries(): InternalRouteEntry<TContext>[] {
    const entries: InternalRouteEntry<TContext>[] = [];
    const dedupe = new Set<string>();

    for (const node of this.tree.all) {
      if (!RouteProjection.isSelfRoutable(node)) continue;

      const projections = RouteProjection.projectedPatterns(node);
      for (const projection of projections) {
        const compiled = new PathPattern(projection.pattern);
        const canonicalCompiled = new PathPattern(projection.canonicalPattern);
        const isAlias = projection.isAlias;
        const entry: InternalRouteEntry<TContext> = {
          state: node,
          stateId: node.id,
          pattern: compiled.pattern,
          canonicalPattern: canonicalCompiled.pattern,
          kind: isAlias ? "alias" : "canonical",
          isAlias,
          redirectToCanonical: projection.redirectToCanonical,
          priority: projection.priority,
          score: compiled.score,
          compiled,
          canonicalCompiled
        };

        const key = `${entry.kind}:${entry.stateId}:${entry.pattern}`;
        if (dedupe.has(key)) continue;
        dedupe.add(key);

        if (!isAlias && !this.canonicalByStateId.has(node.id)) {
          this.canonicalByStateId.set(node.id, entry);
        }

        entries.push(entry);
      }
    }

    return entries;
  }
}
