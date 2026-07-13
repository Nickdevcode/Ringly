/**
 * Read-only access to `~/.claude/settings.json` plus shared types/constants.
 *
 * This module is intentionally narrow: the Claude Code hook loads on every
 * Notification/Stop/SubagentStop event, so anything imported transitively
 * here ships in `dist/hook.{js,cjs}`. The hook never writes settings —
 * only reads them — so the write/backup/rotation surface lives in the
 * sibling `claudeSettingsWrite.ts` (with its `chmodSync`/`copyFileSync`/
 * `readdirSync` imports), kept out of the hot path by way of being only
 * reachable from interactive `cli.ts` commands.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { EVENTS, optionField } from "./events.js";
import { logger } from "./logger.js";
import {
  type RinglyConfig,
  STATUSLINE_SEGMENT_KEYS,
  type StatuslineContextPosition,
  type StatuslineSegments,
} from "./types.js";

/** The persisted settings.json field name for a status-line segment switch. */
export function statuslineSegmentField(
  key: keyof StatuslineSegments,
): `statusline_segment_${string}` {
  return `statusline_segment_${key}`;
}

export const PLUGIN_ID = "ringly";

export interface PluginConfigEntry {
  options?: Record<string, unknown>;
}

/**
 * The `statusLine` key in `~/.claude/settings.json` (a global user setting).
 * Claude Code runs `command` and renders its stdout. Only one may exist.
 */
export interface ClaudeStatusLine {
  type?: string;
  command?: string;
  padding?: number;
  refreshInterval?: number;
  [key: string]: unknown;
}

export interface ClaudeSettings extends Record<string, unknown> {
  pluginConfigs?: Record<string, PluginConfigEntry>;
  statusLine?: ClaudeStatusLine;
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
  sound?: boolean;
  debug?: boolean;
  check_updates?: boolean;
  // Per-event toggles persist as `events_<configKey>` (e.g. `events_stop`).
  // The index signature lets the registry drive the key set; the four
  // historical keys below are kept explicit for documentation/discoverability.
  // (`| undefined` is required by `noUncheckedIndexedAccess`.)
  events_notification?: boolean;
  events_stop?: boolean;
  events_stopFailure?: boolean;
  events_subagentStop?: boolean;
  [key: `events_${string}`]: boolean | undefined;
  // Status line: master switch, meter position, and one `statusline_segment_*`
  // per segment (e.g. `statusline_segment_git`). The index signature drives the
  // per-segment set; the keys below stay explicit for discoverability.
  statusline_enabled?: boolean;
  statusline_position?: string;
  statusline_segment_model?: boolean;
  statusline_segment_task?: boolean;
  statusline_segment_dirname?: boolean;
  statusline_segment_context?: boolean;
  statusline_segment_lastCommand?: boolean;
  statusline_segment_git?: boolean;
  statusline_segment_lines?: boolean;
  statusline_segment_rateLimits?: boolean;
  [key: `statusline_segment_${string}`]: boolean | undefined;
  /**
   * Install metadata (NOT part of `RinglyConfig`): a JSON-stringified snapshot
   * of the `statusLine` key that existed before Ringly installed its own, so
   * disabling/uninstalling can restore it. `""` means "there was nothing to
   * back up" (restore ⇒ delete the key); the field being absent means Ringly
   * never installed its status line. Managed only by `claudeSettingsWrite.ts`.
   */
  statusline_previous?: string;
}

export function readRinglyPluginOptions(): RinglyPluginOptions {
  const settings = readClaudeSettings();
  const entry = settings.pluginConfigs?.[PLUGIN_ID];
  return (entry?.options ?? {}) as RinglyPluginOptions;
}

export function pluginOptionsToRinglyConfig(
  options: RinglyPluginOptions,
  defaults: RinglyConfig,
): RinglyConfig {
  const lang = options.language;
  const language =
    lang === "auto" || lang === "pt-BR" || lang === "en-US" ? lang : defaults.language;

  // One `events_<configKey>` read per registered event, falling back to the
  // default when the key is absent — so old settings.json files (which only
  // have the original keys) keep working and new events default to off.
  const events = { ...defaults.events };
  for (const e of EVENTS) {
    events[e.configKey] = options[optionField(e.configKey)] ?? defaults.events[e.configKey];
  }

  // Status line: same key-absent-falls-back-to-default rule, so settings files
  // written before this feature existed load with the feature off.
  const position: StatuslineContextPosition =
    options.statusline_position === "front" || options.statusline_position === "end"
      ? options.statusline_position
      : defaults.statusline.position;
  const segments = { ...defaults.statusline.segments };
  for (const key of STATUSLINE_SEGMENT_KEYS) {
    segments[key] = options[statuslineSegmentField(key)] ?? defaults.statusline.segments[key];
  }

  return {
    ...defaults,
    language,
    events,
    sound: options.sound ?? defaults.sound,
    debug: options.debug ?? defaults.debug,
    checkUpdates: options.check_updates ?? defaults.checkUpdates,
    statusline: {
      enabled: options.statusline_enabled ?? defaults.statusline.enabled,
      position,
      segments,
    },
  };
}
