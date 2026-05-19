import { a0 as HsmSnapshot, a as AnyRecord, ac as HsmTransitionResult, v as HsmMachine } from '../HsmMachine-CnF_DNIZ.cjs';

type HsmDebugEventType = "snapshot" | "transition:start" | "transition:success" | "transition:failure" | "navigation" | "policy:decision" | "error";
interface HsmDebugEvent<TPayload = unknown> {
    readonly type: HsmDebugEventType;
    readonly timestamp: number;
    readonly payload: TPayload;
}
type HsmDebugListener = (event: HsmDebugEvent) => void;
declare class DebugEventBus {
    private readonly listeners;
    on(listener: HsmDebugListener): () => void;
    emit<TPayload>(type: HsmDebugEventType, payload: TPayload): HsmDebugEvent<TPayload>;
    clear(): void;
}

interface DevtoolsTimelineOptions {
    readonly limit?: number;
}
declare class DevtoolsTimeline {
    private readonly limit;
    private readonly eventsInternal;
    constructor(options?: DevtoolsTimelineOptions);
    record(event: HsmDebugEvent): HsmDebugEvent;
    events(): readonly HsmDebugEvent[];
    latest(): HsmDebugEvent | undefined;
    clear(): void;
}

interface SnapshotInspection {
    readonly stateId: string;
    readonly activePath: readonly string[];
    readonly params: Readonly<AnyRecord>;
    readonly tags: readonly string[];
    readonly route?: {
        readonly pathname: string;
        readonly canonicalPathname: string;
        readonly pattern: string;
        readonly isCanonical: boolean;
    };
    readonly policy?: {
        readonly layout?: string;
        readonly permissions: readonly string[];
        readonly capabilities: readonly string[];
        readonly features: readonly string[];
        readonly deniedPermissions: readonly string[];
        readonly deniedCapabilities: readonly string[];
        readonly deniedFeatures: readonly string[];
    };
}
declare class SnapshotInspector {
    inspect(snapshot: HsmSnapshot): SnapshotInspection;
}

interface TransitionTraceEntry<TContext extends AnyRecord = AnyRecord> {
    readonly fromStateId: string | null;
    readonly toStateId: string | null;
    readonly ok: boolean;
    readonly cause: string;
    readonly durationMs: number;
    readonly error?: unknown;
    readonly snapshot?: HsmSnapshot<TContext>;
}
declare class TransitionTrace {
    private startedAt;
    private fromStateId;
    start(from: HsmSnapshot | null): void;
    finish<TContext extends AnyRecord>(result: HsmTransitionResult<TContext>): TransitionTraceEntry<TContext>;
}

interface HsmDevtoolsOptions {
    readonly timelineLimit?: number;
    readonly patchMachine?: boolean;
    readonly logger?: (event: HsmDebugEvent) => void;
}
interface HsmDevtools<TContext extends AnyRecord = AnyRecord> {
    readonly bus: DebugEventBus;
    readonly timeline: DevtoolsTimeline;
    readonly inspector: SnapshotInspector;
    on(listener: HsmDebugListener): () => void;
    events(): readonly HsmDebugEvent[];
    inspect(snapshot?: HsmSnapshot<TContext> | null): SnapshotInspection | null;
    clear(): void;
}
declare function createHsmDevtools<TContext extends AnyRecord = AnyRecord>(hsm: HsmMachine<TContext>, options?: HsmDevtoolsOptions): HsmDevtools<TContext>;
declare const attachHsmDevtools: typeof createHsmDevtools;

export { DebugEventBus, DevtoolsTimeline, type DevtoolsTimelineOptions, type HsmDebugEvent, type HsmDebugEventType, type HsmDebugListener, type HsmDevtools, type HsmDevtoolsOptions, type SnapshotInspection, SnapshotInspector, TransitionTrace, type TransitionTraceEntry, attachHsmDevtools, createHsmDevtools };
