export class QueryEquality {
  private constructor() {}

  public static same(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      return left.every((item, index) => QueryEquality.same(item, right[index]));
    }
    if (QueryEquality.isPlainRecord(left) && QueryEquality.isPlainRecord(right)) {
      const leftKeys = Object.keys(left).sort();
      const rightKeys = Object.keys(right).sort();
      if (!QueryEquality.same(leftKeys, rightKeys)) return false;
      return leftKeys.every((key) => QueryEquality.same(left[key], right[key]));
    }
    return false;
  }

  private static isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
