#!/usr/bin/env node
/**
 * npm `prepare` script. Runs automatically in three scenarios:
 *
 *   1. `npm install` inside the project folder (classic clone)
 *   2. `npm install -g <github-shorthand>` (e.g. `npm install -g nickdevcode/Ringly`,
 *      a direct GitHub install via npm's shorthand — NOT to be confused
 *      with Claude Code's `/plugin marketplace add`, which has its own syntax)
 *   3. Before `npm publish`
 *
 * Behavior: builds (tsup) only when `dist/` is missing. This skips
 * redundant rebuilds in dev (where `dist/` already exists) and still
 * guarantees that GitHub installs produce a bundle, since `dist/`
 * is in `.gitignore`.
 *
 * We invoke tsup directly via Node + a Node-resolved path instead of
 * shelling out, so the script does not depend on `npm.cmd` or the
 * surrounding shell being available.
 *
 * Fails silently: a build error is logged but never aborts the
 * surrounding `npm install`.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const distCli = resolve(projectRoot, "dist", "cli.js");

if (existsSync(distCli)) {
  process.exit(0);
}

if (process.env.CI === "true" || process.env.RINGLY_SKIP_PREPARE === "1") {
  process.exit(0);
}

const require = createRequire(import.meta.url);
let tsupBin;
try {
  const pkgPath = require.resolve("tsup/package.json");
  const pkgDir = dirname(pkgPath);
  const pkg = require("tsup/package.json");
  const binSpec = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.tsup;
  if (!binSpec) {
    console.error("[ringly:prepare] tsup package has no `bin` entry");
    process.exit(0);
  }
  tsupBin = resolve(pkgDir, binSpec);
} catch (err) {
  console.error("[ringly:prepare] tsup not installed; skipping build:", err?.message ?? err);
  process.exit(0);
}

const result = spawnSync(process.execPath, [tsupBin], {
  cwd: projectRoot,
  stdio: "inherit",
});

if (result.status !== 0) {
  console.error("[ringly:prepare] build failed with status:", result.status);
}

process.exit(0);
