import type { AnyRecord, HsmGuardFn, HsmGuardInput, HsmGuardMap, HsmGuardRef } from "../core/types.js";
import { HsmGuardRejectedError, HsmMissingGuardError } from "../errors/HsmErrors.js";

interface NamedGuard<TContext extends AnyRecord = AnyRecord> {
  readonly name: string;
  readonly run: HsmGuardFn<TContext>;
}

export class GuardRegistry<TContext extends AnyRecord = AnyRecord> {
  private readonly guards = new Map<string, HsmGuardFn<TContext>>();

  public constructor(guards: HsmGuardMap<TContext> = {}) {
    for (const [name, guard] of Object.entries(guards)) {
      this.register(name, guard);
    }
  }

  public register(name: string, guard: HsmGuardFn<TContext>): void {
    this.guards.set(name, guard);
  }

  public has(name: string): boolean {
    return this.guards.has(name);
  }

  public get(name: string, stateId: string): HsmGuardFn<TContext> {
    const guard = this.guards.get(name);
    if (!guard) throw new HsmMissingGuardError(name, stateId);
    return guard;
  }

  public async accepts(
    input: HsmGuardInput<TContext>,
    ref: HsmGuardRef<TContext> | undefined
  ): Promise<boolean> {
    if (!ref) return true;

    const guards = this.normalize(ref, input.stateId);
    for (const guard of guards) {
      const accepted = await guard.run(input);
      if (!accepted) return false;
    }

    return true;
  }

  public async assertAll(
    input: HsmGuardInput<TContext>,
    ref: HsmGuardRef<TContext> | undefined
  ): Promise<void> {
    if (!ref) return;

    const guards = this.normalize(ref, input.stateId);

    for (const guard of guards) {
      const accepted = await guard.run(input);
      if (!accepted) {
        throw new HsmGuardRejectedError(input.stateId, guard.name);
      }
    }
  }

  private normalize(ref: HsmGuardRef<TContext>, stateId: string): readonly NamedGuard<TContext>[] {
    const refs = Array.isArray(ref) ? ref : [ref];

    return refs.map((item, index) => {
      if (typeof item === "string") {
        return { name: item, run: this.get(item, stateId) };
      }

      return { name: `inline:${index}`, run: item };
    });
  }
}
