import fs from "node:fs/promises";
import path from "node:path";
import type { AnyRecord, HsmMachineConfig } from "../core/types.js";
import type { HsmMachine } from "../core/HsmMachine.js";
import type { HsmSchema } from "../schema/HsmSchema.js";
import { createHsm } from "../core/createHsm.js";
import { createHsmFromSchema } from "../schema/createHsmFromSchema.js";
import { schemaFromJson } from "../schema/SchemaSerializer.js";
import { HsmTestFileLoader } from "../testing/HsmTestFileLoader.js";

export interface HsmLoadResult<TContext extends AnyRecord = AnyRecord> {
  readonly hsm: HsmMachine<TContext>;
  readonly schema?: HsmSchema;
}

export async function loadSchema(schemaPath: string): Promise<HsmSchema> {
  const resolved = path.resolve(process.cwd(), schemaPath);
  if (resolved.endsWith(".json")) {
    const raw = await fs.readFile(resolved, "utf-8");
    return schemaFromJson(raw);
  }
  const loader = new HsmTestFileLoader({ cwd: process.cwd() });
  const mod = await loader.loadConfig(resolved);
  return mod.schema ?? mod.default ?? mod;
}

export async function loadHsm<TContext extends AnyRecord = AnyRecord>(
  configPath: string,
  schema?: HsmSchema
): Promise<HsmLoadResult<TContext>> {
  const loader = new HsmTestFileLoader({ cwd: process.cwd() });
  const config = await loader.loadConfig(configPath);

  if (isHsmMachine<TContext>(config)) return { hsm: config, schema };
  if (config?.hsm && isHsmMachine<TContext>(config.hsm)) return { hsm: config.hsm, schema };
  if (config?.schema && schema === undefined) schema = config.schema as HsmSchema;

  if (schema) {
    return { hsm: createHsmFromSchema(schema), schema };
  }

  if (config?.states) {
    return { hsm: createHsm(config as HsmMachineConfig<TContext>), schema };
  }

  throw new Error("Unable to resolve HSM configuration. Export an HSM instance or machine config.");
}

function isHsmMachine<TContext extends AnyRecord = AnyRecord>(value: unknown): value is HsmMachine<TContext> {
  return Boolean(value && typeof value === "object" && "transitionUrl" in (value as AnyRecord));
}
