/**
 * `ringly help` — prints a translated overview of every CLI subcommand,
 * with a banner warning that these commands must be run in an external
 * terminal (PowerShell, Bash, …), not pasted into the Claude Code chat.
 *
 * Translation matters here for two reasons:
 *  1. The CLI honours the user's `pluginConfigs.ringly.options.language`
 *     for every other command (test, doctor, update, init), so help should
 *     too — otherwise the user's locale choice silently leaks back to
 *     English at the most discoverable surface.
 *  2. The `/ringly-help` slash command echoes this output verbatim into
 *     the Claude Code chat. That output IS what the user sees; it must
 *     already be in the right language.
 */
import chalk from "chalk";
import { DEFAULT_CONFIG, loadConfig } from "../core/config.js";
import { createTranslator, type Translator } from "../core/translator.js";

interface CommandRow {
  name: string;
  /** Translator key holding the localized one-line description. */
  descriptionKey: string;
}

const COMMANDS: readonly CommandRow[] = [
  { name: "test", descriptionKey: "cli.help.command.test" },
  { name: "init", descriptionKey: "cli.help.command.init" },
  { name: "config", descriptionKey: "cli.help.command.config" },
  { name: "doctor", descriptionKey: "cli.help.command.doctor" },
  { name: "update", descriptionKey: "cli.help.command.update" },
  { name: "uninstall", descriptionKey: "cli.help.command.uninstall" },
  { name: "help", descriptionKey: "cli.help.command.help" },
];

export async function runHelp(): Promise<void> {
  const config = (() => {
    try {
      return loadConfig();
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  })();
  const translator = createTranslator(config.language);
  printHelp(translator);
}

/**
 * Exposed so tests can drive the rendering without going through `loadConfig`
 * (which touches the user's real `~/.claude/settings.json`).
 */
export function printHelp(translator: Translator): void {
  printHeader(translator);

  console.log(`  ${chalk.yellow.bold(translator.t("cli.help.warning_external_terminal"))}`);
  console.log("");
  console.log(`  ${chalk.dim(translator.t("cli.help.intro"))}`);
  console.log("");

  console.log(`  ${chalk.bold(translator.t("cli.help.usage_label"))}`);
  console.log(`    ${chalk.cyan(translator.t("cli.help.usage_value"))}`);
  console.log("");

  console.log(`  ${chalk.bold(translator.t("cli.help.commands_label"))}`);
  const widest = COMMANDS.reduce((acc, c) => Math.max(acc, c.name.length), 0);
  for (const cmd of COMMANDS) {
    const padded = cmd.name.padEnd(widest, " ");
    const desc = translator.t(cmd.descriptionKey);
    console.log(`    ${chalk.cyan(`ringly ${padded}`)}  ${chalk.dim("—")} ${desc}`);
  }
  console.log("");

  console.log(`  ${chalk.bold(translator.t("cli.help.options_label"))}`);
  console.log(
    `    ${chalk.cyan("-h, --help")}     ${chalk.dim("—")} ${translator.t("cli.help.option.help")}`,
  );
  console.log(
    `    ${chalk.cyan("-v, --version")}  ${chalk.dim("—")} ${translator.t("cli.help.option.version")}`,
  );
  console.log("");

  console.log(`  ${chalk.dim(translator.t("cli.help.footer"))}`);
  console.log("");
}

function printHeader(translator: Translator): void {
  const header = `◉ ${translator.t("cli.help.header")}`;
  const border = "─".repeat(header.length + 2);
  console.log("");
  console.log(chalk.cyan(`╭${border}╮`));
  console.log(chalk.cyan("│ ") + chalk.bold.cyan(header) + chalk.cyan(" │"));
  console.log(chalk.cyan(`╰${border}╯`));
  console.log("");
}
