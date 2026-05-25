import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "../../core/logger.js";
import { runPowerShell } from "./powershell.js";
import { buildAumidQueryScript, buildAumidRegisterScript } from "./ps-templates.js";

export interface AumidStatus {
  shortcutExists: boolean;
  shortcutPath: string;
  aumid: string | null;
  notifierSetting: string | null;
  error: string | null;
}

export interface RegisterAumidOptions {
  appId: string;
  appName?: string;
  targetPath?: string;
  iconPath?: string;
  shortcutPath?: string;
}

export interface RegisterAumidResult {
  ok: boolean;
  notifierSetting: string | null;
  skipped: boolean;
  reason: string | null;
}

const DEFAULT_APP_NAME = "Claude Code";

export function defaultShortcutPath(appName: string = DEFAULT_APP_NAME): string {
  const programs =
    process.env.APPDATA &&
    join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs");
  const fallback = join(
    homedir(),
    "AppData",
    "Roaming",
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
  );
  return join(programs ?? fallback, `${appName}.lnk`);
}

export function detectClaudeExecutable(): string | null {
  const candidates = [
    join(homedir(), ".local", "bin", "claude.exe"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Programs", "claude", "claude.exe"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "claude", "claude.exe"),
    process.env.ProgramFiles && join(process.env.ProgramFiles, "claude", "claude.exe"),
  ].filter((p): p is string => typeof p === "string" && p.length > 0);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  const nodeExe = process.env.ProgramFiles && join(process.env.ProgramFiles, "nodejs", "node.exe");
  if (nodeExe && existsSync(nodeExe)) return nodeExe;

  return null;
}

function detectIconPath(targetPath: string): string {
  const nodeExe = process.env.ProgramFiles && join(process.env.ProgramFiles, "nodejs", "node.exe");
  if (nodeExe && existsSync(nodeExe)) return `${nodeExe},0`;
  return `${targetPath},0`;
}

export async function queryAumidStatus(
  shortcutPath: string = defaultShortcutPath(),
): Promise<AumidStatus> {
  const status: AumidStatus = {
    shortcutExists: existsSync(shortcutPath),
    shortcutPath,
    aumid: null,
    notifierSetting: null,
    error: null,
  };

  if (!status.shortcutExists) return status;

  const script = buildAumidQueryScript({ shortcutPath });
  const result = await runPowerShell({ script, timeoutMs: 6000 });

  const out = result.stdout.trim();
  if (out === "MISSING" || out === "EMPTY") {
    return status;
  }
  if (out.startsWith("AUMID:")) {
    status.aumid = out.slice("AUMID:".length).trim();
  } else if (out.startsWith("ERROR:")) {
    status.error = out;
    logger.warn("AUMID query failed", { stdout: out, stderr: result.stderr });
  }
  return status;
}

export async function registerAumid(options: RegisterAumidOptions): Promise<RegisterAumidResult> {
  const appName = options.appName ?? DEFAULT_APP_NAME;
  const shortcutPath = options.shortcutPath ?? defaultShortcutPath(appName);
  const targetPath = options.targetPath ?? detectClaudeExecutable();

  if (!targetPath) {
    return {
      ok: false,
      notifierSetting: null,
      skipped: false,
      reason: "claude_executable_not_found",
    };
  }

  const iconPath = options.iconPath ?? detectIconPath(targetPath);

  const current = await queryAumidStatus(shortcutPath);
  if (current.aumid === options.appId) {
    logger.info("AUMID already registered; skipping rewrite", { aumid: options.appId });
    return {
      ok: true,
      notifierSetting: current.notifierSetting,
      skipped: true,
      reason: "already_registered",
    };
  }

  const script = buildAumidRegisterScript({
    appId: options.appId,
    appName,
    targetPath,
    iconPath,
    shortcutPath,
  });
  const result = await runPowerShell({ script, timeoutMs: 15000 });
  const out = result.stdout.trim();

  if (result.timedOut) {
    return { ok: false, notifierSetting: null, skipped: false, reason: "timeout" };
  }

  if (out.startsWith("OK")) {
    const setting = out.startsWith("OK:") ? out.slice("OK:".length).trim() : null;
    return { ok: true, notifierSetting: setting, skipped: false, reason: null };
  }

  logger.error("AUMID register failed", { stdout: out, stderr: result.stderr });
  return { ok: false, notifierSetting: null, skipped: false, reason: out || "unknown_error" };
}

export interface UnregisterResult {
  removed: boolean;
  shortcutPath: string;
}

export function getDefaultShortcutPath(): string {
  return defaultShortcutPath();
}
