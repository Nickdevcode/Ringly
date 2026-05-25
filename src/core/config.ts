import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import envPaths from "env-paths";
import { logger } from "./logger.js";
import { DEFAULT_APP_ID, type LanguageSetting, type RinglyConfig } from "./types.js";

const paths = envPaths("ringly", { suffix: "" });

export function getConfigDir(): string {
  return paths.config;
}

export function getConfigFile(): string {
  return join(paths.config, "config.json");
}

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

export function loadConfig(): RinglyConfig {
  const file = getConfigFile();
  if (!existsSync(file)) return { ...DEFAULT_CONFIG };
  try {
    const raw = readFileSync(file, { encoding: "utf8" });
    const parsed = JSON.parse(raw) as Partial<RinglyConfig>;
    return mergeWithDefaults(parsed);
  } catch (err) {
    logger.warn("Failed to read config; using defaults", {
      file,
      message: (err as Error).message,
    });
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: RinglyConfig): void {
  const file = getConfigFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8" });
}

function mergeWithDefaults(partial: Partial<RinglyConfig>): RinglyConfig {
  return {
    schemaVersion: 1,
    language: normalizeLanguage(partial.language),
    events: {
      notification: partial.events?.notification ?? DEFAULT_CONFIG.events.notification,
      stop: partial.events?.stop ?? DEFAULT_CONFIG.events.stop,
      stopFailure: partial.events?.stopFailure ?? DEFAULT_CONFIG.events.stopFailure,
      subagentStop: partial.events?.subagentStop ?? DEFAULT_CONFIG.events.subagentStop,
    },
    sound: partial.sound ?? DEFAULT_CONFIG.sound,
    debug: partial.debug ?? DEFAULT_CONFIG.debug,
    appId: partial.appId ?? DEFAULT_CONFIG.appId,
  };
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

  return next;
}

function readBoolean(raw: string | undefined): boolean | null {
  if (raw === undefined) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return null;
}
