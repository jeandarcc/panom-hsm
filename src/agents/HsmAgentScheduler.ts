export class HsmAgentScheduler {
  public constructor(private readonly maxConcurrency: number) {}

  public async runAll<T>(tasks: readonly (() => Promise<T>)[]): Promise<readonly T[]> {
    const results: T[] = [];
    let index = 0;

    const runNext = async (): Promise<void> => {
      const current = index;
      if (current >= tasks.length) return;
      index += 1;
      const result = await tasks[current]?.();
      results[current] = result as T;
      await runNext();
    };

    const workers = Array.from({ length: Math.min(this.maxConcurrency, tasks.length) }, () => runNext());
    await Promise.all(workers);
    return Object.freeze(results);
  }
}
