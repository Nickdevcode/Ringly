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
    // Standalone ESM builds consumed at build time by scripts (not shipped on
    // any hot path):
    //   - `events`: the event registry, read by `scripts/gen-dispatch-data.mjs`
    //     to generate the plugin's dispatch mirror + `hooks.json`.
    //   - `ico`: the pure ICO packer, read by `scripts/gen-icon.mjs` to build
    //     `plugin/assets/ringly.ico`.
    // Both modules are pure (no fs), so this stays tiny.
    entry: { events: "src/core/events.ts", ico: "src/platform/windows/ico.ts" },
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
