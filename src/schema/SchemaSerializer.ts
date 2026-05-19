import type { HsmSchema } from "./HsmSchema.js";
import { HsmSchemaParseError } from "./SchemaErrors.js";
import { SchemaValidator } from "./SchemaValidator.js";

export class SchemaSerializer {
  private readonly validator = new SchemaValidator();

  public toJson(schema: HsmSchema, space: number | string = 2): string {
    const validator: SchemaValidator = this.validator;
    validator.assertValid(schema);
    return `${JSON.stringify(schema, null, space)}\n`;
  }

  public fromJson(input: string): HsmSchema {
    try {
      const parsed = JSON.parse(input) as unknown;
      const validator: SchemaValidator = this.validator;
      validator.assertValid(parsed);
      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new HsmSchemaParseError(error.message);
      }
      throw error;
    }
  }

  public clone(schema: HsmSchema): HsmSchema {
    return this.fromJson(this.toJson(schema, 0));
  }
}

export function schemaToJson(schema: HsmSchema, space: number | string = 2): string {
  return new SchemaSerializer().toJson(schema, space);
}

export function schemaFromJson(input: string): HsmSchema {
  return new SchemaSerializer().fromJson(input);
}
