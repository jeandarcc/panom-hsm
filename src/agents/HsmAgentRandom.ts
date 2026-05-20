export class HsmAgentRandom {
  private readonly seed: string;
  private state: number;

  public constructor(seed: string) {
    this.seed = seed;
    this.state = hashSeed(seed);
  }

  public next(): number {
    this.state = mulberry32(this.state);
    return this.state / 4294967296;
  }

  public int(min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(this.next() * (high - low + 1)) + low;
  }

  public bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  public pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new Error("Cannot pick from an empty array.");
    }
    const index = this.int(0, values.length - 1);
    return values[index] as T;
  }

  public child(label: string): HsmAgentRandom {
    return new HsmAgentRandom(`${this.seed}:${label}`);
  }

  public getSeed(): string {
    return this.seed;
  }
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(value: number): number {
  let t = value + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}
