import { existsSync, unlinkSync } from "node:fs";
import chalk from "chalk";
import { removeRinglyPluginOptions, uninstallStatusLine } from "../core/claudeSettingsWrite.js";
import { loadConfig } from "../core/config.js";
import { logger } from "../core/logger.js";
import { createTranslator } from "../core/translator.js";
import { detectPlatform } from "../platform/index.js";
import { defaultShortcutPath } from "../platform/windows/aumid.js";

export interface RunUninstallOptions {
  keepConfig?: boolean;
}

export async function runUninstall(options: RunUninstallOptions = {}): Promise<void> {
  const config = (() => {
    try {
      return loadConfig();
    } catch {
      return null;
    }
  })();
  const translator = createTranslator(config?.language ?? "auto");

  const platform = detectPlatform();
  printUninstallHeader(translator);

  if (platform === "windows") {
    const shortcut = defaultShortcutPath();
    if (existsSync(shortcut)) {
      try {
        unlinkSync(shortcut);
        console.log(`  ${chalk.green("✓")}  ${translator.t("cli.uninstall.shortcut_removed")}`);
        logger.info("Removed Start Menu shortcut", { shortcut });
      } catch (err) {
        console.log(
          `  ${chalk.yellow("⚠")}  ${translator.t("cli.uninstall.shortcut_failed", {
            message: (err as Error).message,
          })}`,
        );
      }
    } else {
      console.log(`  ${chalk.dim("·")}  ${translator.t("cli.uninstall.shortcut_absent")}`);
    }
  }

  // Restore the previous statusLine BEFORE removing plugin options — the removal
  // deletes the whole `pluginConfigs.ringly` block (including the backup), so
  // restoring after it would be impossible. Runs regardless of --keep-config:
  // the statusLine is a global key and leaving Ringly's active during uninstall
  // would be surprising. Reads the backup itself, so it no-ops when unused.
  try {
    const result = uninstallStatusLine();
    if (result.restored) {
      console.log(`  ${chalk.green("✓")}  ${translator.t("cli.uninstall.statusline_restored")}`);
    } else {
      console.log(`  ${chalk.dim("·")}  ${translator.t("cli.uninstall.statusline_absent")}`);
    }
  } catch (err) {
    logger.warn("Failed to restore statusLine during uninstall", {
      message: (err as Error).message,
    });
  }

  if (!options.keepConfig) {
    try {
      const removed = removeRinglyPluginOptions();
      if (removed) {
        console.log(`  ${chalk.green("✓")}  ${translator.t("cli.uninstall.config_removed")}`);
      } else {
        console.log(`  ${chalk.dim("·")}  ${translator.t("cli.uninstall.config_absent")}`);
      }
    } catch (err) {
      console.log(
        `  ${chalk.yellow("⚠")}  ${translator.t("cli.uninstall.config_failed", {
          message: (err as Error).message,
        })}`,
      );
    }
  }

  console.log("");
  console.log(`  ${chalk.bold(translator.t("cli.uninstall.next_steps"))}`);
  console.log(`  ${chalk.dim(translator.t("cli.uninstall.remove_plugin"))}`);
  console.log(`    ${chalk.cyan("/plugin uninstall ringly@ringly")}`);
  console.log("");
  console.log(`  ${chalk.dim(translator.t("cli.uninstall.remove_npm"))}`);
  console.log(`    ${chalk.cyan("npm uninstall -g ringly")}`);
  console.log("");
}

function printUninstallHeader(translator: { t: (k: string) => string }): void {
  const title = `◉ ${translator.t("cli.uninstall.header")}`;
  const border = "─".repeat(title.length + 2);
  console.log("");
  console.log(chalk.yellow(`╭${border}╮`));
  console.log(chalk.yellow("│ ") + chalk.bold.yellow(title) + chalk.yellow(" │"));
  console.log(chalk.yellow(`╰${border}╯`));
  console.log("");
}
