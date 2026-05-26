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
import { logger } from "./logger.js";
import type { RinglyConfig } from "./types.js";

export const PLUGIN_ID = "ringly";

export interface PluginConfigEntry {
  options?: Record<string, unknown>;
}

export interface ClaudeSettings extends Record<string, unknown> {
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
  check_updates?: boolean;
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
    checkUpdates: options.check_updates ?? defaults.checkUpdates,
  };
}
