import type { AnyRecord, HsmMeta, HsmStateConfig, HsmStateId, HsmStateUrlConfig } from "./types.js";
import { HsmPath } from "./HsmPath.js";
import { HsmMissingStateError } from "../errors/HsmErrors.js";

export class StateNode<TContext extends AnyRecord = AnyRecord> {
  private readonly childrenByKey = new Map<string, StateNode<TContext>>();

  public readonly key: string;
  public readonly id: HsmStateId;
  public readonly parent: StateNode<TContext> | null;
  public readonly config: HsmStateConfig<TContext>;
  public readonly depth: number;

  public constructor(args: {
    key: string;
    id: HsmStateId;
    parent: StateNode<TContext> | null;
    config: HsmStateConfig<TContext>;
  }) {
    this.key = args.key;
    this.id = args.id;
    this.parent = args.parent;
    this.config = args.config;
    this.depth = args.parent ? args.parent.depth + 1 : 0;
  }

  public get path(): string | undefined {
    return this.config.path;
  }

  public get url(): HsmStateUrlConfig | undefined {
    return this.config.url;
  }

  public get initial(): string | undefined {
    return this.config.initial;
  }

  public get meta(): HsmMeta {
    return this.config.meta ?? {};
  }

  public get tags(): readonly string[] {
    return this.config.tags ?? [];
  }

  public get children(): readonly StateNode<TContext>[] {
    return Array.from(this.childrenByKey.values());
  }

  public addChild(child: StateNode<TContext>): void {
    if (this.childrenByKey.has(child.key)) {
      throw new Error(`Child "${child.key}" already exists under "${this.id}".`);
    }
    this.childrenByKey.set(child.key, child);
  }

  public hasChild(key: string): boolean {
    return this.childrenByKey.has(key);
  }

  public child(key: string): StateNode<TContext> {
    HsmPath.validateStateKey(key);
    const child = this.childrenByKey.get(key);
    if (!child) {
      throw new HsmMissingStateError(HsmPath.join(this.id, key));
    }
    return child;
  }

  public ancestors(): readonly StateNode<TContext>[] {
    const result: StateNode<TContext>[] = [];
    let cursor: StateNode<TContext> | null = this.parent;
    while (cursor) {
      result.unshift(cursor);
      cursor = cursor.parent;
    }
    return result;
  }

  public activePath(): readonly StateNode<TContext>[] {
    return [...this.ancestors(), this];
  }

  public is(stateId: HsmStateId): boolean {
    return HsmPath.isAncestor(stateId, this.id);
  }

  public toString(): string {
    return this.id;
  }
}
