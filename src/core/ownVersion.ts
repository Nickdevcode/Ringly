/**
 * Walks up from the current module's directory until it finds a
 * `package.json` whose `name` is `ringly`. Resilient to source vs
 * compiled bundle (`dist/cli.js`) vs globally-installed-into-npm-prefix
 * layouts, where the relative depth differs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_DEPTH = 6;

export function readOwnVersion(moduleUrl: string): string {
  try {
    const start = dirname(fileURLToPath(moduleUrl));
    let dir = start;
    for (let i = 0; i < MAX_DEPTH; i++) {
      const candidate = join(dir, "package.json");
      try {
        const raw = readFileSync(candidate, "utf8");
        const parsed = JSON.parse(raw) as { name?: unknown; version?: unknown };
        if (parsed.name === "ringly" && typeof parsed.version === "string") {
          return parsed.version;
        }
      } catch {
        /* keep walking */
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* ignore */
  }
  return "0.0.0";
}
