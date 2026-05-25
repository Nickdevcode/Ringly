import chalk from "chalk";
import { render } from "ink";
import React from "react";
import { loadConfig, saveConfig } from "../core/config.js";
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
    console.log(chalk.yellow("the config.json file directly."));
    return;
  }

  const baseConfig = loadConfig();

  await new Promise<void>((resolve) => {
    const { unmount, waitUntilExit } = render(
      React.createElement(App, {
        initialConfig: baseConfig,
        isWindows,
        registerAumidFn: undefined,
        onComplete: async (config) => {
          try {
            saveConfig(config);
            logger.info("Config updated", {
              language: config.language,
              events: config.events,
            });
          } catch (err) {
            logger.error("Config save failed", { message: (err as Error).message });
          }
        },
        marketplaceCommand: "/plugin marketplace add nickdevcode/Ringly",
        installCommand: "/plugin install ringly@ringly",
      }),
    );

    waitUntilExit().finally(() => {
      unmount();
      resolve();
    });
  });
}
