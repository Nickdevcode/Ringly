import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { iconMatches } from "../src/platform/windows/aumid.js";
import {
  resetShortcutIconPathCache,
  resolveShortcutIconPath,
} from "../src/platform/windows/icon.js";

describe("resolveShortcutIconPath", () => {
  let dir: string;
  const originalRoot = process.env["CLAUDE_PLUGIN_ROOT"];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ringly-ico-"));
    resetShortcutIconPathCache();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (originalRoot === undefined) delete process.env["CLAUDE_PLUGIN_ROOT"];
    else process.env["CLAUDE_PLUGIN_ROOT"] = originalRoot;
    resetShortcutIconPathCache();
  });

  it("prefers ringly.ico under CLAUDE_PLUGIN_ROOT/assets when it exists", () => {
    mkdirSync(join(dir, "assets"), { recursive: true });
    const icoFile = join(dir, "assets", "ringly.ico");
    writeFileSync(icoFile, "fake-ico");
    process.env["CLAUDE_PLUGIN_ROOT"] = dir;
    expect(resolveShortcutIconPath()).toBe(icoFile);
  });

  it("memoizes the resolved path", () => {
    mkdirSync(join(dir, "assets"), { recursive: true });
    const icoFile = join(dir, "assets", "ringly.ico");
    writeFileSync(icoFile, "fake-ico");
    process.env["CLAUDE_PLUGIN_ROOT"] = dir;
    const first = resolveShortcutIconPath();
    rmSync(icoFile);
    expect(resolveShortcutIconPath()).toBe(first);
  });
});

describe("iconMatches", () => {
  it("never matches a null current icon (forces a rewrite)", () => {
    expect(iconMatches(null, "C:\\x\\ringly.ico")).toBe(false);
  });

  it("matches the bundled .ico by filename across differing absolute paths", () => {
    expect(iconMatches("D:\\other\\plugin\\assets\\ringly.ico", "C:\\x\\assets\\ringly.ico")).toBe(
      true,
    );
  });

  it("treats node.exe as a mismatch when the desired icon is ringly.ico", () => {
    expect(iconMatches("C:\\Program Files\\nodejs\\node.exe,0", "C:\\x\\ringly.ico")).toBe(false);
  });

  it("matches a non-.ico desired icon by normalized path (ignores ,index)", () => {
    expect(iconMatches("C:\\App\\claude.exe,0", "c:\\app\\claude.exe")).toBe(true);
  });
});
