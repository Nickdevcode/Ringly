import { existsSync, rmSync, unlinkSync } from "node:fs";
import chalk from "chalk";
import { getConfigDir, getConfigFile } from "../core/config.js";
import { detectLegacy, disableLegacy } from "../core/legacy.js";
import { logger } from "../core/logger.js";
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
  const platform = detectPlatform();
  console.log(chalk.bold("\nRingly uninstall"));

  if (platform === "windows") {
    const shortcut = defaultShortcutPath();
    if (existsSync(shortcut)) {
      try {
        unlinkSync(shortcut);
        console.log(`  ${chalk.green("✓")} Removed Start Menu shortcut`);
        logger.info("Removed Start Menu shortcut", { shortcut });
      } catch (err) {
        console.log(`  ${chalk.yellow("!")} Failed to remove shortcut: ${(err as Error).message}`);
      }
    } else {
      console.log(`  ${chalk.dim("·")} Shortcut not present (skipping)`);
    }
  }

  if (!options.keepConfig) {
    const configFile = getConfigFile();
    if (existsSync(configFile)) {
      try {
        unlinkSync(configFile);
        console.log(`  ${chalk.green("✓")} Removed local configuration`);
      } catch (err) {
        console.log(`  ${chalk.yellow("!")} Failed to remove config: ${(err as Error).message}`);
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
      console.log(`  ${chalk.dim("·")} No legacy PowerShell hooks detected (skipping)`);
    } else {
      try {
        const result = disableLegacy();
        if (result.removedHooks.length > 0) {
          console.log(
            `  ${chalk.green("✓")} Removed legacy hook entries: ${result.removedHooks.join(", ")}`,
          );
          if (result.backupFile) {
            console.log(`    ${chalk.dim(`Backup: ${result.backupFile}`)}`);
          }
        }
        if (result.movedScripts.length > 0) {
          console.log(
            `  ${chalk.green("✓")} Moved legacy scripts to backup: ${result.movedScripts.join(", ")}`,
          );
          if (result.backupDir) {
            console.log(`    ${chalk.dim(`Backup dir: ${result.backupDir}`)}`);
          }
        }
      } catch (err) {
        console.log(
          `  ${chalk.red("x")} Failed to disable legacy hooks: ${(err as Error).message}`,
        );
        logger.error("Legacy uninstall failed", { message: (err as Error).message });
      }
    }
  }

  console.log("");
  console.log(chalk.dim("To remove the plugin from Claude Code, run:"));
  console.log(chalk.cyan("  /plugin uninstall ringly@ringly"));
  console.log("");
  console.log(chalk.dim("To remove the npm CLI:"));
  console.log(chalk.cyan("  npm uninstall -g ringly"));
  console.log("");

  if (!options.legacy) {
    const detection = detectLegacy();
    if (detection.hooksFound.length > 0 || detection.scriptsFound.length > 0) {
      console.log(
        chalk.yellow(
          "Tip: legacy PowerShell hooks still present. Run `ringly uninstall --legacy` to remove them.",
        ),
      );
      console.log("");
    }
  }
}
