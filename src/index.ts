export { createHsm } from "./core/createHsm.js";
export { HsmMachine } from "./core/HsmMachine.js";
export { StateNode } from "./core/StateNode.js";
export { StateTree } from "./core/StateTree.js";
export { GuardRegistry } from "./guards/GuardRegistry.js";
export { ActionRegistry } from "./actions/ActionRegistry.js";
export { LoaderRegistry } from "./loaders/LoaderRegistry.js";
export { LoaderRunner } from "./loaders/LoaderRunner.js";
export { EventDispatcher } from "./events/EventDispatcher.js";
export { StateResolver } from "./resolution/StateResolver.js";
export { RouteTable } from "./routing/RouteTable.js";
export { PathPattern } from "./routing/PathPattern.js";
export { PathComposer } from "./routing/PathComposer.js";
export { UrlTools } from "./routing/UrlTools.js";
export { RouteProjection } from "./routing/RouteProjection.js";
export { UrlStateProjector } from "./query/UrlStateProjector.js";
export { TransitionPlanner } from "./transitions/TransitionPlanner.js";
export { TransitionLifecycle } from "./transitions/TransitionLifecycle.js";
export { TransitionManager } from "./transitions/TransitionManager.js";
export { TransitionAbortController } from "./transitions/TransitionAbortController.js";
export { TransitionResultFactory } from "./transitions/TransitionResultFactory.js";
export type { QueryHydrationResult, QueryProjectionOptions } from "./query/UrlStateProjector.js";
export { QueryBinding } from "./query/QueryBinding.js";
export { QueryCodec } from "./query/QueryCodec.js";
export { ObjectPath } from "./query/ObjectPath.js";
export { query } from "./query/query.js";
export { PolicyEngine } from "./policy/PolicyEngine.js";
export { PolicyEvaluator } from "./policy/PolicyEvaluator.js";
export { PolicyInheritance } from "./policy/PolicyInheritance.js";
export { PermissionResolver } from "./policy/PermissionResolver.js";
export { CapabilityResolver } from "./policy/CapabilityResolver.js";
export { FeatureResolver } from "./policy/FeatureResolver.js";
export { LayoutResolver } from "./policy/LayoutResolver.js";
export { BackendPolicyEnforcer } from "./backend/BackendPolicyEnforcer.js";

export type {
  AnyRecord,
  HsmActionFn,
  HsmActionInput,
  HsmActionMap,
  HsmActionRef,
  HsmContextFactory,
  HsmGuardFn,
  HsmGuardInput,
  HsmGuardMap,
  HsmGuardRef,
  HsmHrefOptions,
  HsmEvent,
  HsmEventContextFactory,
  HsmEventMap,
  HsmEventParamsFactory,
  HsmEventTransitionConfig,
  HsmEventTransitionInput,
  HsmEventTransitionRef,
  HsmLoaderFn,
  HsmLoaderInput,
  HsmLoaderMap,
  HsmLoaderRef,
  HsmPolicyDecision,
  HsmPolicyDefinition,
  HsmPolicyDefinitions,
  HsmPolicyKind,
  HsmPolicyMap,
  HsmPolicyRule,
  HsmPolicySnapshot,
  HsmPolicySource,
  HsmQueryBinding,
  HsmQueryCodecInput,
  HsmQueryCodecOutput,
  HsmQueryDecodeFn,
  HsmQueryEncodeFn,
  HsmQueryInvalidPolicy,
  HsmQuerySchema,
  HsmQueryType,
  HsmQueryValidateFn,
  HsmMachineConfig,
  HsmMeta,
  HsmRedirectTarget,
  HsmResolvedRedirect,
  HsmResolveOptions,
  HsmResolvedState,
  HsmResolvedEventTransition,
  HsmRouteContext,
  HsmRouteEntry,
  HsmRouteEntryKind,
  HsmRouteMatch,
  HsmSelectionRule,
  HsmSnapshot,
  HsmStateBackendConfig,
  HsmStateConfig,
  HsmStateId,
  HsmStateUrlConfig,
  HsmUrlMode,
  HsmStateValue,
  HsmTransitionCause,
  HsmTransitionFailure,
  HsmTransitionFailureReason,
  HsmTransitionLifecycleRecord,
  HsmTransitionOptions,
  HsmTransitionResult,
  HsmTransitionSuccess,
  HsmUrlResolveOptions,
  HsmUrlState,
  HsmUrlSyncOptions,
  HsmUrlTransitionOptions,
  MaybePromise
} from "./core/types.js";

export {
  HsmError,
  HsmConfigurationError,
  HsmDuplicateStateError,
  HsmGuardRejectedError,
  HsmMissingGuardError,
  HsmMissingStateError,
  HsmRedirectLoopError,
  HsmRouteBuildError,
  HsmRouteNotFoundError,
  HsmUnresolvedStateError,
  HsmQueryParseError
} from "./errors/HsmErrors.js";

export { SchemaCompiler, compileSchema, defineHsm } from "./schema/SchemaCompiler.js";
export { SchemaConfigFactory } from "./schema/SchemaConfigFactory.js";
export { SchemaSerializer, schemaFromJson, schemaToJson } from "./schema/SchemaSerializer.js";
export { SchemaValidator, assertValidSchema, validateSchema } from "./schema/SchemaValidator.js";
export { createHsmFromSchema } from "./schema/createHsmFromSchema.js";
export { HsmBackendRuntime, createHsmBackend } from "./backend/HsmBackendRuntime.js";
export { RequestResolver } from "./backend/RequestResolver.js";
export { BackendGuardRegistry } from "./backend/BackendGuardRegistry.js";
export {
  hsmExpressMiddleware,
  requireHsmState,
  requireHsmTag,
  requireHsmPermission,
  requireHsmCapability,
  requireHsmFeature
} from "./backend/adapters/express.js";
export { fromNodeRequest } from "./backend/adapters/node.js";

export type {
  HsmSchema,
  HsmSchemaActionProbe,
  HsmSchemaBackendPolicy,
  HsmSchemaCompileOptions,
  HsmSchemaEventMap,
  HsmSchemaEventTransition,
  HsmSchemaGuardProbe,
  HsmSchemaIndex,
  HsmSchemaLoaderProbe,
  HsmSchemaMetadata,
  HsmSchemaPolicyDefinitions,
  HsmSchemaPolicyMap,
  HsmSchemaPolicyRule,
  HsmSchemaPolicySet,
  HsmSchemaQuery,
  HsmSchemaQueryBinding,
  HsmSchemaRefList,
  HsmSchemaRouteIndexEntry,
  HsmSchemaRuntimeOptions,
  HsmSchemaSelectionRule,
  HsmSchemaStateIndexEntry,
  HsmSchemaStateNode,
  HsmSchemaTransitionHint,
  HsmSchemaValidationIssue,
  HsmSchemaValidationResult,
  HsmSchemaVersion,
  JsonPrimitive,
  JsonValue
} from "./schema/HsmSchema.js";

export type {
  HsmBackendContextFactory,
  HsmBackendContextInput,
  HsmBackendMiddleware,
  HsmBackendMiddlewareOptions,
  HsmBackendNext,
  HsmBackendRequest,
  HsmBackendResolveFailure,
  HsmBackendResolveFailureReason,
  HsmBackendResolveOptions,
  HsmBackendResolveResult,
  HsmBackendResolveSuccess,
  HsmBackendResponse,
  HsmBackendRuntimeConfig
} from "./backend/types.js";

export {
  HsmSchemaError,
  HsmSchemaFunctionError,
  HsmSchemaParseError,
  HsmSchemaValidationError
} from "./schema/SchemaErrors.js";

export { BrowserHistoryAdapter } from "./browser/BrowserHistoryAdapter.js";
export { BrowserUrlRuntime, createHsmBrowserRuntime } from "./browser/BrowserUrlRuntime.js";
export { CanonicalNavigation } from "./browser/CanonicalNavigation.js";
export { HostPolicyAdapter, createHostPolicyAdapter } from "./browser/HostPolicyAdapter.js";
export { PopstateListener } from "./browser/PopstateListener.js";
export { RedirectSafety, createRedirectSafety } from "./browser/RedirectSafety.js";
export { UrlSyncController } from "./browser/UrlSyncController.js";
export type {
  BrowserDebugLogger,
  BrowserHistoryAdapterOptions,
  BrowserHistoryLike,
  BrowserHistoryLocation,
  BrowserLocationLike,
  BrowserNavigationCommit,
  BrowserNavigationMode,
  BrowserNavigationSource,
  BrowserPopstateUnsubscribe,
  BrowserWindowLike,
  CanonicalNavigationOptions,
  HostPolicyAdapterOptions,
  HsmBrowserNavigateOptions,
  HsmBrowserRuntimeOptions,
  HsmBrowserStartOptions,
  HsmBrowserSyncOptions,
  NavigationTarget,
  RedirectSafetyFailure,
  RedirectSafetyFailureReason,
  RedirectSafetyOptions,
  RedirectSafetyResult,
  RedirectSafetySuccess,
  SubdomainPolicyRuntime,
  SubdomainPolicyRuntimeDependencies
} from "./browser/types.js";

export { createHsmVue, createHsmVueRuntime, useHsm, useHsmRuntime, useHsmState, useHsmPolicy, MachineOutlet } from "./vue/index.js";
export type { HsmVuePluginOptions, HsmVueRuntime, MachineOutletSlotProps } from "./vue/index.js";
export { DebugEventBus, DevtoolsTimeline, SnapshotInspector, TransitionTrace, createHsmDevtools, attachHsmDevtools } from "./devtools/index.js";
export type {
  HsmDebugEvent,
  HsmDebugEventType,
  HsmDebugListener,
  DevtoolsTimelineOptions,
  SnapshotInspection,
  TransitionTraceEntry,
  HsmDevtools,
  HsmDevtoolsOptions
} from "./devtools/index.js";
