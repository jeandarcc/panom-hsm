import type { AnyRecord } from "../core/types.js";
import { createHsm } from "../core/createHsm.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema, HsmSchemaRuntimeOptions } from "./HsmSchema.js";
import { SchemaConfigFactory } from "./SchemaConfigFactory.js";
import { SchemaValidator } from "./SchemaValidator.js";

export function createHsmFromSchema<TContext extends AnyRecord = AnyRecord>(
  schema: HsmSchema,
  options: HsmSchemaRuntimeOptions<TContext> = {}
): HsmMachine<TContext> {
  const validator: SchemaValidator = new SchemaValidator();
  validator.assertValid(schema);
  const config = new SchemaConfigFactory<TContext>().fromSchema(schema, options);
  return createHsm(config);
}
