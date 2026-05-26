import {
  pluginOptionsToRinglyConfig,
  readRinglyPluginOptions,
  ringlyConfigToPluginOptions,
  writeRinglyPluginOptions,
} from "./claudeSettings.js";
import { logger } from "./logger.js";
import { DEFAULT_APP_ID, type LanguageSetting, type RinglyConfig } from "./types.js";

export const DEFAULT_CONFIG: RinglyConfig = {
  schemaVersion: 1,
  language: "auto",
  events: {
    notification: true,
    stop: true,
    stopFailure: true,
    subagentStop: false,
  },
  sound: true,
  debug: false,
  appId: DEFAULT_APP_ID,
};

/**
 * Loads the Ringly config from `~/.claude/settings.json`
 * (`pluginConfigs.ringly.options` key). If the key is missing or
 * the read fails, returns `DEFAULT_CONFIG`.
 */
export function loadConfig(): RinglyConfig {
  try {
    const opts = readRinglyPluginOptions();
    return pluginOptionsToRinglyConfig(opts, DEFAULT_CONFIG);
  } catch (err) {
    logger.warn("Failed to read Claude settings; using defaults", {
      message: (err as Error).message,
    });
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Persists the Ringly config to `~/.claude/settings.json`
 * (`pluginConfigs.ringly.options` key) with atomic write + backup.
 */
export function saveConfig(config: RinglyConfig): void {
  try {
    writeRinglyPluginOptions(ringlyConfigToPluginOptions(config));
  } catch (err) {
    logger.warn("Failed to save to ~/.claude/settings.json", {
      message: (err as Error).message,
    });
  }
}

const APP_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function normalizeAppId(value: unknown): string {
  if (typeof value !== "string" || !APP_ID_PATTERN.test(value)) {
    if (value !== undefined) {
      logger.warn("Invalid appId in config; using default", { value: String(value) });
    }
    return DEFAULT_CONFIG.appId;
  }
  return value;
}

function normalizeLanguage(value: unknown): LanguageSetting {
  if (value === "pt-BR" || value === "en-US" || value === "auto") return value;
  return DEFAULT_CONFIG.language;
}

export function applyEnvOverrides(config: RinglyConfig): RinglyConfig {
  const next: RinglyConfig = {
    ...config,
    events: { ...config.events },
  };

  const lang = process.env["CLAUDE_PLUGIN_OPTION_LANGUAGE"];
  if (lang === "pt-BR" || lang === "en-US" || lang === "auto") {
    next.language = lang;
  }

  const eventNotification = readBoolean(process.env["CLAUDE_PLUGIN_OPTION_EVENTS_NOTIFICATION"]);
  if (eventNotification !== null) next.events.notification = eventNotification;
  const eventStop = readBoolean(process.env["CLAUDE_PLUGIN_OPTION_EVENTS_STOP"]);
  if (eventStop !== null) next.events.stop = eventStop;
  const eventStopFailure = readBoolean(process.env["CLAUDE_PLUGIN_OPTION_EVENTS_STOPFAILURE"]);
  if (eventStopFailure !== null) next.events.stopFailure = eventStopFailure;
  const eventSubagentStop = readBoolean(process.env["CLAUDE_PLUGIN_OPTION_EVENTS_SUBAGENTSTOP"]);
  if (eventSubagentStop !== null) next.events.subagentStop = eventSubagentStop;

  const sound = readBoolean(process.env["CLAUDE_PLUGIN_OPTION_SOUND"]);
  if (sound !== null) next.sound = sound;

  const debug = readBoolean(process.env["CLAUDE_PLUGIN_OPTION_DEBUG"]);
  if (debug !== null) next.debug = debug;

  next.appId = normalizeAppId(next.appId);
  next.language = normalizeLanguage(next.language);

  return next;
}

function readBoolean(raw: string | undefined): boolean | null {
  if (raw === undefined) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return null;
}
