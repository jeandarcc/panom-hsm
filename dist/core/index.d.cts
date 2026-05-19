export { S as SnapshotFactory, c as createHsm } from '../SnapshotFactory-Dzkezqc-.cjs';
export { a as AnyRecord, H as HsmActionFn, b as HsmActionInput, c as HsmActionMap, d as HsmActionRef, e as HsmContextFactory, f as HsmEvent, g as HsmEventContextFactory, h as HsmEventMap, i as HsmEventParamsFactory, j as HsmEventTransitionConfig, k as HsmEventTransitionInput, l as HsmEventTransitionRef, m as HsmGuardFn, n as HsmGuardInput, o as HsmGuardMap, p as HsmGuardRef, q as HsmHrefOptions, r as HsmLoaderFn, s as HsmLoaderInput, t as HsmLoaderMap, u as HsmLoaderRef, v as HsmMachine, w as HsmMachineConfig, x as HsmMeta, y as HsmPolicyDecision, z as HsmPolicyDefinition, B as HsmPolicyDefinitions, C as HsmPolicyKind, D as HsmPolicyMap, E as HsmPolicyRule, F as HsmPolicySnapshot, I as HsmPolicySource, J as HsmQueryBinding, K as HsmQueryCodecInput, L as HsmQueryCodecOutput, M as HsmQueryDecodeFn, N as HsmQueryEncodeFn, O as HsmQueryInvalidPolicy, P as HsmQuerySchema, Q as HsmQueryType, R as HsmQueryValidateFn, S as HsmRedirectTarget, T as HsmResolveOptions, U as HsmResolvedEventTransition, V as HsmResolvedRedirect, W as HsmResolvedState, X as HsmRouteContext, Y as HsmRouteEntry, Z as HsmRouteEntryKind, _ as HsmRouteMatch, $ as HsmSelectionRule, a0 as HsmSnapshot, a1 as HsmStateBackendConfig, a2 as HsmStateConfig, a3 as HsmStateId, a4 as HsmStateUrlConfig, a5 as HsmStateValue, a6 as HsmStateValueObject, a7 as HsmTransitionCause, a8 as HsmTransitionFailure, a9 as HsmTransitionFailureReason, aa as HsmTransitionLifecycleRecord, ab as HsmTransitionOptions, ac as HsmTransitionResult, ad as HsmTransitionSuccess, ae as HsmUrlMode, af as HsmUrlResolveOptions, ag as HsmUrlState, ah as HsmUrlSyncOptions, ai as HsmUrlTransitionOptions, ak as MaybePromise, aq as StateNode, ar as StateTree } from '../HsmMachine-CnF_DNIZ.cjs';

declare class HsmPath {
    static readonly separator = ".";
    private constructor();
    static validateMachineId(machineId: string): void;
    static validateStateKey(key: string): void;
    static join(parentId: string | null, key: string): string;
    static split(stateId: string): readonly string[];
    static isAncestor(ancestorId: string, stateId: string): boolean;
}

export { HsmPath };
