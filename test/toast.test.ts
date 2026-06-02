import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToastOptions } from "../src/core/types.js";
import { resetIconPathCache, resolveIconPath } from "../src/platform/windows/icon.js";
import { buildToastXml } from "../src/platform/windows/toast.js";

const base: ToastOptions = {
  appId: "Claude.Code.CLI",
  title: "Claude Code: Task complete",
  body: "MyApp: Waiting for your next input",
  sound: "Notification.IM",
};

// An absolute icon path valid on the current OS (Windows uses a drive letter,
// POSIX a rooted path). `buildToastXml` runs `pathToFileURL` on it, so the
// expected `src` must be derived the same way — hardcoding a `file:///C:/...`
// string only matches on Windows and breaks the Linux/macOS CI runners.
const ICON_PATH =
  process.platform === "win32" ? "C:/dev/Ringly/ringly.png" : "/dev/Ringly/ringly.png";
const ICON_URL = pathToFileURL(ICON_PATH).href;

describe("buildToastXml", () => {
  it("renders a minimal text-only toast (no image, no scenario)", () => {
    const xml = buildToastXml(base);
    expect(xml).toContain("<toast>");
    expect(xml).toContain("<text>Claude Code: Task complete</text>");
    expect(xml).toContain("<text>MyApp: Waiting for your next input</text>");
    expect(xml).toContain("ms-winsoundevent:Notification.IM");
    expect(xml).not.toContain("appLogoOverride");
    expect(xml).not.toContain("scenario=");
  });

  it("never emits a ToastHeader (grouping is left to the OS default)", () => {
    const xml = buildToastXml({ ...base, scenario: "reminder", iconPath: ICON_PATH });
    expect(xml).not.toContain("<header");
  });

  it("emits a non-default scenario attribute on the root element", () => {
    const xml = buildToastXml({ ...base, scenario: "reminder" });
    expect(xml).toContain('<toast scenario="reminder">');
  });

  it('treats scenario "default" as no attribute', () => {
    const xml = buildToastXml({ ...base, scenario: "default" });
    expect(xml).toContain("<toast>");
    expect(xml).not.toContain("scenario=");
  });

  it("includes a displayTimestamp attribute when provided", () => {
    const xml = buildToastXml({ ...base, displayTimestamp: "2026-06-02T12:30:00.000Z" });
    expect(xml).toContain('displayTimestamp="2026-06-02T12:30:00.000Z"');
  });

  it("adds a square (uncropped) appLogoOverride image as a file:// URL when iconPath is set", () => {
    const xml = buildToastXml({ ...base, iconPath: ICON_PATH });
    expect(xml).toContain('placement="appLogoOverride"');
    expect(xml).toContain('hint-crop="none"');
    expect(xml).not.toContain('hint-crop="circle"');
    expect(xml).toContain(`src="${ICON_URL}"`);
  });

  it("escapes XML metacharacters in title and body", () => {
    const xml = buildToastXml({ ...base, title: "A & B <c>", body: "\"q\" 'a'" });
    expect(xml).toContain("A &amp; B &lt;c&gt;");
    expect(xml).toContain("&quot;q&quot; &apos;a&apos;");
    expect(xml).not.toContain("<c>");
  });

  it("keeps text elements after the image inside the binding (ordering matters)", () => {
    const xml = buildToastXml({ ...base, iconPath: ICON_PATH });
    const imageIdx = xml.indexOf("appLogoOverride");
    const textIdx = xml.indexOf("<text>");
    expect(imageIdx).toBeGreaterThan(-1);
    expect(textIdx).toBeGreaterThan(imageIdx);
  });
});

describe("resolveIconPath", () => {
  let dir: string;
  const originalRoot = process.env["CLAUDE_PLUGIN_ROOT"];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ringly-icon-"));
    resetIconPathCache();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (originalRoot === undefined) delete process.env["CLAUDE_PLUGIN_ROOT"];
    else process.env["CLAUDE_PLUGIN_ROOT"] = originalRoot;
    resetIconPathCache();
  });

  it("prefers the icon under CLAUDE_PLUGIN_ROOT/assets when it exists", () => {
    mkdirSync(join(dir, "assets"), { recursive: true });
    const iconFile = join(dir, "assets", "ringly.png");
    writeFileSync(iconFile, "fake-png");
    process.env["CLAUDE_PLUGIN_ROOT"] = dir;
    expect(resolveIconPath()).toBe(iconFile);
  });

  it("memoizes the result across calls", () => {
    mkdirSync(join(dir, "assets"), { recursive: true });
    const iconFile = join(dir, "assets", "ringly.png");
    writeFileSync(iconFile, "fake-png");
    process.env["CLAUDE_PLUGIN_ROOT"] = dir;
    const first = resolveIconPath();
    // Remove the file; without reset the cached value must still be returned.
    rmSync(iconFile, { force: true });
    expect(resolveIconPath()).toBe(first);
  });

  it("re-evaluates after resetIconPathCache and degrades to undefined when absent", () => {
    // Point the plugin root at an empty dir AND assume the repo has no real
    // plugin/assets/ringly.png yet; if a logo is later added this is skipped.
    process.env["CLAUDE_PLUGIN_ROOT"] = dir;
    resetIconPathCache();
    const result = resolveIconPath();
    // Either no icon anywhere (undefined) or the repo's real asset was found.
    expect(result === undefined || result.endsWith("ringly.png")).toBe(true);
  });
});
