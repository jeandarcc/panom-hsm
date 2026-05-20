import type { HsmTest } from "./types.js";

export function isHsmTest(value: unknown): value is HsmTest {
  return Boolean(value && typeof value === "object" && (value as HsmTest).kind === "hsm-test");
}
