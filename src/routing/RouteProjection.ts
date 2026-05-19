import type { AnyRecord, HsmUrlMode } from "../core/types.js";
import type { StateNode } from "../core/StateNode.js";
import { HsmRouteBuildError } from "../errors/HsmErrors.js";
import { PathComposer } from "./PathComposer.js";

export interface RouteSegmentProjection {
  readonly stateId: string;
  readonly mode: HsmUrlMode;
  readonly canonicalFragment?: string;
  readonly aliases: readonly string[];
  readonly redirectAliases: boolean;
  readonly priority: number;
}

export interface ProjectedRoutePattern {
  readonly pattern: string;
  readonly canonicalPattern: string;
  readonly isAlias: boolean;
  readonly redirectToCanonical: boolean;
  readonly priority: number;
}

interface RouteFragmentChoice {
  readonly fragment?: string;
  readonly isAlias: boolean;
  readonly redirectToCanonical: boolean;
  readonly priority: number;
}

interface RoutePatternVariant {
  readonly fragments: readonly string[];
  readonly isAlias: boolean;
  readonly redirectToCanonical: boolean;
  readonly priority: number;
}

/**
 * Converts semantic StateNode paths into public URL projections.
 *
 * A node can remain part of the state graph while its path segment is hidden from the URL.
 * This keeps HSM ids semantic (`app.profile.owner`) without forcing architectural nodes
 * into public URLs (`/profile/yusuf` instead of `/app/profile/yusuf`).
 */
export class RouteProjection<TContext extends AnyRecord = AnyRecord> {
  private constructor() {}

  public static mode(node: StateNode<any>): HsmUrlMode {
    if (node.url?.hide === true) return "hidden";
    return node.url?.mode ?? "visible";
  }

  public static canonicalFragment(node: StateNode<any>): string | undefined {
    const mode = this.mode(node);
    if (mode === "hidden" || mode === "virtual") return undefined;
    return node.url?.path ?? node.path;
  }

  public static aliases(node: StateNode<any>): readonly string[] {
    return node.url?.aliases ?? [];
  }

  public static priority(node: StateNode<any>): number {
    return node.url?.priority ?? 0;
  }

  public static redirectsAliases(node: StateNode<any>): boolean {
    return node.url?.redirectAliases === true;
  }

  public static isSelfRoutable(node: StateNode<any>): boolean {
    const mode = this.mode(node);
    if (mode === "virtual") return false;
    if (node.url?.route === false) return false;

    const hasRouteSource = node.path !== undefined || node.url?.path !== undefined;
    if (!hasRouteSource) return false;

    // Hidden containers participate in descendant routes, but they are not addressable pages
    // unless explicitly requested. This prevents semantic parents such as `app` from
    // accidentally colliding with `/` when their own segment is hidden.
    if (mode === "hidden" && node.url?.route !== true) return false;

    return true;
  }

  public static segment(node: StateNode<any>): RouteSegmentProjection {
    const canonicalFragment = this.canonicalFragment(node);
    const base = {
      stateId: node.id,
      mode: this.mode(node),
      aliases: Object.freeze([...this.aliases(node)]),
      redirectAliases: this.redirectsAliases(node),
      priority: this.priority(node)
    };

    return Object.freeze(
      canonicalFragment === undefined ? base : { ...base, canonicalFragment }
    );
  }

  public static canonicalPattern(node: StateNode<any>): string | null {
    const fragments = node
      .activePath()
      .map((item) => this.canonicalFragment(item))
      .filter((fragment): fragment is string => fragment !== undefined);

    const pattern = PathComposer.join(fragments);
    if (!pattern) return null;
    PathComposer.assertRelativeOrAbsolutePath(pattern);
    return pattern;
  }

  public static projectedPatterns(node: StateNode<any>): readonly ProjectedRoutePattern[] {
    const canonicalPattern = this.canonicalPattern(node);
    if (!canonicalPattern) return [];

    const variants = this.buildVariants(node.activePath());
    const byPattern = new Map<string, ProjectedRoutePattern>();

    for (const variant of variants) {
      const pattern = PathComposer.join(variant.fragments);
      if (!pattern) continue;
      PathComposer.assertRelativeOrAbsolutePath(pattern);

      const isAlias = pattern !== canonicalPattern || variant.isAlias;
      const projection: ProjectedRoutePattern = Object.freeze({
        pattern,
        canonicalPattern,
        isAlias,
        redirectToCanonical: isAlias && variant.redirectToCanonical,
        priority: variant.priority
      });

      const previous = byPattern.get(pattern);
      if (!previous || this.preferPattern(projection, previous)) {
        byPattern.set(pattern, projection);
      }
    }

    return Object.freeze([...byPattern.values()]);
  }

  private static buildVariants(activePath: readonly StateNode<any>[]): readonly RoutePatternVariant[] {
    let variants: RoutePatternVariant[] = [
      { fragments: [], isAlias: false, redirectToCanonical: false, priority: 0 }
    ];

    for (const node of activePath) {
      const choices = this.fragmentChoices(node);
      const next: RoutePatternVariant[] = [];

      for (const variant of variants) {
        for (const choice of choices) {
          const fragments = choice.fragment === undefined
            ? [...variant.fragments]
            : [...variant.fragments, choice.fragment];
          next.push({
            fragments,
            isAlias: variant.isAlias || choice.isAlias,
            redirectToCanonical: variant.redirectToCanonical || choice.redirectToCanonical,
            priority: variant.priority + choice.priority
          });
        }
      }

      variants = next;
    }

    return variants;
  }

  private static fragmentChoices(node: StateNode<any>): readonly RouteFragmentChoice[] {
    const choices: RouteFragmentChoice[] = [];
    const canonicalFragment = this.canonicalFragment(node);

    choices.push({
      ...(canonicalFragment !== undefined ? { fragment: canonicalFragment } : {}),
      isAlias: false,
      redirectToCanonical: false,
      priority: this.priority(node)
    });

    for (const alias of this.aliases(node)) {
      if (alias.trim() === "") {
        throw new HsmRouteBuildError(`Empty route alias declared on state "${node.id}".`);
      }
      choices.push({
        fragment: alias,
        isAlias: true,
        redirectToCanonical: this.redirectsAliases(node),
        priority: this.priority(node) - 1
      });
    }

    return Object.freeze(choices);
  }

  private static preferPattern(next: ProjectedRoutePattern, previous: ProjectedRoutePattern): boolean {
    if (next.isAlias !== previous.isAlias) return !next.isAlias;
    if (next.redirectToCanonical !== previous.redirectToCanonical) return next.redirectToCanonical;
    return next.priority > previous.priority;
  }
}
