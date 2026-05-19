import { invariant } from "../utils/assert.js";

const STATE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$-]*$/;

export class HsmPath {
  public static readonly separator = ".";

  private constructor() {}

  public static validateMachineId(machineId: string): void {
    invariant(machineId.trim().length > 0, "Machine id cannot be empty.");
  }

  public static validateStateKey(key: string): void {
    invariant(key.trim().length > 0, "State key cannot be empty.");
    invariant(
      STATE_KEY_RE.test(key),
      `Invalid state key "${key}". Use letters, numbers, _, $ or - and do not start with a number.`
    );
  }

  public static join(parentId: string | null, key: string): string {
    this.validateStateKey(key);
    return parentId ? `${parentId}${this.separator}${key}` : key;
  }

  public static split(stateId: string): readonly string[] {
    invariant(stateId.trim().length > 0, "State id cannot be empty.");
    const parts = stateId.split(this.separator);
    for (const part of parts) this.validateStateKey(part);
    return parts;
  }

  public static isAncestor(ancestorId: string, stateId: string): boolean {
    return stateId === ancestorId || stateId.startsWith(`${ancestorId}${this.separator}`);
  }
}
