import chalk from "chalk";
import { render } from "ink";
import React from "react";
import {
  getClaudeSettingsFile,
  pluginOptionsToRinglyConfig,
  readRinglyPluginOptions,
  ringlyConfigToPluginOptions,
  writeRinglyPluginOptions,
} from "../core/claudeSettings.js";
import { DEFAULT_CONFIG } from "../core/config.js";
import { logger } from "../core/logger.js";
import { detectPlatform } from "../platform/index.js";
import { App } from "../tui/App.js";

export async function runConfig(): Promise<void> {
  const platform = detectPlatform();
  const isWindows = platform === "windows";

  if (!process.stdout.isTTY) {
    console.log(
      chalk.yellow("`config` requires an interactive terminal. Pass settings via env vars or edit"),
    );
    console.log(chalk.yellow("the ~/.claude/settings.json file directly."));
    return;
  }

  const baseConfig = pluginOptionsToRinglyConfig(readRinglyPluginOptions(), DEFAULT_CONFIG);

  await new Promise<void>((resolve) => {
    const { unmount, waitUntilExit } = render(
      React.createElement(App, {
        initialConfig: baseConfig,
        isWindows,
        mode: "config",
        registerAumidFn: undefined,
        settingsFile: getClaudeSettingsFile(),
        onComplete: async (config) => {
          try {
            const result = writeRinglyPluginOptions(ringlyConfigToPluginOptions(config));
            logger.info("Plugin options updated in Claude Code settings", {
              file: result.file,
              language: config.language,
              events: config.events,
            });
            if (result.wasCreated) {
              logger.info("Created fresh ~/.claude/settings.json");
            } else if (result.backupFile) {
              logger.info("Backup of previous settings.json created", {
                backupFile: result.backupFile,
              });
            }
          } catch (err) {
            logger.error("Settings save failed", { message: (err as Error).message });
            console.log("");
            console.log(`  ${chalk.red("✗")}  Failed to save settings: ${(err as Error).message}`);
          }
        },
      }),
    );

    waitUntilExit().finally(() => {
      unmount();
      resolve();
    });
  });
}
