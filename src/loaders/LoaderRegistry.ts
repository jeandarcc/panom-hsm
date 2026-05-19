import type { AnyRecord, HsmLoaderFn, HsmLoaderInput, HsmLoaderMap, HsmLoaderRef } from "../core/types.js";
import { HsmConfigurationError } from "../errors/HsmErrors.js";

interface NamedLoader<TContext extends AnyRecord = AnyRecord> {
  readonly name: string;
  readonly run: HsmLoaderFn<TContext>;
}

export class LoaderRegistry<TContext extends AnyRecord = AnyRecord> {
  private readonly loaders = new Map<string, HsmLoaderFn<TContext>>();

  public constructor(loaders: HsmLoaderMap<TContext> = {}) {
    for (const [name, loader] of Object.entries(loaders)) {
      this.register(name, loader);
    }
  }

  public register(name: string, loader: HsmLoaderFn<TContext>): void {
    this.loaders.set(name, loader);
  }

  public has(name: string): boolean {
    return this.loaders.has(name);
  }

  public get(name: string, stateId: string): HsmLoaderFn<TContext> {
    const loader = this.loaders.get(name);
    if (!loader) {
      throw new HsmConfigurationError(
        `Loader "${name}" used by state "${stateId}" is not registered.`
      );
    }
    return loader;
  }

  public normalize(ref: HsmLoaderRef<TContext> | undefined, stateId: string): readonly NamedLoader<TContext>[] {
    if (!ref) return [];
    const refs = Array.isArray(ref) ? ref : [ref];

    return refs.map((item, index) => {
      if (typeof item === "string") return { name: item, run: this.get(item, stateId) };
      return { name: `inline:${index}`, run: item };
    });
  }

  public async runAll(input: HsmLoaderInput<TContext>, ref: HsmLoaderRef<TContext> | undefined): Promise<unknown> {
    const loaders = this.normalize(ref, input.stateId);
    if (loaders.length === 0) return undefined;

    const results: AnyRecord = {};
    for (const loader of loaders) {
      if (input.signal.aborted) throw new DOMException("Transition aborted before loader execution.", "AbortError");
      results[loader.name] = await loader.run(input);
    }

    const names = Object.keys(results);
    if (names.length === 1) return results[names[0] as string];
    return Object.freeze(results);
  }
}
