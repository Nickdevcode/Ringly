import { existsSync, rmSync, unlinkSync } from "node:fs";
import chalk from "chalk";
import { getConfigDir, getConfigFile, loadConfig } from "../core/config.js";
import { detectLegacy, disableLegacy } from "../core/legacy.js";
import { logger } from "../core/logger.js";
import { createTranslator } from "../core/translator.js";
import { detectPlatform } from "../platform/index.js";
import { defaultShortcutPath } from "../platform/windows/aumid.js";

export interface RunUninstallOptions {
  keepConfig?: boolean;
  legacy?: boolean;
}

/**
 * Desinstala o Ringly do computador do usuário. Por padrão remove apenas o
 * que o próprio Ringly instalou (atalho do Menu Iniciar + config local).
 *
 * Quando `legacy = true`, também remove os hooks/scripts pré-existentes do
 * sistema PowerShell antigo (`notify-toast.ps1` etc.) que rodava em
 * `~/.claude/hooks/`. Isso é o que chamamos de "reset total" no README.
 *
 * A remoção do plugin do Claude Code (`/plugin uninstall`) e do pacote npm
 * (`npm uninstall -g ringly`) precisa ser feita manualmente pelo usuário,
 * porque ambos estão fora do escopo desta CLI.
 */
export async function runUninstall(options: RunUninstallOptions = {}): Promise<void> {
  /**
   * Tentamos carregar a config ANTES de remover qualquer coisa, pra
   * preservar o idioma do usuário nas mensagens de output mesmo no
   * cenário em que o uninstall apague o arquivo de config logo a seguir.
   */
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

  if (!options.keepConfig) {
    const configFile = getConfigFile();
    if (existsSync(configFile)) {
      try {
        unlinkSync(configFile);
        console.log(`  ${chalk.green("✓")}  ${translator.t("cli.uninstall.config_removed")}`);
      } catch (err) {
        console.log(
          `  ${chalk.yellow("⚠")}  ${translator.t("cli.uninstall.config_failed", {
            message: (err as Error).message,
          })}`,
        );
      }
    }
    const configDir = getConfigDir();
    if (existsSync(configDir)) {
      try {
        rmSync(configDir, { recursive: true, force: true });
      } catch {
        /* ignore — config directory may already be gone */
      }
    }
  }

  if (options.legacy) {
    const detection = detectLegacy();
    const totalLegacy = detection.hooksFound.length + detection.scriptsFound.length;

    if (totalLegacy === 0) {
      console.log(`  ${chalk.dim("·")}  ${translator.t("cli.uninstall.legacy_none")}`);
    } else {
      try {
        const result = disableLegacy();
        if (result.removedHooks.length > 0) {
          console.log(
            `  ${chalk.green("✓")}  ${translator.t("cli.uninstall.legacy_hooks_removed", {
              events: result.removedHooks.join(", "),
            })}`,
          );
          if (result.backupFile) {
            console.log(
              `     ${chalk.dim("↳ ")}${chalk.dim(
                translator.t("cli.uninstall.backup", { file: result.backupFile }),
              )}`,
            );
          }
        }
        if (result.movedScripts.length > 0) {
          console.log(
            `  ${chalk.green("✓")}  ${translator.t("cli.uninstall.legacy_scripts_moved", {
              scripts: result.movedScripts.join(", "),
            })}`,
          );
          if (result.backupDir) {
            console.log(
              `     ${chalk.dim("↳ ")}${chalk.dim(
                translator.t("cli.uninstall.backup_dir", { dir: result.backupDir }),
              )}`,
            );
          }
        }
      } catch (err) {
        console.log(
          `  ${chalk.red("✗")}  ${translator.t("cli.uninstall.legacy_failed", {
            message: (err as Error).message,
          })}`,
        );
        logger.error("Legacy uninstall failed", { message: (err as Error).message });
      }
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

  if (!options.legacy) {
    const detection = detectLegacy();
    if (detection.hooksFound.length > 0 || detection.scriptsFound.length > 0) {
      console.log(
        chalk.yellow(
          `  ⚠  ${translator.t("cli.uninstall.legacy_warn", {
            command: "`ringly uninstall --legacy`",
          })}`,
        ),
      );
      console.log("");
    }
  }
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
