import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "../../core/logger.js";
import { resolveShortcutIconPath } from "./icon.js";
import { runPowerShell } from "./powershell.js";
import { buildAumidQueryScript, buildAumidRegisterScript } from "./ps-templates.js";

export interface AumidStatus {
  shortcutExists: boolean;
  shortcutPath: string;
  aumid: string | null;
  /** The shortcut's current `IconLocation` (e.g. `…\node.exe,0`), or null. */
  iconLocation: string | null;
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

/**
 * Picks the shortcut's icon. Prefers the bundled `ringly.ico` (so the toast's
 * corner shows the Ringly mark instead of the Node.js logo). Falls back to the
 * old behavior — the Node.js icon, then the target exe — only when the bundled
 * `.ico` can't be found, so a missing asset never leaves the shortcut iconless.
 */
function detectIconPath(targetPath: string): string {
  const bundled = resolveShortcutIconPath();
  if (bundled) return bundled;
  const nodeExe = process.env.ProgramFiles && join(process.env.ProgramFiles, "nodejs", "node.exe");
  if (nodeExe && existsSync(nodeExe)) return `${nodeExe},0`;
  return `${targetPath},0`;
}

/**
 * Whether the shortcut's current icon already matches what we'd set. Tolerant
 * by design: trims, lowercases, and ignores a trailing `,<index>` suffix.
 * When the desired icon is the bundled `ringly.ico`, we match by filename
 * (`ringly.ico`) rather than full path, since the absolute path differs across
 * machines/installs. `null` (no current icon) never matches → forces a rewrite.
 */
export function iconMatches(current: string | null, desired: string): boolean {
  if (!current) return false;
  const norm = (s: string) => s.trim().toLowerCase().replace(/,\d+$/, "");
  if (/ringly\.ico$/i.test(desired)) return /ringly\.ico$/i.test(norm(current));
  return norm(current) === norm(desired);
}

export async function queryAumidStatus(
  shortcutPath: string = defaultShortcutPath(),
): Promise<AumidStatus> {
  const status: AumidStatus = {
    shortcutExists: existsSync(shortcutPath),
    shortcutPath,
    aumid: null,
    iconLocation: null,
    notifierSetting: null,
    error: null,
  };

  if (!status.shortcutExists) return status;

  const script = buildAumidQueryScript({ shortcutPath });
  const result = await runPowerShell({ script, timeoutMs: 6000 });

  const out = result.stdout.trim();
  if (out === "MISSING") return status;

  // The query script emits one fact per line (AUMID:/ICON:/ERROR:), so parse
  // line by line. Empty values (e.g. `AUMID:` with nothing after) stay null.
  for (const rawLine of out.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("AUMID:")) {
      const value = line.slice("AUMID:".length).trim();
      status.aumid = value.length > 0 ? value : null;
    } else if (line.startsWith("ICON:")) {
      const value = line.slice("ICON:".length).trim();
      status.iconLocation = value.length > 0 ? value : null;
    } else if (line.startsWith("ERROR:")) {
      status.error = line;
      logger.warn("AUMID query failed", { stdout: out, stderr: result.stderr });
    }
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

  // Skip the rewrite only when BOTH the AUMID and the icon already match.
  // Checking the icon too means existing users (whose shortcut still points at
  // node.exe) get the new Ringly icon applied on the next `ringly init`,
  // instead of being skipped forever because the AUMID alone was correct.
  const current = await queryAumidStatus(shortcutPath);
  if (current.aumid === options.appId && iconMatches(current.iconLocation, iconPath)) {
    logger.info("AUMID + icon already correct; skipping rewrite", { aumid: options.appId });
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
