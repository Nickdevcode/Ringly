/**
 * Write-path for `~/.claude/settings.json` and related backup/cleanup.
 *
 * Split out from `claudeSettings.ts` to keep the hook bundle minimal: the
 * Claude Code hook only ever reads config (`loadConfig` → `readRinglyPluginOptions`),
 * so it should never pull in `chmodSync`, `copyFileSync`, `readdirSync`, etc.
 * Those `fs` functions live here and are only reachable from the interactive
 * commands (`ringly config`, `ringly init`, `ringly uninstall`), which are
 * dynamic-imported by `cli.ts` and therefore stay out of `dist/hook.{js,cjs}`.
 *
 * The read-only counterpart (`claudeSettings.ts`) holds `readRinglyPluginOptions`
 * and the pure `pluginOptionsToRinglyConfig` transform — everything the hot
 * hook path needs and nothing more.
 */
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { atomicWriteFileSync } from "./atomicWrite.js";
import {
  type ClaudeSettings,
  type ClaudeStatusLine,
  getClaudeSettingsFile,
  PLUGIN_ID,
  type PluginConfigEntry,
  type RinglyPluginOptions,
  readClaudeSettings,
  readRinglyPluginOptions,
  statuslineSegmentField,
} from "./claudeSettings.js";
import { EVENTS, optionField } from "./events.js";
import { logger } from "./logger.js";
import {
  buildStatuslineCommand,
  resolveStatuslineScriptPath,
  STATUSLINE_SCRIPT_FILENAME,
} from "./statuslinePath.js";
import { type RinglyConfig, STATUSLINE_SEGMENT_KEYS } from "./types.js";

export interface SaveResult {
  file: string;
  backupFile: string | null;
  wasCreated: boolean;
}

const BACKUP_SUFFIX = ".ringly-bak.";
const BACKUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function pruneOldBackups(file: string): void {
  const dir = dirname(file);
  const prefix = `${basename(file)}${BACKUP_SUFFIX}`;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.startsWith(prefix)) continue;
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (now - stat.mtimeMs > BACKUP_MAX_AGE_MS) {
        unlinkSync(fullPath);
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * The one place that mutates `~/.claude/settings.json`. It handles the shared
 * dance every writer needs — ensure the dir, prune stale backups, back up the
 * whole file first, read the current settings, let the caller transform them,
 * then atomically write and (on POSIX) chmod 600. Callers only supply the pure
 * `mutate(settings)` transform; everything around it is identical, so this
 * keeps `writeRinglyPluginOptions` / `removeRinglyPluginOptions` /
 * `installStatusLine` / `uninstallStatusLine` from each re-implementing (and
 * subtly diverging on) the backup + atomic + chmod logic.
 */
function mutateClaudeSettings(mutate: (settings: ClaudeSettings) => ClaudeSettings): SaveResult {
  const file = getClaudeSettingsFile();
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true });

  pruneOldBackups(file);

  const wasCreated = !existsSync(file);
  let backupFile: string | null = null;

  if (!wasCreated) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupFile = `${file}${BACKUP_SUFFIX}${timestamp}`;
    try {
      copyFileSync(file, backupFile);
    } catch (err) {
      logger.warn("Failed to backup settings.json before writing", {
        message: (err as Error).message,
      });
      backupFile = null;
    }
  }

  const settings = readClaudeSettings();
  const nextSettings = mutate(settings);

  atomicWriteFileSync(file, `${JSON.stringify(nextSettings, null, 2)}\n`);

  if (process.platform !== "win32") {
    try {
      chmodSync(file, 0o600);
    } catch (err) {
      logger.warn("Failed to chmod 600 settings.json", {
        message: (err as Error).message,
      });
    }
  }

  return { file, backupFile, wasCreated };
}

/** Merges `options` into `pluginConfigs.ringly.options`, preserving the rest. */
function mergeRinglyOptions(
  settings: ClaudeSettings,
  options: RinglyPluginOptions,
): ClaudeSettings {
  const pluginConfigs: Record<string, PluginConfigEntry> = { ...(settings.pluginConfigs ?? {}) };
  const existingEntry: PluginConfigEntry = pluginConfigs[PLUGIN_ID] ?? {};
  pluginConfigs[PLUGIN_ID] = {
    ...existingEntry,
    options: { ...(existingEntry.options ?? {}), ...options },
  };
  return { ...settings, pluginConfigs };
}

export function writeRinglyPluginOptions(options: RinglyPluginOptions): SaveResult {
  return mutateClaudeSettings((settings) => mergeRinglyOptions(settings, options));
}

export function ringlyConfigToPluginOptions(config: RinglyConfig): RinglyPluginOptions {
  const options: RinglyPluginOptions = {
    language: config.language,
    sound: config.sound,
    debug: config.debug,
    check_updates: config.checkUpdates,
    statusline_enabled: config.statusline.enabled,
    statusline_position: config.statusline.position,
  };
  // One `events_<configKey>` field per registered event.
  for (const e of EVENTS) {
    options[optionField(e.configKey)] = config.events[e.configKey];
  }
  // One `statusline_segment_<key>` field per segment. NOTE: `statusline_previous`
  // is deliberately NOT emitted here — it is install metadata, not config. Since
  // `writeRinglyPluginOptions` merges over existing options, a normal config save
  // preserves any backup already on disk.
  for (const key of STATUSLINE_SEGMENT_KEYS) {
    options[statuslineSegmentField(key)] = config.statusline.segments[key];
  }
  return options;
}

export function removeRinglyPluginOptions(): boolean {
  const file = getClaudeSettingsFile();
  if (!existsSync(file)) return false;
  // Short-circuit before touching the file when there is nothing to remove.
  if (!readClaudeSettings().pluginConfigs?.[PLUGIN_ID]) return false;

  mutateClaudeSettings((settings) => {
    const nextPluginConfigs = { ...(settings.pluginConfigs ?? {}) };
    delete nextPluginConfigs[PLUGIN_ID];
    const next: ClaudeSettings = { ...settings };
    if (Object.keys(nextPluginConfigs).length === 0) {
      delete next.pluginConfigs;
    } else {
      next.pluginConfigs = nextPluginConfigs;
    }
    return next;
  });

  return true;
}

// --- Status line install / uninstall --------------------------------------
//
// Installing Ringly's status line means writing `settings.statusLine.command`
// (path resolution + command formatting live in `statuslinePath.ts`).
//
// The user may already have a `statusLine` (e.g. a personal script). We back it
// up into `statusline_previous` on first install and restore it on uninstall,
// and we only ever touch a `statusLine` that is Ringly's own — never one the
// user set or replaced by hand.

export interface InstallStatuslineResult {
  ok: boolean;
  scriptPath: string | null;
}

/** True when a `statusLine.command` string is Ringly's own renderer. */
function isRinglyStatusline(command: string | undefined): boolean {
  return typeof command === "string" && command.includes(STATUSLINE_SCRIPT_FILENAME);
}

/**
 * Installs Ringly's status line: backs up any pre-existing `statusLine`
 * (capture-once) into `statusline_previous`, then writes ours.
 *
 * Backup rules:
 *   - Only capture if `statusline_previous` is not already set AND the current
 *     statusLine is not already Ringly's — so a second enable / a re-pin never
 *     clobbers the genuine user backup.
 *   - If there is no current statusLine, the backup sentinel is `""` (restore
 *     ⇒ delete the key).
 *
 * Returns `{ ok:false }` (writing nothing) when the renderer can't be resolved.
 */
export function installStatusLine(): InstallStatuslineResult {
  const scriptPath = resolveStatuslineScriptPath();
  if (!scriptPath) {
    logger.warn("Status line renderer not found; leaving settings.statusLine untouched");
    return { ok: false, scriptPath: null };
  }

  const command = buildStatuslineCommand(scriptPath);

  mutateClaudeSettings((settings) => {
    const current = settings.statusLine;
    const alreadyOurs = isRinglyStatusline(current?.command);

    // Capture-once backup: only when nothing is backed up yet and the current
    // statusLine isn't already ours.
    const existingBackup = settings.pluginConfigs?.[PLUGIN_ID]?.options?.statusline_previous;
    const next: ClaudeSettings =
      existingBackup === undefined && !alreadyOurs
        ? mergeRinglyOptions(settings, {
            statusline_previous: current ? JSON.stringify(current) : "",
          })
        : { ...settings };

    next.statusLine = {
      type: "command",
      command,
      padding: 0,
      refreshInterval: 10,
    };
    return next;
  });

  logger.info("Status line installed", { scriptPath });
  return { ok: true, scriptPath };
}

export interface UninstallStatuslineResult {
  restored: boolean;
}

/**
 * Uninstalls Ringly's status line and restores whatever was there before.
 *
 *   - No `statusline_previous` recorded → do nothing to `statusLine`.
 *   - `""` sentinel → delete the `statusLine` key.
 *   - otherwise → parse the JSON snapshot back and restore it.
 *
 * Guard: only mutate `statusLine` when it is currently Ringly's own. If the
 * user replaced it by hand we leave it alone (and just clear the backup), so we
 * never stomp a status line the user chose. The backup is removed afterward.
 */
export function uninstallStatusLine(): UninstallStatuslineResult {
  const file = getClaudeSettingsFile();
  if (!existsSync(file)) return { restored: false };

  const options = readRinglyPluginOptions();
  const previous = options.statusline_previous;
  if (previous === undefined) return { restored: false };

  let restored = false;

  mutateClaudeSettings((settings) => {
    const next: ClaudeSettings = { ...settings };
    const ours = isRinglyStatusline(settings.statusLine?.command);

    if (ours) {
      if (previous === "") {
        delete next.statusLine;
      } else {
        try {
          next.statusLine = JSON.parse(previous) as ClaudeStatusLine;
          restored = true;
        } catch {
          // Corrupt backup — safest is to drop our statusLine rather than keep it.
          delete next.statusLine;
        }
      }
    }

    // Clear the backup regardless (its job is done, or the user took over).
    const opts = settings.pluginConfigs?.[PLUGIN_ID]?.options;
    if (opts && "statusline_previous" in opts) {
      const pluginConfigs = { ...(settings.pluginConfigs ?? {}) };
      const entry = pluginConfigs[PLUGIN_ID] ?? {};
      const nextOpts = { ...(entry.options ?? {}) };
      delete nextOpts.statusline_previous;
      pluginConfigs[PLUGIN_ID] = { ...entry, options: nextOpts };
      next.pluginConfigs = pluginConfigs;
    }

    return next;
  });

  return { restored };
}

export type StatuslineSyncAction = "installed" | "uninstalled" | "install-failed" | "none";

/**
 * Reconciles the `statusLine` key with an enabled-state transition, so the
 * command layer doesn't re-implement the same off→on / on→off logic:
 *   - off → on  → `installStatusLine()` (must run BEFORE the config is saved,
 *     so the capture-once backup is taken; the later config write merges and
 *     preserves it). Returns `install-failed` if the renderer can't resolve.
 *   - on → off  → `uninstallStatusLine()` (restores the previous statusLine).
 *   - no change → nothing (segment/position edits are read live by the renderer;
 *     the SessionStart re-pin fixes any path drift).
 */
export function syncStatuslineInstall(
  previousEnabled: boolean,
  nextEnabled: boolean,
): StatuslineSyncAction {
  if (nextEnabled && !previousEnabled) {
    return installStatusLine().ok ? "installed" : "install-failed";
  }
  if (!nextEnabled && previousEnabled) {
    uninstallStatusLine();
    return "uninstalled";
  }
  return "none";
}
