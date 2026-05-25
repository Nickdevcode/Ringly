import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm", "cjs"],
    target: "node20",
    platform: "node",
    outDir: "dist",
    sourcemap: true,
    clean: true,
    dts: true,
    splitting: false,
    treeshake: true,
    minify: false,
    shims: true,
  },
  {
    entry: { hook: "src/hook.ts" },
    format: ["esm", "cjs"],
    target: "node20",
    platform: "node",
    outDir: "dist",
    sourcemap: true,
    clean: false,
    dts: true,
    splitting: false,
    treeshake: true,
    minify: true,
    shims: true,
  },
]);
