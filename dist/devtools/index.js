// src/devtools/DebugEventBus.ts
var DebugEventBus = class {
  listeners = /* @__PURE__ */ new Set();
  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(type, payload) {
    const event = Object.freeze({ type, timestamp: Date.now(), payload });
    for (const listener of this.listeners) listener(event);
    return event;
  }
  clear() {
    this.listeners.clear();
  }
};

// src/devtools/DevtoolsTimeline.ts
var DevtoolsTimeline = class {
  limit;
  eventsInternal = [];
  constructor(options = {}) {
    this.limit = options.limit ?? 500;
  }
  record(event) {
    this.eventsInternal.push(event);
    while (this.eventsInternal.length > this.limit) this.eventsInternal.shift();
    return event;
  }
  events() {
    return Object.freeze([...this.eventsInternal]);
  }
  latest() {
    return this.eventsInternal[this.eventsInternal.length - 1];
  }
  clear() {
    this.eventsInternal.length = 0;
  }
};

// src/devtools/SnapshotInspector.ts
var SnapshotInspector = class {
  inspect(snapshot) {
    const route = snapshot.route ? {
      pathname: snapshot.route.pathname,
      canonicalPathname: snapshot.route.canonicalPathname,
      pattern: snapshot.route.pattern,
      isCanonical: snapshot.route.isCanonical
    } : void 0;
    const policy = snapshot.policy ? {
      ...snapshot.policy.layout ? { layout: snapshot.policy.layout } : {},
      permissions: snapshot.policy.permissions,
      capabilities: snapshot.policy.capabilities,
      features: snapshot.policy.features,
      deniedPermissions: snapshot.policy.deniedPermissions,
      deniedCapabilities: snapshot.policy.deniedCapabilities,
      deniedFeatures: snapshot.policy.deniedFeatures
    } : void 0;
    return Object.freeze({
      stateId: snapshot.stateId,
      activePath: snapshot.activePath,
      params: snapshot.params,
      tags: snapshot.tags,
      ...route ? { route } : {},
      ...policy ? { policy } : {}
    });
  }
};

// src/devtools/TransitionTrace.ts
var TransitionTrace = class {
  startedAt = 0;
  fromStateId = null;
  start(from) {
    this.startedAt = performanceNow();
    this.fromStateId = from?.stateId ?? null;
  }
  finish(result) {
    const durationMs = Math.max(0, performanceNow() - this.startedAt);
    if (result.ok) {
      return Object.freeze({
        fromStateId: this.fromStateId,
        toStateId: result.snapshot.stateId,
        ok: true,
        cause: result.cause,
        durationMs,
        snapshot: result.snapshot
      });
    }
    return Object.freeze({
      fromStateId: result.from?.stateId ?? this.fromStateId,
      toStateId: result.targetStateId ?? null,
      ok: false,
      cause: result.cause,
      durationMs,
      error: result.error
    });
  }
};
function performanceNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

// src/devtools/createHsmDevtools.ts
function createHsmDevtools(hsm, options = {}) {
  const bus = new DebugEventBus();
  const timeline = new DevtoolsTimeline(options.timelineLimit === void 0 ? {} : { limit: options.timelineLimit });
  const inspector = new SnapshotInspector();
  bus.on((event) => {
    timeline.record(event);
    options.logger?.(event);
  });
  const devtools = {
    bus,
    timeline,
    inspector,
    on: (listener) => bus.on(listener),
    events: () => timeline.events(),
    inspect: (snapshot = hsm.current) => snapshot ? inspector.inspect(snapshot) : null,
    clear() {
      timeline.clear();
    }
  };
  if (options.patchMachine ?? true) patchMachine(hsm, bus);
  return devtools;
}
var attachHsmDevtools = createHsmDevtools;
function patchMachine(hsm, bus) {
  patchTransitionMethod(hsm, "transition", bus);
  patchTransitionMethod(hsm, "transitionUrl", bus);
  patchTransitionMethod(hsm, "send", bus);
  const target = hsm;
  const start = target.start;
  if (typeof start === "function" && !start.__panomHsmDevtoolsPatched) {
    const wrapped = async (...args) => {
      bus.emit("transition:start", { method: "start", fromStateId: hsm.current?.stateId ?? null });
      try {
        const snapshot = await start.apply(hsm, args);
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
function patchTransitionMethod(hsm, methodName, bus) {
  const target = hsm;
  const original = target[methodName];
  if (typeof original !== "function") return;
  if (original.__panomHsmDevtoolsPatched) return;
  const wrapped = async (...args) => {
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

export { DebugEventBus, DevtoolsTimeline, SnapshotInspector, TransitionTrace, attachHsmDevtools, createHsmDevtools };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map