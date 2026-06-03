import { describe, expect, it } from "vitest";
import {
  buildAumidQueryScript,
  buildAumidRegisterScript,
  buildToastScript,
} from "../src/platform/windows/ps-templates.js";

describe("buildToastScript", () => {
  const baseParams = {
    appId: "Claude.Code.CLI",
    toastXml: "<toast><visual/></toast>",
  };

  it("embeds the AUMID and XML safely", () => {
    const script = buildToastScript(baseParams);
    expect(script).toContain("'Claude.Code.CLI'");
    expect(script).toContain("'<toast><visual/></toast>'");
  });

  it("escapes single quotes in AUMID", () => {
    const script = buildToastScript({ ...baseParams, appId: "App'Id" });
    expect(script).toContain("'App''Id'");
  });

  it("escapes single quotes in toast XML", () => {
    const script = buildToastScript({
      ...baseParams,
      toastXml: "<toast attr='x'/>",
    });
    expect(script).toContain("'<toast attr=''x''/>'");
  });

  it("reads NotificationSetting via .value__ to bypass WinRT COM adapter bug", () => {
    const script = buildToastScript(baseParams);
    expect(script).toContain("[int]$notifier.Setting.value__");
  });

  it("compares against integer 0 (Enabled) instead of enum literal", () => {
    const script = buildToastScript(baseParams);
    expect(script).toContain("$settingInt -ne 0");
    expect(script).not.toContain("[Windows.UI.Notifications.NotificationSetting]::Enabled");
  });

  it("translates non-zero NotificationSetting values to a human label", () => {
    const script = buildToastScript(baseParams);
    expect(script).toContain("'DisabledForApplication'");
    expect(script).toContain("'DisabledForUser'");
    expect(script).toContain("'DisabledByGroupPolicy'");
    expect(script).toContain("'DisabledByManifest'");
  });

  it("falls through to Show() when the setting cannot be read", () => {
    const script = buildToastScript(baseParams);
    expect(script).toContain("$null -ne $settingInt -and $settingInt -ne 0");
  });

  it("no longer emits the misleading Console::Beep fallback on the blocked path", () => {
    const script = buildToastScript(baseParams);
    expect(script).not.toContain("Console]::Beep");
  });

  it("writes OK on successful show", () => {
    const script = buildToastScript(baseParams);
    expect(script).toContain("Write-Output 'OK'");
  });

  it("writes ERROR: prefix on exception", () => {
    const script = buildToastScript(baseParams);
    expect(script).toContain("Write-Output ('ERROR:' + $_.Exception.Message)");
  });
});

describe("buildAumidRegisterScript", () => {
  const baseParams = {
    appId: "Claude.Code.CLI",
    appName: "Claude Code",
    targetPath: "C:\\Program Files\\nodejs\\node.exe",
    iconPath: "C:\\Program Files\\nodejs\\node.exe,0",
    shortcutPath: "C:\\Users\\me\\Start Menu\\Claude Code.lnk",
  };

  it("embeds every parameter into the script body", () => {
    const script = buildAumidRegisterScript(baseParams);
    expect(script).toContain("'Claude.Code.CLI'");
    expect(script).toContain("'Claude Code'");
    expect(script).toContain("nodejs\\node.exe");
    expect(script).toContain("Claude Code.lnk");
  });

  it("escapes single quotes in every parameter", () => {
    const script = buildAumidRegisterScript({
      ...baseParams,
      appName: "Claude's Code",
    });
    expect(script).toContain("'Claude''s Code'");
  });
});

describe("buildAumidQueryScript", () => {
  it("embeds the shortcut path", () => {
    const script = buildAumidQueryScript({
      shortcutPath: "C:\\path\\to\\shortcut.lnk",
    });
    expect(script).toContain("'C:\\path\\to\\shortcut.lnk'");
  });

  it("escapes single quotes in the shortcut path", () => {
    const script = buildAumidQueryScript({
      shortcutPath: "C:\\It's\\shortcut.lnk",
    });
    expect(script).toContain("'C:\\It''s\\shortcut.lnk'");
  });

  it("queries the AUMID via Get-StartApps and emits an AUMID: line", () => {
    const script = buildAumidQueryScript({ shortcutPath: "C:\\s.lnk" });
    expect(script).toContain("Get-StartApps");
    expect(script).toContain("'AUMID:'");
  });

  it("reads the shortcut IconLocation and emits an ICON: line", () => {
    const script = buildAumidQueryScript({ shortcutPath: "C:\\s.lnk" });
    expect(script).toContain(".IconLocation");
    expect(script).toContain("'ICON:'");
  });

  it("still reports MISSING when the shortcut is absent", () => {
    const script = buildAumidQueryScript({ shortcutPath: "C:\\s.lnk" });
    expect(script).toContain("'MISSING'");
  });
});
