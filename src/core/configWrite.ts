/**
 * Write-path for the Ringly config — only imported by interactive `cli.ts`
 * commands (`ringly init`, `ringly config`). Kept out of `config.ts` so the
 * hook bundle never transitively pulls in `claudeSettingsWrite.ts` and its
 * `chmodSync` / `copyFileSync` / `readdirSync` imports.
 */
import { ringlyConfigToPluginOptions, writeRinglyPluginOptions } from "./claudeSettingsWrite.js";
import { logger } from "./logger.js";
import type { RinglyConfig } from "./types.js";

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
