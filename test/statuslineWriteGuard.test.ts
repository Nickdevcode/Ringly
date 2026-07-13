import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FAKE_HOME = join(tmpdir(), `ringly-sl-guard-home-${Date.now()}`);

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return { ...actual, homedir: () => FAKE_HOME };
});

// Force the not-found path regardless of the repo layout: the resolver returns
// null, so installStatusLine must refuse to write a broken statusLine command.
vi.mock("../src/core/statuslinePath.js", async () => {
  const actual = await vi.importActual<typeof import("../src/core/statuslinePath.js")>(
    "../src/core/statuslinePath.js",
  );
  return { ...actual, resolveStatuslineScriptPath: () => null };
});

import { getClaudeSettingsFile } from "../src/core/claudeSettings.js";
import { installStatusLine } from "../src/core/claudeSettingsWrite.js";

const CLAUDE_DIR = join(FAKE_HOME, ".claude");

beforeEach(() => {
  if (existsSync(FAKE_HOME)) rmSync(FAKE_HOME, { recursive: true, force: true });
  mkdirSync(CLAUDE_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(FAKE_HOME)) rmSync(FAKE_HOME, { recursive: true, force: true });
});

describe("installStatusLine (renderer not found)", () => {
  it("returns ok:false and leaves settings.statusLine untouched", () => {
    writeFileSync(
      getClaudeSettingsFile(),
      JSON.stringify({ theme: "dark", statusLine: { type: "command", command: "node /mine.js" } }),
    );

    const result = installStatusLine();
    expect(result.ok).toBe(false);
    expect(result.scriptPath).toBeNull();

    // Nothing about the file changed — the user's statusLine is intact.
    const s = JSON.parse(readFileSync(getClaudeSettingsFile(), "utf8"));
    expect(s.statusLine).toEqual({ type: "command", command: "node /mine.js" });
    expect(s.pluginConfigs).toBeUndefined();
  });
});
