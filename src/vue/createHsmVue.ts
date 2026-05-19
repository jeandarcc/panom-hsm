import { shallowRef, type App, type ShallowRef } from "vue";
import type { AnyRecord, HsmSnapshot, HsmTransitionResult } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import { hsmVueRuntimeKey, type HsmVueRuntime } from "./symbols.js";

export interface HsmVuePluginOptions<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: HsmMachine<TContext>;
  /** Defaults to true. Decorates state-changing methods so Vue refs stay current. */
  readonly bindTransitions?: boolean;
  /** Optional callback for surfaced runtime errors. */
  readonly onError?: (error: unknown) => void;
}

function readCurrent<TContext extends AnyRecord>(hsm: HsmMachine<TContext>): HsmSnapshot<TContext> | null {
  return hsm.current;
}

function updateSnapshot<TContext extends AnyRecord>(
  hsm: HsmMachine<TContext>,
  snapshot: ShallowRef<HsmSnapshot<TContext> | null>,
  ready: ShallowRef<boolean>,
  error: ShallowRef<unknown>,
  caught?: unknown
): void {
  if (caught !== undefined) {
    error.value = caught;
    return;
  }
  snapshot.value = readCurrent(hsm);
  ready.value = snapshot.value !== null;
  error.value = null;
}

function patchAsyncMethod<TContext extends AnyRecord, TArgs extends unknown[], TResult>(
  hsm: HsmMachine<TContext>,
  methodName: keyof HsmMachine<TContext>,
  snapshot: ShallowRef<HsmSnapshot<TContext> | null>,
  ready: ShallowRef<boolean>,
  error: ShallowRef<unknown>,
  onError?: (error: unknown) => void
): void {
  const target = hsm as unknown as Record<string, (...args: TArgs) => Promise<TResult>>;
  const original = target[methodName as string];
  if (typeof original !== "function") return;
  if ((original as any).__panomHsmVuePatched) return;

  const wrapped = async (...args: TArgs): Promise<TResult> => {
    try {
      const result = await original.apply(hsm, args);
      const maybeTransition = result as HsmTransitionResult<TContext> | undefined;
      if (maybeTransition && typeof maybeTransition === "object" && "ok" in maybeTransition) {
        if (maybeTransition.ok) {
          snapshot.value = maybeTransition.snapshot;
          ready.value = true;
          error.value = null;
        } else {
          updateSnapshot(hsm, snapshot, ready, error, maybeTransition.error);
          onError?.(maybeTransition.error);
        }
      } else {
        updateSnapshot(hsm, snapshot, ready, error);
      }
      return result;
    } catch (caught) {
      updateSnapshot(hsm, snapshot, ready, error, caught);
      onError?.(caught);
      throw caught;
    }
  };

  Object.defineProperty(wrapped, "__panomHsmVuePatched", { value: true });
  target[methodName as string] = wrapped;
}

export function createHsmVueRuntime<TContext extends AnyRecord = AnyRecord>(
  options: HsmVuePluginOptions<TContext>
): HsmVueRuntime<TContext> {
  const snapshot = shallowRef<HsmSnapshot<TContext> | null>(options.hsm.current);
  const ready = shallowRef(snapshot.value !== null);
  const error = shallowRef<unknown>(null);

  const runtime: HsmVueRuntime<TContext> = {
    hsm: options.hsm,
    snapshot,
    ready,
    error,
    refresh() {
      updateSnapshot(options.hsm, snapshot, ready, error);
    }
  };

  if (options.bindTransitions ?? true) {
    patchAsyncMethod(options.hsm, "start", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "transition", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "transitionUrl", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "navigate", snapshot, ready, error, options.onError);
    patchAsyncMethod(options.hsm, "send", snapshot, ready, error, options.onError);
  }

  return runtime;
}

export function createHsmVue<TContext extends AnyRecord = AnyRecord>(options: HsmVuePluginOptions<TContext>) {
  const runtime = createHsmVueRuntime(options);
  return {
    runtime,
    install(app: App) {
      app.provide(hsmVueRuntimeKey, runtime);
      app.config.globalProperties.$hsm = runtime.hsm;
    }
  };
}
