/**
 * Resolves the absolute path to the app-logo image shown on the toast
 * (appLogoOverride). The asset ships at `plugin/assets/ringly.png` and is
 * published with the npm package (see `package.json#files`).
 *
 * Resolution is best-effort and cached: if no candidate file exists the toast
 * simply renders without an icon (graceful degradation), so a missing/not-yet-
 * provided logo never breaks a notification. The lookup runs at most once per
 * process — the result (path or "not found") is memoized to keep the hot path
 * free of repeated `statSync` calls.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICON_FILENAME = "ringly.png";

let cached: string | null | undefined;

export function resolveIconPath(): string | undefined {
  if (cached !== undefined) return cached ?? undefined;
  cached = findIcon();
  return cached ?? undefined;
}

/** Test seam: clears the memoized result so candidates are re-evaluated. */
export function resetIconPathCache(): void {
  cached = undefined;
}

function findIcon(): string | null {
  for (const candidate of candidatePaths()) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      /* ignore and try the next candidate */
    }
  }
  return null;
}

function candidatePaths(): string[] {
  const paths: string[] = [];

  // 1. Running as a Claude Code plugin: the plugin root is injected.
  const pluginRoot = process.env["CLAUDE_PLUGIN_ROOT"];
  if (pluginRoot && pluginRoot.trim().length > 0) {
    paths.push(join(pluginRoot, "assets", ICON_FILENAME));
  }

  // 2. Relative to this module. Bundled, this file lives in `dist/`, so the
  //    package root is one level up; in dev it lives in `src/platform/windows`,
  //    so the root is three levels up. Cover both, then `plugin/assets`.
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const root of [join(here, ".."), join(here, "..", "..", "..")]) {
      paths.push(join(root, "plugin", "assets", ICON_FILENAME));
    }
  } catch {
    /* import.meta.url unavailable — skip module-relative candidates */
  }

  return paths;
}
