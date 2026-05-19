import type { AnyRecord, HsmSnapshot, HsmTransitionResult } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import { DebugEventBus, type HsmDebugEvent, type HsmDebugListener } from "./DebugEventBus.js";
import { DevtoolsTimeline } from "./DevtoolsTimeline.js";
import { SnapshotInspector, type SnapshotInspection } from "./SnapshotInspector.js";
import { TransitionTrace } from "./TransitionTrace.js";

export interface HsmDevtoolsOptions {
  readonly timelineLimit?: number;
  readonly patchMachine?: boolean;
  readonly logger?: (event: HsmDebugEvent) => void;
}

export interface HsmDevtools<TContext extends AnyRecord = AnyRecord> {
  readonly bus: DebugEventBus;
  readonly timeline: DevtoolsTimeline;
  readonly inspector: SnapshotInspector;
  on(listener: HsmDebugListener): () => void;
  events(): readonly HsmDebugEvent[];
  inspect(snapshot?: HsmSnapshot<TContext> | null): SnapshotInspection | null;
  clear(): void;
}

export function createHsmDevtools<TContext extends AnyRecord = AnyRecord>(
  hsm: HsmMachine<TContext>,
  options: HsmDevtoolsOptions = {}
): HsmDevtools<TContext> {
  const bus = new DebugEventBus();
  const timeline = new DevtoolsTimeline(options.timelineLimit === undefined ? {} : { limit: options.timelineLimit });
  const inspector = new SnapshotInspector();
  bus.on((event) => {
    timeline.record(event);
    options.logger?.(event);
  });

  const devtools: HsmDevtools<TContext> = {
    bus,
    timeline,
    inspector,
    on: (listener) => bus.on(listener),
    events: () => timeline.events(),
    inspect: (snapshot = hsm.current) => (snapshot ? inspector.inspect(snapshot) : null),
    clear() {
      timeline.clear();
    }
  };

  if (options.patchMachine ?? true) patchMachine(hsm, bus);
  return devtools;
}

export const attachHsmDevtools = createHsmDevtools;

function patchMachine<TContext extends AnyRecord>(hsm: HsmMachine<TContext>, bus: DebugEventBus): void {
  patchTransitionMethod(hsm, "transition", bus);
  patchTransitionMethod(hsm, "transitionUrl", bus);
  patchTransitionMethod(hsm, "send", bus);

  const target = hsm as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  const start = target.start;
  if (typeof start === "function" && !(start as any).__panomHsmDevtoolsPatched) {
    const wrapped = async (...args: unknown[]) => {
      bus.emit("transition:start", { method: "start", fromStateId: hsm.current?.stateId ?? null });
      try {
        const snapshot = await start.apply(hsm, args) as HsmSnapshot<TContext>;
        bus.emit("snapshot", { snapshot });
        bus.emit("transition:success", { method: "start", toStateId: snapshot.stateId, snapshot });
        return snapshot;
      } catch (error) {
        bus.emit("error", { method: "start", error });
        throw error;
      }
    };
    Object.defineProperty(wrapped, "__panomHsmDevtoolsPatched", { value: true });
    target.start = wrapped;
  }
}

function patchTransitionMethod<TContext extends AnyRecord>(
  hsm: HsmMachine<TContext>,
  methodName: "transition" | "transitionUrl" | "send",
  bus: DebugEventBus
): void {
  const target = hsm as unknown as Record<string, (...args: unknown[]) => Promise<HsmTransitionResult<TContext>>>;
  const original = target[methodName];
  if (typeof original !== "function") return;
  if ((original as any).__panomHsmDevtoolsPatched) return;

  const wrapped = async (...args: unknown[]): Promise<HsmTransitionResult<TContext>> => {
    const trace = new TransitionTrace();
    trace.start(hsm.current);
    bus.emit("transition:start", { method: methodName, fromStateId: hsm.current?.stateId ?? null, args });
    try {
      const result = await original.apply(hsm, args);
      const entry = trace.finish(result);
      if (result.ok) {
        bus.emit("snapshot", { snapshot: result.snapshot });
        bus.emit("transition:success", { method: methodName, trace: entry });
      } else {
        bus.emit("transition:failure", { method: methodName, trace: entry });
      }
      return result;
    } catch (error) {
      bus.emit("error", { method: methodName, error });
      throw error;
    }
  };

  Object.defineProperty(wrapped, "__panomHsmDevtoolsPatched", { value: true });
  target[methodName] = wrapped;
}
