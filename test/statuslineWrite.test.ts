import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FAKE_HOME = join(tmpdir(), `ringly-statusline-home-${Date.now()}`);

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return { ...actual, homedir: () => FAKE_HOME };
});

import { getClaudeSettingsFile } from "../src/core/claudeSettings.js";
import {
  installStatusLine,
  syncStatuslineInstall,
  uninstallStatusLine,
  writeRinglyPluginOptions,
} from "../src/core/claudeSettingsWrite.js";
import {
  buildStatuslineCommand,
  resolveStatuslineScriptPath,
  STATUSLINE_SCRIPT_FILENAME,
} from "../src/core/statuslinePath.js";

const CLAUDE_DIR = join(FAKE_HOME, ".claude");
const originalRoot = process.env["CLAUDE_PLUGIN_ROOT"];

/** A temp "plugin root" holding statusline/ringly-statusline.mjs so resolution succeeds. */
let pluginRoot: string;

/** Shape of the bits of settings.json the assertions read (avoids `any`). */
interface TestSettings {
  theme?: string;
  statusLine?: { type?: string; command?: string; refreshInterval?: number };
  pluginConfigs?: {
    ringly?: { options?: Record<string, unknown> };
    [key: string]: { options?: Record<string, unknown> } | undefined;
  };
}

function readSettings(): TestSettings {
  return JSON.parse(readFileSync(getClaudeSettingsFile(), "utf8")) as TestSettings;
}

/** Convenience accessor for the ringly options block (asserted throughout). */
function ringlyOptions(): Record<string, unknown> {
  return readSettings().pluginConfigs?.ringly?.options ?? {};
}

function writeSettings(obj: unknown): void {
  mkdirSync(CLAUDE_DIR, { recursive: true });
  writeFileSync(getClaudeSettingsFile(), JSON.stringify(obj, null, 2));
}

beforeEach(() => {
  if (existsSync(FAKE_HOME)) rmSync(FAKE_HOME, { recursive: true, force: true });
  mkdirSync(CLAUDE_DIR, { recursive: true });

  // Give the resolver a real file to find, and pin it via CLAUDE_PLUGIN_ROOT
  // (the first, most-reliable candidate) so tests never depend on the repo layout.
  pluginRoot = join(FAKE_HOME, "plugin-root");
  mkdirSync(join(pluginRoot, "statusline"), { recursive: true });
  writeFileSync(join(pluginRoot, "statusline", STATUSLINE_SCRIPT_FILENAME), "// dummy");
  process.env["CLAUDE_PLUGIN_ROOT"] = pluginRoot;
});

afterEach(() => {
  if (existsSync(FAKE_HOME)) rmSync(FAKE_HOME, { recursive: true, force: true });
  if (originalRoot === undefined) delete process.env["CLAUDE_PLUGIN_ROOT"];
  else process.env["CLAUDE_PLUGIN_ROOT"] = originalRoot;
});

describe("resolveStatuslineScriptPath / buildStatuslineCommand", () => {
  it("resolves the renderer under CLAUDE_PLUGIN_ROOT/statusline", () => {
    const resolved = resolveStatuslineScriptPath();
    expect(resolved).toBe(join(pluginRoot, "statusline", STATUSLINE_SCRIPT_FILENAME));
  });

  it("builds a forward-slash, quoted node command", () => {
    const cmd = buildStatuslineCommand("C:\\Users\\Me\\plugin\\statusline\\ringly-statusline.mjs");
    expect(cmd).toBe('node "C:/Users/Me/plugin/statusline/ringly-statusline.mjs"');
    expect(cmd).not.toContain("\\");
    expect(cmd.endsWith('.mjs"')).toBe(true);
  });
});

describe("installStatusLine", () => {
  it("writes Ringly's statusLine and backs up a pre-existing one (capture-once)", () => {
    writeSettings({ statusLine: { type: "command", command: "node /old/gsd-statusline.js" } });

    const result = installStatusLine();
    expect(result.ok).toBe(true);

    const s = readSettings();
    // Our command is installed...
    expect(s.statusLine?.command).toContain(STATUSLINE_SCRIPT_FILENAME);
    expect(s.statusLine?.refreshInterval).toBe(10);
    // ...and the previous one is captured as a JSON string.
    const backup = ringlyOptions().statusline_previous as string;
    expect(JSON.parse(backup)).toEqual({ type: "command", command: "node /old/gsd-statusline.js" });
  });

  it("does not overwrite the backup on a second install", () => {
    writeSettings({ statusLine: { type: "command", command: "node /old/gsd-statusline.js" } });
    installStatusLine();
    const firstBackup = ringlyOptions().statusline_previous as string;

    // Second install (statusLine is now ours) must keep the genuine backup.
    installStatusLine();
    const secondBackup = ringlyOptions().statusline_previous as string;
    expect(secondBackup).toBe(firstBackup);
    expect(JSON.parse(secondBackup).command).toBe("node /old/gsd-statusline.js");
  });

  it("records an empty-string backup when there was no statusLine", () => {
    writeSettings({ theme: "dark" });
    installStatusLine();

    const s = readSettings();
    expect(ringlyOptions().statusline_previous).toBe("");
    expect(s.statusLine?.command).toContain(STATUSLINE_SCRIPT_FILENAME);
    // Unrelated keys survive.
    expect(s.theme).toBe("dark");
  });

  // The `ok:false` (renderer-not-found) guard is verified deterministically in
  // statuslineWriteGuard.test.ts, which mocks the resolver — mocking it there
  // avoids depending on whether the real renderer exists in the repo layout.

  it("backs up the whole settings file and preserves other plugins", () => {
    writeSettings({
      theme: "dark",
      pluginConfigs: { "other-plugin": { options: { foo: "bar" } } },
    });
    const before = readFileSync(getClaudeSettingsFile(), "utf8");

    installStatusLine();

    const s = readSettings();
    expect(s.pluginConfigs?.["other-plugin"]?.options).toEqual({ foo: "bar" });
    // A timestamped backup of the original file was created alongside it.
    const fs = require("node:fs");
    const backups = fs.readdirSync(CLAUDE_DIR).filter((e: string) => e.includes(".ringly-bak."));
    expect(backups.length).toBeGreaterThan(0);
    expect(fs.readFileSync(join(CLAUDE_DIR, backups[0]), "utf8")).toBe(before);
  });
});

describe("uninstallStatusLine", () => {
  it("restores the previous statusLine and clears the backup", () => {
    const original = { type: "command", command: "node /old/gsd-statusline.js" };
    writeSettings({ statusLine: original });
    installStatusLine();

    const result = uninstallStatusLine();
    expect(result.restored).toBe(true);

    const s = readSettings();
    expect(s.statusLine).toEqual(original);
    expect(ringlyOptions().statusline_previous).toBeUndefined();
  });

  it("deletes the statusLine when the empty-string sentinel was stored", () => {
    writeSettings({ theme: "dark" });
    installStatusLine();
    expect(readSettings().statusLine).toBeDefined();

    uninstallStatusLine();
    const s = readSettings();
    expect(s.statusLine).toBeUndefined();
    expect(ringlyOptions().statusline_previous).toBeUndefined();
  });

  it("does nothing when no backup was ever recorded", () => {
    writeSettings({ statusLine: { type: "command", command: "node /some/other.js" } });
    const result = uninstallStatusLine();
    expect(result.restored).toBe(false);
    expect(readSettings().statusLine?.command).toBe("node /some/other.js");
  });

  it("does not stomp a statusLine the user replaced by hand", () => {
    writeSettings({ statusLine: { type: "command", command: "node /old/gsd-statusline.js" } });
    installStatusLine();

    // User manually swaps in their own statusLine after Ringly installed.
    const settings = readSettings();
    settings.statusLine = { type: "command", command: "node /my/other.js" };
    writeFileSync(getClaudeSettingsFile(), JSON.stringify(settings, null, 2));

    const result = uninstallStatusLine();
    expect(result.restored).toBe(false);
    const s = readSettings();
    // The user's choice is left intact...
    expect(s.statusLine?.command).toBe("node /my/other.js");
    // ...and the stale backup is cleared.
    expect(ringlyOptions().statusline_previous).toBeUndefined();
  });
});

describe("uninstall ordering with removeRinglyPluginOptions", () => {
  it("a normal config save preserves an existing statusline_previous backup", () => {
    writeSettings({ statusLine: { type: "command", command: "node /old/gsd-statusline.js" } });
    installStatusLine();

    // Simulate a later `ringly config` save (segments changed) — it must not drop the backup.
    writeRinglyPluginOptions({ statusline_segment_git: false });

    const opts = ringlyOptions();
    expect(opts.statusline_segment_git).toBe(false);
    expect(JSON.parse(opts.statusline_previous as string).command).toBe(
      "node /old/gsd-statusline.js",
    );
  });
});

describe("syncStatuslineInstall (the transition the commands drive)", () => {
  it("off→on installs and captures the backup", () => {
    writeSettings({ statusLine: { type: "command", command: "node /old/gsd-statusline.js" } });
    const action = syncStatuslineInstall(false, true);
    expect(action).toBe("installed");
    expect(readSettings().statusLine?.command).toContain(STATUSLINE_SCRIPT_FILENAME);
    expect(JSON.parse(ringlyOptions().statusline_previous as string).command).toBe(
      "node /old/gsd-statusline.js",
    );
  });

  it("on→off uninstalls and restores the backup, then a config save persists enabled=false", () => {
    // Full round-trip as config.ts sequences it: sync FIRST, then persist options.
    writeSettings({ statusLine: { type: "command", command: "node /old/gsd-statusline.js" } });
    syncStatuslineInstall(false, true); // enable

    const off = syncStatuslineInstall(true, false); // disable
    expect(off).toBe("uninstalled");
    expect(readSettings().statusLine?.command).toBe("node /old/gsd-statusline.js");

    writeRinglyPluginOptions({ statusline_enabled: false });
    expect(ringlyOptions().statusline_enabled).toBe(false);
  });

  it("on→on and off→off are no-ops", () => {
    writeSettings({ statusLine: { type: "command", command: "node /old/gsd-statusline.js" } });
    expect(syncStatuslineInstall(true, true)).toBe("none");
    expect(syncStatuslineInstall(false, false)).toBe("none");
    // Untouched: the user's statusLine is exactly as it was.
    expect(readSettings().statusLine?.command).toBe("node /old/gsd-statusline.js");
    expect(ringlyOptions().statusline_previous).toBeUndefined();
  });
});
