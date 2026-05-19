import { a as AnyRecord, w as HsmMachineConfig, v as HsmMachine } from './HsmMachine-CnF_DNIZ.cjs';
import { c as HsmSchemaCompileOptions, H as HsmSchema, f as HsmSchemaGuardProbe, a as HsmSchemaActionProbe, h as HsmSchemaLoaderProbe, r as HsmSchemaRuntimeOptions, x as HsmSchemaValidationResult } from './HsmSchema-B7viIf6x.cjs';

declare class HsmError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
declare class HsmConfigurationError extends HsmError {
    constructor(message: string);
}
declare class HsmDuplicateStateError extends HsmError {
    constructor(stateId: string);
}
declare class HsmMissingStateError extends HsmError {
    constructor(stateId: string);
}
declare class HsmMissingGuardError extends HsmError {
    constructor(guardName: string, stateId: string);
}
declare class HsmGuardRejectedError extends HsmError {
    readonly stateId: string;
    readonly guardName: string;
    constructor(stateId: string, guardName: string);
}
declare class HsmRouteNotFoundError extends HsmError {
    constructor(pathname: string);
}
declare class HsmRouteBuildError extends HsmError {
    constructor(message: string);
}
declare class HsmRedirectLoopError extends HsmError {
    constructor(from: string, maxRedirects: number);
}
declare class HsmUnresolvedStateError extends HsmError {
    constructor(stateId: string);
}
declare class HsmQueryParseError extends HsmError {
    constructor(queryKey: string, message: string);
}

interface HsmCompiledSchemaDiagnostics {
    readonly guards: readonly HsmSchemaGuardProbe[];
    readonly actions: readonly HsmSchemaActionProbe[];
    readonly loaders: readonly HsmSchemaLoaderProbe[];
}
declare class SchemaCompiler<TContext extends AnyRecord = AnyRecord> {
    private readonly guardProbes;
    private readonly actionProbes;
    private readonly loaderProbes;
    compile(config: HsmMachineConfig<TContext>, options?: HsmSchemaCompileOptions): HsmSchema;
    diagnostics(): HsmCompiledSchemaDiagnostics;
    private compileState;
    private compileResolve;
    private compileEvents;
    private compileQuery;
    private compilePolicies;
    private compilePolicyDefinitions;
    private compilePolicyMap;
    private compilePolicyRule;
    private compileBackend;
    private trackGuard;
    private trackAction;
    private trackLoader;
    private unique;
}
declare function compileSchema<TContext extends AnyRecord = AnyRecord>(config: HsmMachineConfig<TContext>, options?: HsmSchemaCompileOptions): HsmSchema;
declare function defineHsm<TContext extends AnyRecord = AnyRecord>(config: HsmMachineConfig<TContext>): HsmMachineConfig<TContext>;

declare class SchemaConfigFactory<TContext extends AnyRecord = AnyRecord> {
    fromSchema(schema: HsmSchema, options?: HsmSchemaRuntimeOptions<TContext>): HsmMachineConfig<TContext>;
    private stateFromSchema;
    private policiesFromSchema;
    private policyMapFromSchema;
    private eventsFromSchema;
}

declare class SchemaSerializer {
    private readonly validator;
    toJson(schema: HsmSchema, space?: number | string): string;
    fromJson(input: string): HsmSchema;
    clone(schema: HsmSchema): HsmSchema;
}
declare function schemaToJson(schema: HsmSchema, space?: number | string): string;
declare function schemaFromJson(input: string): HsmSchema;

declare class SchemaValidator {
    validate(schema: unknown): HsmSchemaValidationResult;
    assertValid(schema: unknown): asserts schema is HsmSchema;
    private validateState;
    private expect;
    private issue;
}
declare function validateSchema(schema: unknown): HsmSchemaValidationResult;
declare function assertValidSchema(schema: unknown): asserts schema is HsmSchema;

declare function createHsmFromSchema<TContext extends AnyRecord = AnyRecord>(schema: HsmSchema, options?: HsmSchemaRuntimeOptions<TContext>): HsmMachine<TContext>;

declare class HsmSchemaError extends HsmError {
    constructor(code: string, message: string);
}
declare class HsmSchemaFunctionError extends HsmSchemaError {
    constructor(path: string);
}
declare class HsmSchemaValidationError extends HsmSchemaError {
    constructor(message: string);
}
declare class HsmSchemaParseError extends HsmSchemaError {
    constructor(message: string);
}

export { HsmConfigurationError as H, SchemaCompiler as S, HsmDuplicateStateError as a, HsmError as b, HsmGuardRejectedError as c, HsmMissingGuardError as d, HsmMissingStateError as e, HsmQueryParseError as f, HsmRedirectLoopError as g, HsmRouteBuildError as h, HsmRouteNotFoundError as i, HsmSchemaError as j, HsmSchemaFunctionError as k, HsmSchemaParseError as l, HsmSchemaValidationError as m, HsmUnresolvedStateError as n, SchemaConfigFactory as o, SchemaSerializer as p, SchemaValidator as q, assertValidSchema as r, compileSchema as s, createHsmFromSchema as t, defineHsm as u, schemaFromJson as v, schemaToJson as w, validateSchema as x };
