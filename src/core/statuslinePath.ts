/**
 * Resolves the absolute path to the bundled status-line renderer and builds the
 * `statusLine.command` string for it.
 *
 * Kept in its own module (separate from the settings writer) for two reasons:
 *   1. Path resolution is a distinct concern from mutating settings.json.
 *   2. It gives tests a clean mock seam — the writer's install/uninstall guards
 *      can be exercised deterministically by mocking `resolveStatuslineScriptPath`
 *      here, regardless of whether the real renderer exists in the repo layout.
 *
 * Two facts (confirmed against the docs + anthropics/claude-code#64074) drive
 * the command format:
 *   - `${CLAUDE_PLUGIN_ROOT}` is NOT expanded inside `statusLine.command`
 *     (only in hooks.json), so we bake an ABSOLUTE path at write time.
 *   - On Windows the command runs through Git Bash, which silently drops
 *     unquoted backslashes — so the path uses FORWARD slashes and is quoted.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Basename of the bundled renderer; also the "is this ours?" marker. */
export const STATUSLINE_SCRIPT_FILENAME = "ringly-statusline.mjs";
const STATUSLINE_SUBDIR = "statusline";

/**
 * First-match-wins resolution (mirrors `resolveShortcutIconPath` in
 * `platform/windows/icon.ts`):
 *   1. `$CLAUDE_PLUGIN_ROOT/statusline/<file>` — present when a hook is the
 *      caller (the most reliable source; the SessionStart re-pin uses it).
 *   2. Module-relative: bundled this file is in `dist/`, so the package root is
 *      one level up; in dev it is `src/core`, so three levels up. Then
 *      `plugin/statusline/<file>`.
 * Returns `null` when no candidate exists — the caller then refuses to write a
 * broken command rather than corrupt the user's statusLine.
 */
export function resolveStatuslineScriptPath(): string | null {
  const candidates: string[] = [];

  const pluginRoot = process.env["CLAUDE_PLUGIN_ROOT"];
  if (pluginRoot && pluginRoot.trim().length > 0) {
    candidates.push(join(pluginRoot, STATUSLINE_SUBDIR, STATUSLINE_SCRIPT_FILENAME));
  }

  try {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const root of [join(here, ".."), join(here, "..", "..", "..")]) {
      candidates.push(join(root, "plugin", STATUSLINE_SUBDIR, STATUSLINE_SCRIPT_FILENAME));
    }
  } catch {
    /* import.meta.url unavailable — skip module-relative candidates */
  }

  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Builds the `statusLine.command` for a resolved script path (forward-slash + quoted). */
export function buildStatuslineCommand(scriptPath: string): string {
  return `node "${scriptPath.replace(/\\/g, "/")}"`;
}
