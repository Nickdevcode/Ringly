import chalk from "chalk";
import { render } from "ink";
import React from "react";
import {
  getClaudeSettingsFile,
  pluginOptionsToRinglyConfig,
  readRinglyPluginOptions,
} from "../core/claudeSettings.js";
import {
  ringlyConfigToPluginOptions,
  syncStatuslineInstall,
  writeRinglyPluginOptions,
} from "../core/claudeSettingsWrite.js";
import { DEFAULT_CONFIG, loadConfig } from "../core/config.js";
import { logger } from "../core/logger.js";
import { createTranslator } from "../core/translator.js";
import { detectPlatform } from "../platform/index.js";
import { App } from "../tui/App.js";

export async function runConfig(): Promise<void> {
  const platform = detectPlatform();
  const isWindows = platform === "windows";

  const existingConfig = (() => {
    try {
      return loadConfig();
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  })();
  const translator = createTranslator(existingConfig.language);

  if (!process.stdout.isTTY) {
    console.log(chalk.yellow(translator.t("cli.config.requires_tty")));
    console.log(chalk.yellow(translator.t("cli.config.requires_tty2")));
    return;
  }

  const baseConfig = pluginOptionsToRinglyConfig(readRinglyPluginOptions(), DEFAULT_CONFIG);
  // Snapshot the pre-edit status-line state so we can detect an on/off flip and
  // install/uninstall the `statusLine` key accordingly.
  const previousStatuslineEnabled = baseConfig.statusline.enabled;

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
            // Reconcile the statusLine key FIRST (off→on captures the backup),
            // then persist options — the write merges and preserves the backup.
            const action = syncStatuslineInstall(
              previousStatuslineEnabled,
              config.statusline.enabled,
            );
            if (action === "install-failed") {
              console.log("");
              console.log(
                `  ${chalk.yellow("⚠")}  ${translator.t("cli.statusline.install_failed")}`,
              );
            }

            const result = writeRinglyPluginOptions(ringlyConfigToPluginOptions(config));
            logger.info("Plugin options updated in Claude Code settings", {
              file: result.file,
              language: config.language,
              events: config.events,
              statuslineAction: action,
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
            console.log(
              `  ${chalk.red("✗")}  ${translator.t("cli.config.save_failed", {
                message: (err as Error).message,
              })}`,
            );
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
