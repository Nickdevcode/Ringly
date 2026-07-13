/**
 * Read-only config surface for the hook hot path.
 *
 * `loadConfig` + `applyEnvOverrides` are what the Claude Code hook calls on
 * every event, so this module must NOT import anything that pulls in the
 * settings writer (`claudeSettingsWrite.ts`), or the writer's `chmodSync`/
 * `copyFileSync`/`readdirSync` imports will leak back into `dist/hook.{js,cjs}`
 * and bloat the bundle. `saveConfig` lives in `configWrite.ts` for that
 * reason — only `cli.ts` commands import it.
 */
import { pluginOptionsToRinglyConfig, readRinglyPluginOptions } from "./claudeSettings.js";
import { buildDefaultEvents, EVENTS, envSuffix } from "./events.js";
import { logger } from "./logger.js";
import {
  DEFAULT_APP_ID,
  type LanguageSetting,
  type RinglyConfig,
  STATUSLINE_SEGMENT_KEYS,
  type StatuslineContextPosition,
} from "./types.js";

export const DEFAULT_CONFIG: RinglyConfig = {
  schemaVersion: 1,
  language: "auto",
  // Derived from the registry — adding an event needs no change here.
  events: buildDefaultEvents(),
  sound: true,
  debug: false,
  checkUpdates: true,
  appId: DEFAULT_APP_ID,
  // Status line is opt-in (off by default) so installing Ringly never touches
  // the user's existing `statusLine`. `lastCommand` is off by default to match
  // the original hybrid statusline's gated behavior; every other segment is on.
  statusline: {
    enabled: false,
    position: "end",
    segments: {
      model: true,
      task: true,
      dirname: true,
      context: true,
      lastCommand: false,
      git: true,
      lines: true,
      rateLimits: true,
    },
  },
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
    statusline: {
      ...config.statusline,
      segments: { ...config.statusline.segments },
    },
  };

  const lang = process.env["CLAUDE_PLUGIN_OPTION_LANGUAGE"];
  if (lang === "pt-BR" || lang === "en-US" || lang === "auto") {
    next.language = lang;
  }

  // One `CLAUDE_PLUGIN_OPTION_EVENTS_<KEY>` override per registered event.
  for (const e of EVENTS) {
    const value = readBoolean(process.env[`CLAUDE_PLUGIN_OPTION_EVENTS_${envSuffix(e.configKey)}`]);
    if (value !== null) next.events[e.configKey] = value;
  }

  const sound = readBoolean(process.env["CLAUDE_PLUGIN_OPTION_SOUND"]);
  if (sound !== null) next.sound = sound;

  const debug = readBoolean(process.env["CLAUDE_PLUGIN_OPTION_DEBUG"]);
  if (debug !== null) next.debug = debug;

  const checkUpdates = readBoolean(process.env["CLAUDE_PLUGIN_OPTION_CHECK_UPDATES"]);
  if (checkUpdates !== null) next.checkUpdates = checkUpdates;

  // Status line overrides mirror the events loop: one env var per switch.
  const slEnabled = readBoolean(process.env["CLAUDE_PLUGIN_OPTION_STATUSLINE_ENABLED"]);
  if (slEnabled !== null) next.statusline.enabled = slEnabled;

  const slPosition = process.env["CLAUDE_PLUGIN_OPTION_STATUSLINE_POSITION"];
  if (slPosition === "end" || slPosition === "front") next.statusline.position = slPosition;

  for (const key of STATUSLINE_SEGMENT_KEYS) {
    const value = readBoolean(
      process.env[`CLAUDE_PLUGIN_OPTION_STATUSLINE_SEGMENTS_${key.toUpperCase()}`],
    );
    if (value !== null) next.statusline.segments[key] = value;
  }

  next.appId = normalizeAppId(next.appId);
  next.language = normalizeLanguage(next.language);
  next.statusline.position = normalizeStatuslinePosition(next.statusline.position);

  return next;
}

function normalizeStatuslinePosition(value: unknown): StatuslineContextPosition {
  return value === "front" ? "front" : "end";
}

function readBoolean(raw: string | undefined): boolean | null {
  if (raw === undefined) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return null;
}
