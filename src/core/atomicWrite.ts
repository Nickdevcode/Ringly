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
