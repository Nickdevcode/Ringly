import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Cross-PROCESS regression test for the task-counter lost-update bug.
 *
 * The unit tests in `sessionProgress.test.ts` call `recordTask` synchronously
 * in-process, so they could never expose the real defect: Claude Code fires
 * each hook in a SEPARATE Node process, and concurrent task completions raced
 * on the shared `session-progress.json` (read-modify-write without a lock),
 * dropping ids and making the toast counter skip/repeat numbers.
 *
 * This test reproduces that faithfully — it bundles the real module, then
 * spawns genuine parallel Node processes that each fold in one event — and
 * asserts there is NO lost update. Before the `withFileLock` fix this failed
 * intermittently (≈1-in-3 runs); after it, every id survives every time.
 *
 * We bundle the source with esbuild (already a dev dependency via tsup) into a
 * temp `.mjs` so the child processes can import the exact compiled logic
 * without depending on a prior `npm run build`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const src = join(repoRoot, "src", "core", "sessionProgress.ts");

let workDir: string;
let bundlePath: string;
let workerPath: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "ringly-conc-"));
  bundlePath = join(workDir, "sessionProgress.mjs");
  workerPath = join(workDir, "worker.mjs");

  // Bundle the real module (and its local deps: fileLock, atomicWrite) to ESM.
  // Drive esbuild through its JS API rather than the CLI: the CLI shim on
  // Windows needs a shell, which mangles the `--outfile` path. The API takes
  // plain strings and is shell-agnostic.
  const esbuild = require("esbuild") as typeof import("esbuild");
  esbuild.buildSync({
    entryPoints: [src],
    outfile: bundlePath,
    bundle: true,
    format: "esm",
    platform: "node",
  });

  // One process = one event. argv: <dataDir> <sessionId> <taskId> <kind>
  // Import via a file:// URL — on Windows a bare absolute path (c:\…) is not a
  // valid ESM specifier.
  const bundleUrl = pathToFileURL(bundlePath).href;
  writeFileSync(
    workerPath,
    [
      `import { recordTask } from ${JSON.stringify(bundleUrl)};`,
      `const [, , dataDir, sid, id, kind] = process.argv;`,
      `recordTask(dataDir, sid, id, kind);`,
    ].join("\n"),
    "utf8",
  );
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function runWorker(dataDir: string, sid: string, id: string, kind: "created" | "completed") {
  return new Promise<void>((resolve, reject) => {
    const { spawn } = require("node:child_process") as typeof import("node:child_process");
    const child = spawn(process.execPath, [workerPath, dataDir, sid, id, kind], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let err = "";
    child.stderr?.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`worker exited ${code}: ${err}`)),
    );
  });
}

describe("recordTask under real concurrent processes", () => {
  it("loses no completion id when many processes complete tasks in parallel", async () => {
    // A bigger batch + several rounds makes the race overwhelmingly likely to
    // have surfaced pre-fix, while staying fast.
    const N = 8;
    const ROUNDS = 5;
    const ids = Array.from({ length: N }, (_, i) => String(i + 1));

    for (let r = 0; r < ROUNDS; r++) {
      const dataDir = mkdtempSync(join(tmpdir(), `ringly-conc-round${r}-`));
      try {
        // Creation burst — serial, as Claude Code seeds a checklist.
        for (const id of ids) await runWorker(dataDir, "s", id, "created");
        // Completions — all at once, the real "marking fast" scenario.
        await Promise.all(ids.map((id) => runWorker(dataDir, "s", id, "completed")));

        const state = JSON.parse(readFileSync(join(dataDir, "session-progress.json"), "utf8")) as {
          sessions: Record<string, { createdIds: number[]; completedIds: number[] }>;
        };
        const entry = state.sessions["s"];
        expect(entry, `round ${r}: session entry missing`).toBeDefined();
        // Every id must be present exactly once — no lost updates.
        const completed = [...(entry?.completedIds ?? [])].sort((a, b) => a - b);
        const created = [...(entry?.createdIds ?? [])].sort((a, b) => a - b);
        const expected = ids.map(Number);
        expect(completed, `round ${r}: completedIds lost an id`).toEqual(expected);
        expect(created, `round ${r}: createdIds lost an id`).toEqual(expected);
      } finally {
        rmSync(dataDir, { recursive: true, force: true });
      }
    }
  }, 30_000);
});
