import type { HsmSchema, HsmSchemaStateNode, HsmSchemaValidationIssue, HsmSchemaValidationResult } from "./HsmSchema.js";
import { HsmSchemaValidationError } from "./SchemaErrors.js";

export class SchemaValidator {
  public validate(schema: unknown): HsmSchemaValidationResult {
    const issues: HsmSchemaValidationIssue[] = [];

    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      return { ok: false, issues: [{ path: "$", message: "Schema must be an object.", severity: "error" }] };
    }

    const candidate = schema as Partial<HsmSchema>;
    this.expect(candidate.kind === "panom-hsm.schema", "$kind", "Expected kind to be panom-hsm.schema.", issues);
    this.expect(candidate.schemaVersion === "1.0", "$.schemaVersion", "Unsupported schemaVersion.", issues);
    this.expect(typeof candidate.id === "string" && candidate.id.length > 0, "$.id", "Schema id is required.", issues);
    this.expect(typeof candidate.version === "string" && candidate.version.length > 0, "$.version", "Schema version is required.", issues);
    this.expect(Boolean(candidate.states) && typeof candidate.states === "object", "$.states", "States object is required.", issues);
    this.expect(Boolean(candidate.index) && typeof candidate.index === "object", "$.index", "Index object is required.", issues);

    if (candidate.states && typeof candidate.states === "object") {
      const seen = new Set<string>();
      for (const [key, state] of Object.entries(candidate.states as Record<string, HsmSchemaStateNode>)) {
        this.validateState(state, `$.states.${key}`, null, seen, issues);
      }
    }

    if (candidate.index?.states) {
      const stateIds = new Set<string>();
      for (const entry of candidate.index.states) stateIds.add(entry.id);
      if (candidate.index.routes) {
        for (const [index, route] of candidate.index.routes.entries()) {
          this.expect(stateIds.has(route.stateId), `$.index.routes[${index}].stateId`, `Route points to missing state: ${route.stateId}.`, issues);
        }
      }
    }

    return Object.freeze({ ok: !issues.some((issue) => issue.severity === "error"), issues: Object.freeze(issues) });
  }

  public assertValid(schema: unknown): asserts schema is HsmSchema {
    const result = this.validate(schema);
    if (!result.ok) {
      throw new HsmSchemaValidationError(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    }
  }

  private validateState(
    state: HsmSchemaStateNode,
    path: string,
    parentId: string | null,
    seen: Set<string>,
    issues: HsmSchemaValidationIssue[]
  ): void {
    this.expect(Boolean(state) && typeof state === "object", path, "State must be an object.", issues);
    if (!state || typeof state !== "object") return;

    this.expect(typeof state.key === "string" && state.key.length > 0, `${path}.key`, "State key is required.", issues);
    this.expect(typeof state.id === "string" && state.id.length > 0, `${path}.id`, "State id is required.", issues);
    if (seen.has(state.id)) {
      this.issue(`${path}.id`, `Duplicate state id: ${state.id}.`, issues);
    }
    seen.add(state.id);

    if (parentId && !state.id.startsWith(`${parentId}.`)) {
      this.issue(`${path}.id`, `Child id must be nested below parent id ${parentId}.`, issues);
    }

    for (const [field, refs] of Object.entries({
      guard: state.guard,
      beforeLeave: state.beforeLeave,
      beforeEnter: state.beforeEnter,
      entry: state.entry,
      exit: state.exit,
      onEnter: state.onEnter,
      onLeave: state.onLeave,
      afterEnter: state.afterEnter,
      loader: state.loader
    })) {
      if (!refs) continue;
      this.expect(Array.isArray(refs.refs), `${path}.${field}.refs`, "Reference list must contain refs array.", issues);
      for (const [index, ref] of refs.refs.entries()) {
        this.expect(typeof ref === "string" && ref.length > 0, `${path}.${field}.refs[${index}]`, "Reference must be a non-empty string.", issues);
      }
    }

    if (state.states) {
      for (const [childKey, child] of Object.entries(state.states)) {
        this.validateState(child, `${path}.states.${childKey}`, state.id, seen, issues);
      }
    }
  }

  private expect(condition: boolean, path: string, message: string, issues: HsmSchemaValidationIssue[]): void {
    if (!condition) this.issue(path, message, issues);
  }

  private issue(path: string, message: string, issues: HsmSchemaValidationIssue[]): void {
    issues.push(Object.freeze({ path, message, severity: "error" }));
  }
}

export function validateSchema(schema: unknown): HsmSchemaValidationResult {
  return new SchemaValidator().validate(schema);
}

export function assertValidSchema(schema: unknown): asserts schema is HsmSchema {
  const validator: SchemaValidator = new SchemaValidator();
  validator.assertValid(schema);
}
