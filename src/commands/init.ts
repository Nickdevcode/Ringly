import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import envPaths from "env-paths";
import { render } from "ink";
import React from "react";
import { DEFAULT_CONFIG, loadConfig, saveConfig } from "../core/config.js";
import { detectLegacy, disableLegacy } from "../core/legacy.js";
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
  migrateLegacy?: boolean;
}

/**
 * Comandos exatos que o usuário deve colar dentro do Claude Code depois
 * que o `ringly init` termina. Mantemos como constantes para reaproveitar
 * tanto no fluxo interativo (TUI Ink) quanto no não-interativo.
 */
const MARKETPLACE_COMMAND = "/plugin marketplace add nickdevcode/Ringly";
const INSTALL_COMMAND = "/plugin install ringly@ringly";

/**
 * Orquestra o setup inicial do Ringly. Por padrão renderiza uma TUI Ink
 * que coleta preferências do usuário (idioma, eventos, som, debug) e
 * registra o AUMID no Windows. Se a stdin não for um TTY ou
 * `--non-interactive` for passado, cai num modo headless que aceita
 * defaults e ainda assim deixa tudo funcional.
 *
 * Sempre que detecta o sistema antigo (PowerShell pré-Ringly), informa o
 * usuário e oferece migração automática via `--migrate-legacy` (no modo
 * headless) ou aviso na tela inicial da TUI.
 */
export async function runInit(options: RunInitOptions = {}): Promise<void> {
  const platform = detectPlatform();
  const isWindows = platform === "windows";

  /**
   * O fluxo interativo (TUI) começa em inglês por design — só depois que
   * o usuário escolhe o idioma é que as telas mudam. Já as mensagens
   * "infra" (legacy detection, headless mode) tentam usar o idioma da
   * config existente para não trocar de idioma no meio do `ringly init`
   * de quem já é usuário do Ringly.
   */
  const existingConfig = (() => {
    try {
      return loadConfig();
    } catch {
      return null;
    }
  })();
  const cliTranslator = createTranslator(existingConfig?.language ?? "auto");

  const detection = detectLegacy();
  const hasLegacy = detection.hooksFound.length > 0 || detection.scriptsFound.length > 0;

  if (hasLegacy) {
    if (options.migrateLegacy) {
      runLegacyMigration(cliTranslator);
    } else {
      console.log("");
      console.log(
        `  ${chalk.bold.yellow("⚠")}  ${chalk.bold.yellow(cliTranslator.t("cli.init.legacy_detected"))}`,
      );
      if (detection.hooksFound.length > 0) {
        console.log(
          chalk.dim(
            `     • ${cliTranslator.t("cli.init.legacy_hooks", {
              events: detection.hooksFound.join(", "),
            })}`,
          ),
        );
      }
      if (detection.scriptsFound.length > 0) {
        console.log(
          chalk.dim(
            `     • ${cliTranslator.t("cli.init.legacy_scripts", {
              scripts: detection.scriptsFound.join(", "),
            })}`,
          ),
        );
      }
      console.log(chalk.dim(`     ${cliTranslator.t("cli.init.legacy_warning")}`));
      console.log(`     ${chalk.cyan("ringly init --migrate-legacy")}`);
      console.log("");
    }
  }

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

/**
 * Fluxo "headless" usado em CI, scripts e quando o terminal não suporta
 * Ink. Mantém a TUI completamente isolada — nenhum import dela é feito
 * aqui — para que cenários como Docker sem TTY ainda consigam configurar
 * o Ringly via flags.
 */
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

/**
 * Aplica a migração do sistema antigo de forma síncrona, antes que o
 * fluxo principal do `init` siga em frente. Errors são reportados na
 * tela mas não interrompem o init — a ideia é que mesmo em caso de
 * falha parcial o usuário consiga prosseguir com a instalação nova.
 */
function runLegacyMigration(translator: Translator): void {
  console.log("");
  console.log(`  ${chalk.bold.cyan("◉")} ${chalk.bold(translator.t("cli.init.legacy_migrating"))}`);
  try {
    const result = disableLegacy();
    if (result.removedHooks.length > 0) {
      console.log(
        `  ${chalk.green("✓")}  ${translator.t("cli.init.legacy_removed", {
          events: result.removedHooks.join(", "),
        })}`,
      );
      if (result.backupFile) {
        console.log(`     ${chalk.dim("↳ ")}${chalk.dim(`Backup: ${result.backupFile}`)}`);
      }
    }
    if (result.movedScripts.length > 0) {
      console.log(
        `  ${chalk.green("✓")}  ${translator.t("cli.init.legacy_archived", {
          scripts: result.movedScripts.join(", "),
        })}`,
      );
      if (result.backupDir) {
        console.log(`     ${chalk.dim("↳ ")}${chalk.dim(`Backup dir: ${result.backupDir}`)}`);
      }
    }
    if (result.removedHooks.length === 0 && result.movedScripts.length === 0) {
      console.log(`  ${chalk.dim("·")}  ${translator.t("cli.init.legacy_nothing")}`);
    }
  } catch (err) {
    console.log(
      `  ${chalk.red("✗")}  ${translator.t("cli.init.legacy_failed", {
        message: (err as Error).message,
      })}`,
    );
    logger.error("Legacy migration failed", { message: (err as Error).message });
  }
  console.log("");
}

/**
 * Persiste um registro de instalação no diretório de dados do Ringly.
 * Esse arquivo é puramente informativo (não influencia runtime) — serve
 * para o `doctor` e o suporte da comunidade auditarem o estado de
 * instalação de forma reproduzível.
 */
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
