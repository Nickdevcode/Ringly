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
  getClaudeSettingsFile,
  PLUGIN_ID,
  type PluginConfigEntry,
  type RinglyPluginOptions,
  readClaudeSettings,
} from "./claudeSettings.js";
import { EVENTS, optionField } from "./events.js";
import { logger } from "./logger.js";
import type { RinglyConfig } from "./types.js";

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

export function writeRinglyPluginOptions(options: RinglyPluginOptions): SaveResult {
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
  const nextSettings: ClaudeSettings = { ...settings };
  const pluginConfigs: Record<string, PluginConfigEntry> = { ...(settings.pluginConfigs ?? {}) };
  const existingEntry: PluginConfigEntry = pluginConfigs[PLUGIN_ID] ?? {};

  pluginConfigs[PLUGIN_ID] = {
    ...existingEntry,
    options: { ...(existingEntry.options ?? {}), ...options },
  };
  nextSettings.pluginConfigs = pluginConfigs;

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

export function ringlyConfigToPluginOptions(config: RinglyConfig): RinglyPluginOptions {
  const options: RinglyPluginOptions = {
    language: config.language,
    sound: config.sound,
    debug: config.debug,
    check_updates: config.checkUpdates,
  };
  // One `events_<configKey>` field per registered event.
  for (const e of EVENTS) {
    options[optionField(e.configKey)] = config.events[e.configKey];
  }
  return options;
}

export function removeRinglyPluginOptions(): boolean {
  const file = getClaudeSettingsFile();
  if (!existsSync(file)) return false;

  const settings = readClaudeSettings();
  if (!settings.pluginConfigs?.[PLUGIN_ID]) return false;

  const nextPluginConfigs = { ...settings.pluginConfigs };
  delete nextPluginConfigs[PLUGIN_ID];

  const nextSettings: ClaudeSettings = { ...settings };
  if (Object.keys(nextPluginConfigs).length === 0) {
    delete nextSettings.pluginConfigs;
  } else {
    nextSettings.pluginConfigs = nextPluginConfigs;
  }

  atomicWriteFileSync(file, `${JSON.stringify(nextSettings, null, 2)}\n`);

  if (process.platform !== "win32") {
    try {
      chmodSync(file, 0o600);
    } catch {
      /* ignore */
    }
  }

  return true;
}
