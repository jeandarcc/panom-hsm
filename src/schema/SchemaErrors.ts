import { HsmError } from "../errors/HsmErrors.js";

export class HsmSchemaError extends HsmError {
  public constructor(code: string, message: string) {
    super(code, message);
  }
}

export class HsmSchemaFunctionError extends HsmSchemaError {
  public constructor(path: string) {
    super(
      "HSM_SCHEMA_FUNCTION_NOT_SERIALIZABLE",
      `HSM schema cannot serialize functions. Replace function at "${path}" with a named registry reference.`
    );
  }
}

export class HsmSchemaValidationError extends HsmSchemaError {
  public constructor(message: string) {
    super("HSM_SCHEMA_VALIDATION_ERROR", message);
  }
}

export class HsmSchemaParseError extends HsmSchemaError {
  public constructor(message: string) {
    super("HSM_SCHEMA_PARSE_ERROR", message);
  }
}
