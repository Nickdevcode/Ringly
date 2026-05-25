import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { logger } from "./logger.js";
import type { RinglyConfig } from "./types.js";

const PLUGIN_ID = "ringly";

interface PluginConfigEntry {
  options?: Record<string, unknown>;
}

interface ClaudeSettings extends Record<string, unknown> {
  pluginConfigs?: Record<string, PluginConfigEntry>;
}

export function getClaudeSettingsFile(): string {
  return join(homedir(), ".claude", "settings.json");
}

export function readClaudeSettings(): ClaudeSettings {
  const file = getClaudeSettingsFile();
  if (!existsSync(file)) return {};
  try {
    const raw = readFileSync(file, { encoding: "utf8" });
    if (raw.trim().length === 0) return {};
    return JSON.parse(raw) as ClaudeSettings;
  } catch (err) {
    logger.warn("Failed to parse ~/.claude/settings.json", {
      file,
      message: (err as Error).message,
    });
    return {};
  }
}

export interface RinglyPluginOptions {
  language?: string;
  events_notification?: boolean;
  events_stop?: boolean;
  events_stopFailure?: boolean;
  events_subagentStop?: boolean;
  sound?: boolean;
  debug?: boolean;
}

export function readRinglyPluginOptions(): RinglyPluginOptions {
  const settings = readClaudeSettings();
  const entry = settings.pluginConfigs?.[PLUGIN_ID];
  return (entry?.options ?? {}) as RinglyPluginOptions;
}

export interface SaveResult {
  file: string;
  backupFile: string | null;
  wasCreated: boolean;
}

export function writeRinglyPluginOptions(options: RinglyPluginOptions): SaveResult {
  const file = getClaudeSettingsFile();
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true });

  const wasCreated = !existsSync(file);
  let backupFile: string | null = null;

  if (!wasCreated) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupFile = `${file}.ringly-bak.${timestamp}`;
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

  writeFileSync(file, `${JSON.stringify(nextSettings, null, 2)}\n`, { encoding: "utf8" });

  return { file, backupFile, wasCreated };
}

export function ringlyConfigToPluginOptions(config: RinglyConfig): RinglyPluginOptions {
  return {
    language: config.language,
    events_notification: config.events.notification,
    events_stop: config.events.stop,
    events_stopFailure: config.events.stopFailure,
    events_subagentStop: config.events.subagentStop,
    sound: config.sound,
    debug: config.debug,
  };
}

export function pluginOptionsToRinglyConfig(
  options: RinglyPluginOptions,
  defaults: RinglyConfig,
): RinglyConfig {
  const lang = options.language;
  const language =
    lang === "auto" || lang === "pt-BR" || lang === "en-US" ? lang : defaults.language;

  return {
    ...defaults,
    language,
    events: {
      notification: options.events_notification ?? defaults.events.notification,
      stop: options.events_stop ?? defaults.events.stop,
      stopFailure: options.events_stopFailure ?? defaults.events.stopFailure,
      subagentStop: options.events_subagentStop ?? defaults.events.subagentStop,
    },
    sound: options.sound ?? defaults.sound,
    debug: options.debug ?? defaults.debug,
  };
}

export function hasRinglyPluginOptions(): boolean {
  const opts = readRinglyPluginOptions();
  return Object.keys(opts).length > 0;
}
