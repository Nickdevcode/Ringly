#!/usr/bin/env node
/**
 * Guards against the npm CLI (`package.json`) and the Claude Code plugin
 * manifest (`plugin/.claude-plugin/plugin.json`) drifting out of sync.
 *
 * Why this exists: the plugin manifest carries its own `version` field,
 * served from GitHub when users install/update via Claude Code's `/plugin`.
 * When a release bumps `package.json` but forgets the manifest, the plugin
 * UI keeps showing the old number even though the published CLI is newer
 * (exactly what happened across v0.8.0 / v0.8.1, which were published
 * without going through the tagged CI release that enforced this).
 *
 * This is the single source of truth for that check. It runs in two places:
 *   1. `prepublishOnly` — blocks a local `npm publish` from shipping a
 *      mismatch (the gap that let the drift through in the first place).
 *   2. `.github/workflows/release.yml` — the tagged CI release path.
 *
 * Exit code is non-zero on mismatch so it aborts the surrounding step.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const pkgPath = resolve(projectRoot, "package.json");
const pluginPath = resolve(projectRoot, "plugin", ".claude-plugin", "plugin.json");

const readVersion = (path) => {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed.version !== "string") {
    throw new Error(`${path} has no string "version" field`);
  }
  return parsed.version;
};

const pkgVersion = readVersion(pkgPath);
const pluginVersion = readVersion(pluginPath);

if (pkgVersion !== pluginVersion) {
  console.error(
    "\n[ringly] Version mismatch between the npm CLI and the Claude Code plugin manifest:\n" +
      `  package.json                       ${pkgVersion}\n` +
      `  plugin/.claude-plugin/plugin.json  ${pluginVersion}\n\n` +
      `Fix it by setting "version" in plugin/.claude-plugin/plugin.json to ${pkgVersion}, ` +
      "then commit both files together.\n",
  );
  process.exit(1);
}

console.log(`[ringly] CLI and plugin manifest versions are in sync (${pkgVersion}).`);
