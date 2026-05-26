/**
 * Atomic file write: write to a unique temp file, then rename it onto the
 * target. The rename is atomic on POSIX (by spec) and on NTFS for renames
 * within the same volume, which is all the cases we care about (Ringly
 * only writes inside the user's home directory).
 *
 * Why: `~/.claude/settings.json` is shared with Claude Code itself and
 * with other plugins, and `ringly config` (TUI) may run concurrently with
 * hooks firing. A raw `writeFileSync` could leave the file empty or
 * half-written if the process is killed mid-write — atomic rename means
 * either the new content is fully on disk or the old content survives
 * untouched. There is no partial state.
 */
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface AtomicWriteOptions {
  encoding?: BufferEncoding;
}

export function atomicWriteFileSync(
  filePath: string,
  contents: string,
  options: AtomicWriteOptions = {},
): void {
  const { encoding = "utf8" } = options;
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const tmp = `${filePath}.tmp.${process.pid}.${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    writeFileSync(tmp, contents, { encoding });
    renameSync(tmp, filePath);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}
