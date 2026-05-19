import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/core/index.ts",
    "src/schema/index.ts",
    "src/backend/index.ts",
    "src/browser/index.ts",
    "src/vue/index.ts",
    "src/devtools/index.ts"
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ["vue"]
});
