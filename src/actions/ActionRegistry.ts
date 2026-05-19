import type { AnyRecord, HsmActionFn, HsmActionInput, HsmActionMap, HsmActionRef } from "../core/types.js";
import { HsmConfigurationError } from "../errors/HsmErrors.js";

interface NamedAction<TContext extends AnyRecord = AnyRecord> {
  readonly name: string;
  readonly run: HsmActionFn<TContext>;
}

export class ActionRegistry<TContext extends AnyRecord = AnyRecord> {
  private readonly actions = new Map<string, HsmActionFn<TContext>>();

  public constructor(actions: HsmActionMap<TContext> = {}) {
    for (const [name, action] of Object.entries(actions)) {
      this.register(name, action);
    }
  }

  public register(name: string, action: HsmActionFn<TContext>): void {
    this.actions.set(name, action);
  }

  public has(name: string): boolean {
    return this.actions.has(name);
  }

  public get(name: string, stateId: string): HsmActionFn<TContext> {
    const action = this.actions.get(name);
    if (!action) {
      throw new HsmConfigurationError(
        `Action "${name}" used by state "${stateId}" is not registered.`
      );
    }
    return action;
  }

  public async runAll(input: HsmActionInput<TContext>, ref: HsmActionRef<TContext> | undefined): Promise<void> {
    if (!ref) return;

    const actions = this.normalize(ref, input.stateId);
    for (const action of actions) {
      await action.run(input);
    }
  }

  private normalize(ref: HsmActionRef<TContext>, stateId: string): readonly NamedAction<TContext>[] {
    const refs = Array.isArray(ref) ? ref : [ref];

    return refs.map((item, index) => {
      if (typeof item === "string") {
        return { name: item, run: this.get(item, stateId) };
      }

      return { name: `inline:${index}`, run: item };
    });
  }
}
