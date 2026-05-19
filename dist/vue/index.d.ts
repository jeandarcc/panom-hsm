import * as vue from 'vue';
import { ShallowRef, InjectionKey, App, PropType, Component } from 'vue';
import { a as AnyRecord, v as HsmMachine, a0 as HsmSnapshot, a3 as HsmStateId, Z as HsmRouteEntryKind, F as HsmPolicySnapshot } from '../HsmMachine-CnF_DNIZ.js';

interface HsmVueRuntime<TContext extends AnyRecord = AnyRecord> {
    readonly hsm: HsmMachine<TContext>;
    readonly snapshot: ShallowRef<HsmSnapshot<TContext> | null>;
    readonly ready: ShallowRef<boolean>;
    readonly error: ShallowRef<unknown>;
    refresh(): void;
}
declare const hsmVueRuntimeKey: InjectionKey<HsmVueRuntime<any>>;

interface HsmVuePluginOptions<TContext extends AnyRecord = AnyRecord> {
    readonly hsm: HsmMachine<TContext>;
    /** Defaults to true. Decorates state-changing methods so Vue refs stay current. */
    readonly bindTransitions?: boolean;
    /** Optional callback for surfaced runtime errors. */
    readonly onError?: (error: unknown) => void;
}
declare function createHsmVueRuntime<TContext extends AnyRecord = AnyRecord>(options: HsmVuePluginOptions<TContext>): HsmVueRuntime<TContext>;
declare function createHsmVue<TContext extends AnyRecord = AnyRecord>(options: HsmVuePluginOptions<TContext>): {
    runtime: HsmVueRuntime<TContext>;
    install(app: App): void;
};

declare function useHsmRuntime<TContext extends AnyRecord = AnyRecord>(): HsmVueRuntime<TContext>;
declare function useHsm<TContext extends AnyRecord = AnyRecord>(): HsmMachine<TContext>;

declare function useHsmState<TContext extends AnyRecord = AnyRecord>(): {
    snapshot: vue.ShallowRef<HsmSnapshot<TContext> | null>;
    ready: vue.ShallowRef<boolean>;
    error: vue.ShallowRef<unknown>;
    stateId: vue.ComputedRef<string | null>;
    context: vue.ComputedRef<Readonly<TContext> | null>;
    params: vue.ComputedRef<Readonly<AnyRecord> | null>;
    route: vue.ComputedRef<{
        readonly pattern: string;
        readonly canonicalPattern: string;
        readonly pathname: string;
        readonly canonicalPathname: string;
        readonly query: Readonly<AnyRecord>;
        readonly hash: string;
        readonly matchedStateId: HsmStateId;
        readonly kind: HsmRouteEntryKind;
        readonly isCanonical: boolean;
    } | null>;
    is: (stateId: string) => boolean;
    hasTag: (tag: string) => boolean;
    refresh: () => void;
};

declare function useHsmPolicy<TContext extends AnyRecord = AnyRecord>(): {
    policy: vue.ComputedRef<HsmPolicySnapshot | null>;
    layout: vue.ComputedRef<string | undefined>;
    permissions: vue.ComputedRef<readonly string[]>;
    capabilities: vue.ComputedRef<readonly string[]>;
    features: vue.ComputedRef<readonly string[]>;
    can: (permission: string) => boolean;
    canUse: (capability: string) => boolean;
    feature: (feature: string) => boolean;
};

interface MachineOutletSlotProps<TContext extends AnyRecord = AnyRecord> {
    readonly snapshot: HsmSnapshot<TContext>;
    readonly stateId: string;
}
declare const MachineOutlet: vue.DefineComponent<vue.ExtractPropTypes<{
    components: {
        type: PropType<Record<string, Component>>;
        default: () => {};
    };
    fallback: {
        type: PropType<Component | string | null>;
        default: null;
    };
}>, () => vue.VNode<vue.RendererNode, vue.RendererElement, {
    [key: string]: any;
}> | vue.VNode<vue.RendererNode, vue.RendererElement, {
    [key: string]: any;
}>[] | null, {}, {}, {}, vue.ComponentOptionsMixin, vue.ComponentOptionsMixin, {}, string, vue.PublicProps, Readonly<vue.ExtractPropTypes<{
    components: {
        type: PropType<Record<string, Component>>;
        default: () => {};
    };
    fallback: {
        type: PropType<Component | string | null>;
        default: null;
    };
}>> & Readonly<{}>, {
    components: Record<string, Component>;
    fallback: string | Component | null;
}, {}, {}, {}, string, vue.ComponentProvideOptions, true, {}, any>;

export { type HsmVuePluginOptions, type HsmVueRuntime, MachineOutlet, type MachineOutletSlotProps, createHsmVue, createHsmVueRuntime, hsmVueRuntimeKey, useHsm, useHsmPolicy, useHsmRuntime, useHsmState };
