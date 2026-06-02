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
    // Standalone ESM build of the event registry, consumed at build time by
    // `scripts/gen-dispatch-data.mjs` to generate the plugin's data-only
    // dispatch mirror (`plugin/hooks/dispatch.data.mjs`) and `hooks.json`.
    // `events.ts` is pure (no fs), so this stays tiny.
    entry: { events: "src/core/events.ts" },
    format: ["esm"],
    target: "node20",
    platform: "node",
    outDir: "dist",
    sourcemap: false,
    clean: false,
    dts: false,
    splitting: false,
    treeshake: true,
    minify: false,
    shims: false,
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
