/**
 * Resolves the directory where Ringly persists small state files (update-check
 * timestamp, event throttle). Prefers `${CLAUDE_PLUGIN_DATA}` — the persistent
 * per-plugin data dir Claude Code injects, the same convention the logger uses
 * — and falls back to the `env-paths` default for standalone CLI usage.
 *
 * This module imports `env-paths`, so it must NOT be imported at the top level
 * of any hot-path module that ships in `dist/hook.{js,cjs}`. The hook path
 * reads `CLAUDE_PLUGIN_DATA` inline and only `await import`s this lazily when
 * that env var is absent (rare), keeping a second env-paths chain out of the
 * hook bundle. `updateCheckHook` (CLI-only, dynamically imported) uses it
 * directly.
 */
import envPaths from "env-paths";

export function resolveDataDir(): string {
  const pluginData = process.env["CLAUDE_PLUGIN_DATA"];
  if (pluginData && pluginData.trim().length > 0) return pluginData;
  return envPaths("ringly", { suffix: "" }).data;
}
