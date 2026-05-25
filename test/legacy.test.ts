import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectLegacy, disableLegacy, hasLegacyActive } from "../src/core/legacy.js";

/**
 * Estes testes operam no `~/.claude/` real do usuário porque o módulo
 * `legacy.ts` resolve esse path de forma fixa (é uma convenção do
 * Claude Code). Para evitar interferir no ambiente, fazemos snapshot do
 * estado antes e restauramos no `afterEach`.
 *
 * Como cada teste cria/deleta seus próprios arquivos isolados, executar
 * em paralelo via `vitest` continua seguro.
 */

const CLAUDE_ROOT = join(homedir(), ".claude");
const HOOKS_DIR = join(CLAUDE_ROOT, "hooks");
const SETTINGS_FILE = join(CLAUDE_ROOT, "settings.json");

interface Snapshot {
  settingsExisted: boolean;
  settingsContent: string | null;
  notifyScriptExisted: boolean;
  notifyScriptContent: string | null;
  registerScriptExisted: boolean;
  registerScriptContent: string | null;
}

function takeSnapshot(): Snapshot {
  const notifyPath = join(HOOKS_DIR, "notify-toast.ps1");
  const registerPath = join(HOOKS_DIR, "register-toast-aumid.ps1");
  return {
    settingsExisted: existsSync(SETTINGS_FILE),
    settingsContent: existsSync(SETTINGS_FILE)
      ? readFileSync(SETTINGS_FILE, { encoding: "utf8" })
      : null,
    notifyScriptExisted: existsSync(notifyPath),
    notifyScriptContent: existsSync(notifyPath)
      ? readFileSync(notifyPath, { encoding: "utf8" })
      : null,
    registerScriptExisted: existsSync(registerPath),
    registerScriptContent: existsSync(registerPath)
      ? readFileSync(registerPath, { encoding: "utf8" })
      : null,
  };
}

function restoreSnapshot(snap: Snapshot): void {
  const notifyPath = join(HOOKS_DIR, "notify-toast.ps1");
  const registerPath = join(HOOKS_DIR, "register-toast-aumid.ps1");

  if (snap.settingsExisted && snap.settingsContent !== null) {
    writeFileSync(SETTINGS_FILE, snap.settingsContent, { encoding: "utf8" });
  } else if (existsSync(SETTINGS_FILE)) {
    rmSync(SETTINGS_FILE);
  }

  if (snap.notifyScriptExisted && snap.notifyScriptContent !== null) {
    mkdirSync(HOOKS_DIR, { recursive: true });
    writeFileSync(notifyPath, snap.notifyScriptContent, { encoding: "utf8" });
  } else if (existsSync(notifyPath)) {
    rmSync(notifyPath);
  }

  if (snap.registerScriptExisted && snap.registerScriptContent !== null) {
    mkdirSync(HOOKS_DIR, { recursive: true });
    writeFileSync(registerPath, snap.registerScriptContent, { encoding: "utf8" });
  } else if (existsSync(registerPath)) {
    rmSync(registerPath);
  }
}

describe("legacy detection", () => {
  let snapshot: Snapshot;

  beforeEach(() => {
    snapshot = takeSnapshot();
  });

  afterEach(() => {
    restoreSnapshot(snapshot);
  });

  it("returns empty arrays when nothing legacy is present", () => {
    if (existsSync(SETTINGS_FILE)) rmSync(SETTINGS_FILE);
    const notifyPath = join(HOOKS_DIR, "notify-toast.ps1");
    const registerPath = join(HOOKS_DIR, "register-toast-aumid.ps1");
    if (existsSync(notifyPath)) rmSync(notifyPath);
    if (existsSync(registerPath)) rmSync(registerPath);

    const detection = detectLegacy();
    expect(detection.scriptsFound).toEqual([]);
    expect(detection.hooksFound).toEqual([]);
    expect(hasLegacyActive()).toBe(false);
  });

  it("detects legacy scripts on disk", () => {
    mkdirSync(HOOKS_DIR, { recursive: true });
    writeFileSync(join(HOOKS_DIR, "notify-toast.ps1"), "# legacy script", {
      encoding: "utf8",
    });
    const detection = detectLegacy();
    expect(detection.scriptsFound).toContain("notify-toast.ps1");
    expect(hasLegacyActive()).toBe(true);
  });

  it("detects legacy hook entries in settings.json", () => {
    writeFileSync(
      SETTINGS_FILE,
      JSON.stringify({
        hooks: {
          Stop: [
            {
              hooks: [
                {
                  type: "command",
                  command:
                    "powershell.exe -NoProfile -File C:/Users/test/.claude/hooks/notify-toast.ps1",
                },
              ],
            },
          ],
        },
      }),
      { encoding: "utf8" },
    );
    const detection = detectLegacy();
    expect(detection.hooksFound).toContain("Stop");
  });
});

describe("legacy disable", () => {
  let snapshot: Snapshot;

  beforeEach(() => {
    snapshot = takeSnapshot();
  });

  afterEach(() => {
    restoreSnapshot(snapshot);
  });

  it("removes legacy hook entries from settings.json and backs up the file", () => {
    const settings = {
      otherKey: "preserve me",
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command:
                  "powershell.exe -NoProfile -File C:/Users/test/.claude/hooks/notify-toast.ps1",
              },
            ],
          },
        ],
        Notification: [
          {
            hooks: [{ type: "command", command: "some-other-hook" }],
          },
        ],
      },
    };
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings), { encoding: "utf8" });

    const result = disableLegacy();

    expect(result.removedHooks).toContain("Stop");
    expect(result.backupFile).toBeTruthy();
    expect(existsSync(result.backupFile ?? "")).toBe(true);

    const updated = JSON.parse(readFileSync(SETTINGS_FILE, { encoding: "utf8" }));
    expect(updated.otherKey).toBe("preserve me");
    expect(updated.hooks?.Stop).toBeUndefined();
    expect(updated.hooks?.Notification).toBeDefined();

    if (result.backupFile && existsSync(result.backupFile)) {
      rmSync(result.backupFile);
    }
  });

  it("is idempotent when nothing legacy is present", () => {
    if (existsSync(SETTINGS_FILE)) rmSync(SETTINGS_FILE);
    const notifyPath = join(HOOKS_DIR, "notify-toast.ps1");
    const registerPath = join(HOOKS_DIR, "register-toast-aumid.ps1");
    if (existsSync(notifyPath)) rmSync(notifyPath);
    if (existsSync(registerPath)) rmSync(registerPath);

    const result = disableLegacy();
    expect(result.removedHooks).toEqual([]);
    expect(result.movedScripts).toEqual([]);
    expect(result.backupFile).toBeNull();
    expect(result.backupDir).toBeNull();
  });
});
