import type { AnyRecord, HsmMachineConfig, HsmStateConfig, HsmStateId } from "./types.js";
import { HsmPath } from "./HsmPath.js";
import { StateNode } from "./StateNode.js";
import { HsmDuplicateStateError, HsmMissingStateError } from "../errors/HsmErrors.js";
import { invariant } from "../utils/assert.js";

export class StateTree<TContext extends AnyRecord = AnyRecord> {
  private readonly nodesById = new Map<HsmStateId, StateNode<TContext>>();
  private readonly rootNodes: readonly StateNode<TContext>[];

  public constructor(config: HsmMachineConfig<TContext>) {
    HsmPath.validateMachineId(config.id);
    invariant(Object.keys(config.states).length > 0, "Machine must define at least one root state.");

    this.rootNodes = Object.entries(config.states).map(([key, stateConfig]) =>
      this.buildNode(key, null, stateConfig)
    );

    this.validateInitial(config.initial, this.rootNodes, "machine root");
  }

  public get roots(): readonly StateNode<TContext>[] {
    return this.rootNodes;
  }

  public get all(): readonly StateNode<TContext>[] {
    return Array.from(this.nodesById.values());
  }

  public get(stateId: HsmStateId): StateNode<TContext> {
    const node = this.nodesById.get(stateId);
    if (!node) throw new HsmMissingStateError(stateId);
    return node;
  }

  public has(stateId: HsmStateId): boolean {
    return this.nodesById.has(stateId);
  }

  public firstRoot(): StateNode<TContext> {
    const first = this.rootNodes[0];
    invariant(first, "Machine must define at least one root state.");
    return first;
  }

  public rootByKey(key: string): StateNode<TContext> {
    const root = this.rootNodes.find((node) => node.key === key);
    if (!root) throw new HsmMissingStateError(key);
    return root;
  }

  public expandInitial(node: StateNode<TContext>): StateNode<TContext> {
    let cursor = node;

    while (cursor.initial) {
      cursor = cursor.child(cursor.initial);
    }

    return cursor;
  }

  private buildNode(
    key: string,
    parent: StateNode<TContext> | null,
    config: HsmStateConfig<TContext>
  ): StateNode<TContext> {
    HsmPath.validateStateKey(key);
    const id = HsmPath.join(parent?.id ?? null, key);

    if (this.nodesById.has(id)) {
      throw new HsmDuplicateStateError(id);
    }

    const node = new StateNode<TContext>({ key, id, parent, config });
    this.nodesById.set(id, node);

    const children = Object.entries(config.states ?? {});
    for (const [childKey, childConfig] of children) {
      const child = this.buildNode(childKey, node, childConfig);
      node.addChild(child);
    }

    this.validateInitial(config.initial, node.children, node.id);

    return node;
  }

  private validateInitial(
    initial: string | undefined,
    children: readonly StateNode<TContext>[],
    owner: string
  ): void {
    if (!initial) return;
    HsmPath.validateStateKey(initial);
    invariant(
      children.some((child) => child.key === initial),
      `Initial state "${initial}" does not exist under ${owner}.`
    );
  }
}
