export class HsmError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class HsmConfigurationError extends HsmError {
  public constructor(message: string) {
    super("HSM_CONFIGURATION_ERROR", message);
  }
}

export class HsmDuplicateStateError extends HsmError {
  public constructor(stateId: string) {
    super("HSM_DUPLICATE_STATE", `Duplicate state id: ${stateId}`);
  }
}

export class HsmMissingStateError extends HsmError {
  public constructor(stateId: string) {
    super("HSM_MISSING_STATE", `State does not exist: ${stateId}`);
  }
}

export class HsmMissingGuardError extends HsmError {
  public constructor(guardName: string, stateId: string) {
    super(
      "HSM_MISSING_GUARD",
      `Guard "${guardName}" used by state "${stateId}" is not registered.`
    );
  }
}

export class HsmGuardRejectedError extends HsmError {
  public readonly stateId: string;
  public readonly guardName: string;

  public constructor(stateId: string, guardName: string) {
    super(
      "HSM_GUARD_REJECTED",
      `Guard "${guardName}" rejected transition into state "${stateId}".`
    );
    this.stateId = stateId;
    this.guardName = guardName;
  }
}

export class HsmRouteNotFoundError extends HsmError {
  public constructor(pathname: string) {
    super("HSM_ROUTE_NOT_FOUND", `No HSM route matched pathname: ${pathname}`);
  }
}

export class HsmRouteBuildError extends HsmError {
  public constructor(message: string) {
    super("HSM_ROUTE_BUILD_ERROR", message);
  }
}

export class HsmRedirectLoopError extends HsmError {
  public constructor(from: string, maxRedirects: number) {
    super(
      "HSM_REDIRECT_LOOP",
      `Stopped resolving redirects from "${from}" after ${maxRedirects} redirects.`
    );
  }
}

export class HsmUnresolvedStateError extends HsmError {
  public constructor(stateId: string) {
    super("HSM_UNRESOLVED_STATE", `State "${stateId}" could not be resolved by selection rules.`);
  }
}

export class HsmQueryParseError extends HsmError {
  public constructor(queryKey: string, message: string) {
    const prefix = queryKey ? `Invalid query value for "${queryKey}". ` : "Invalid query value. ";
    super("HSM_QUERY_PARSE_ERROR", `${prefix}${message}`);
  }
}
