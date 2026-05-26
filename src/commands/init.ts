import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import envPaths from "env-paths";
import { render } from "ink";
import React from "react";
import { DEFAULT_CONFIG, loadConfig } from "../core/config.js";
import { saveConfig } from "../core/configWrite.js";
import { logger } from "../core/logger.js";
import { createTranslator, type Translator } from "../core/translator.js";
import type { RinglyConfig } from "../core/types.js";
import { DEFAULT_APP_ID } from "../core/types.js";
import { detectPlatform } from "../platform/index.js";
import { type RegisterAumidResult, registerAumid } from "../platform/windows/aumid.js";
import { App } from "../tui/App.js";

export interface RunInitOptions {
  force?: boolean;
  nonInteractive?: boolean;
}

const MARKETPLACE_COMMAND = "/plugin marketplace add nickdevcode/Ringly";
const INSTALL_COMMAND = "/plugin install ringly@ringly";

export async function runInit(options: RunInitOptions = {}): Promise<void> {
  const platform = detectPlatform();
  const isWindows = platform === "windows";

  const existingConfig = (() => {
    try {
      return loadConfig();
    } catch {
      return null;
    }
  })();
  const cliTranslator = createTranslator(existingConfig?.language ?? "auto");

  if (!process.stdout.isTTY || options.nonInteractive) {
    await runNonInteractive(cliTranslator, isWindows);
    return;
  }

  const baseConfig: RinglyConfig = options.force ? { ...DEFAULT_CONFIG } : loadConfig();

  await new Promise<void>((resolve) => {
    const { unmount, waitUntilExit } = render(
      React.createElement(App, {
        initialConfig: baseConfig,
        isWindows,
        registerAumidFn: isWindows ? (appId: string) => registerAumid({ appId }) : undefined,
        onComplete: async (config, aumidResult) => {
          try {
            saveConfig(config);
            writeInstallLog(config, aumidResult);
            logger.info("Init finished", {
              language: config.language,
              events: config.events,
            });
          } catch (err) {
            logger.error("Init persistence failed", { message: (err as Error).message });
          }
        },
        marketplaceCommand: MARKETPLACE_COMMAND,
        installCommand: INSTALL_COMMAND,
      }),
    );

    waitUntilExit().finally(() => {
      unmount();
      resolve();
    });
  });
}

async function runNonInteractive(translator: Translator, isWindows: boolean): Promise<void> {
  const title = `◉ ${translator.t("cli.init.header_noninteractive")}`;
  const border = "─".repeat(title.length + 2);
  console.log("");
  console.log(chalk.cyan(`╭${border}╮`));
  console.log(chalk.cyan("│ ") + chalk.bold.cyan(title) + chalk.cyan(" │"));
  console.log(chalk.cyan(`╰${border}╯`));
  console.log("");

  const config = { ...DEFAULT_CONFIG };
  saveConfig(config);
  console.log(`  ${chalk.green("✓")}  ${translator.t("cli.init.default_saved")}`);

  let aumid: RegisterAumidResult | null = null;
  if (isWindows) {
    aumid = await registerAumid({ appId: DEFAULT_APP_ID });
    if (aumid.ok) {
      console.log(`  ${chalk.green("✓")}  ${translator.t("cli.init.aumid_registered")}`);
    } else {
      console.log(
        `  ${chalk.yellow("⚠")}  ${translator.t("cli.init.aumid_skipped", {
          reason: aumid.reason ?? "unknown",
        })}`,
      );
    }
  }

  writeInstallLog(config, aumid);

  console.log("");
  console.log(`  ${chalk.bold(translator.t("cli.init.next_steps_in_claude"))}`);
  console.log(`    ${chalk.cyan(MARKETPLACE_COMMAND)}`);
  console.log(`    ${chalk.cyan(INSTALL_COMMAND)}`);
  console.log("");
}

function writeInstallLog(config: RinglyConfig, aumid: RegisterAumidResult | null): void {
  try {
    const dir =
      process.env.CLAUDE_PLUGIN_DATA && process.env.CLAUDE_PLUGIN_DATA.trim().length > 0
        ? process.env.CLAUDE_PLUGIN_DATA
        : envPaths("ringly", { suffix: "" }).data;
    mkdirSync(dir, { recursive: true });
    const payload = {
      installedAt: new Date().toISOString(),
      cliVersion: process.env.npm_package_version ?? "dev",
      platform: process.platform,
      nodeVersion: process.versions.node,
      config,
      aumid,
    };
    writeFileSync(join(dir, "install.json"), JSON.stringify(payload, null, 2), {
      encoding: "utf8",
    });
  } catch (err) {
    logger.warn("Failed to write install log", { message: (err as Error).message });
  }
}
