/**
 * Resolves absolute paths to the two bundled icon assets, both shipped under
 * `plugin/assets/` and published with the npm package (see `package.json#files`):
 *   - `ringly.png` — the in-toast app logo (appLogoOverride).
 *   - `ringly.ico` — the Start Menu shortcut icon shown in the toast's corner
 *     (via the AUMID). Replaces the default Node.js icon.
 *
 * Resolution is best-effort and cached: if no candidate file exists the caller
 * degrades gracefully (the toast renders without an image; the shortcut falls
 * back to its previous icon), so a missing asset never breaks a notification.
 * Each lookup runs at most once per process — the result (path or "not found")
 * is memoized to keep the hot path free of repeated `statSync` calls.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_LOGO_FILENAME = "ringly.png";
const SHORTCUT_ICON_FILENAME = "ringly.ico";

let cachedAppLogo: string | null | undefined;
let cachedShortcutIcon: string | null | undefined;

export function resolveIconPath(): string | undefined {
  if (cachedAppLogo !== undefined) return cachedAppLogo ?? undefined;
  cachedAppLogo = findIcon(APP_LOGO_FILENAME);
  return cachedAppLogo ?? undefined;
}

/**
 * Absolute path to the bundled `ringly.ico` used as the Start Menu shortcut
 * icon (and thus the toast's corner icon). `undefined` when not found — the
 * shortcut then keeps whatever icon it had.
 */
export function resolveShortcutIconPath(): string | undefined {
  if (cachedShortcutIcon !== undefined) return cachedShortcutIcon ?? undefined;
  cachedShortcutIcon = findIcon(SHORTCUT_ICON_FILENAME);
  return cachedShortcutIcon ?? undefined;
}

/** Test seam: clears the memoized app-logo result so candidates re-evaluate. */
export function resetIconPathCache(): void {
  cachedAppLogo = undefined;
}

/** Test seam: clears the memoized shortcut-icon result. */
export function resetShortcutIconPathCache(): void {
  cachedShortcutIcon = undefined;
}

function findIcon(filename: string): string | null {
  for (const candidate of candidatePaths(filename)) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      /* ignore and try the next candidate */
    }
  }
  return null;
}

function candidatePaths(filename: string): string[] {
  const paths: string[] = [];

  // 1. Running as a Claude Code plugin: the plugin root is injected.
  const pluginRoot = process.env["CLAUDE_PLUGIN_ROOT"];
  if (pluginRoot && pluginRoot.trim().length > 0) {
    paths.push(join(pluginRoot, "assets", filename));
  }

  // 2. Relative to this module. Bundled, this file lives in `dist/`, so the
  //    package root is one level up; in dev it lives in `src/platform/windows`,
  //    so the root is three levels up. Cover both, then `plugin/assets`.
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const root of [join(here, ".."), join(here, "..", "..", "..")]) {
      paths.push(join(root, "plugin", "assets", filename));
    }
  } catch {
    /* import.meta.url unavailable — skip module-relative candidates */
  }

  return paths;
}
