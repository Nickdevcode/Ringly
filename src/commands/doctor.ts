import { existsSync } from "node:fs";
import chalk from "chalk";
import { getClaudeSettingsFile, readRinglyPluginOptions } from "../core/claudeSettings.js";
import { getConfigFile, loadConfig } from "../core/config.js";
import { detectLegacy } from "../core/legacy.js";
import { logger } from "../core/logger.js";
import { createTranslator, type Translator } from "../core/translator.js";
import { detectPlatform } from "../platform/index.js";
import {
  defaultShortcutPath,
  detectClaudeExecutable,
  queryAumidStatus,
} from "../platform/windows/aumid.js";
import { runPowerShell } from "../platform/windows/powershell.js";

type CheckLevel = "ok" | "warn" | "fail";

interface CheckResult {
  label: string;
  level: CheckLevel;
  detail?: string;
  hint?: string;
}

export interface RunDoctorOptions {
  json?: boolean;
}

export async function runDoctor(options: RunDoctorOptions = {}): Promise<void> {
  const config = (() => {
    try {
      return loadConfig();
    } catch {
      return null;
    }
  })();
  const translator = createTranslator(config?.language ?? "auto");

  const checks: CheckResult[] = [];

  checks.push(checkNode(translator));
  checks.push(checkPlatform(translator));

  const platform = detectPlatform();
  if (platform === "windows") {
    checks.push(await checkPowerShell(translator));
    checks.push(checkClaudeExecutable(translator));
    checks.push(await checkAumid(translator));
  } else {
    checks.push({
      label: translator.t("cli.doctor.check.platform"),
      level: "warn",
      detail: translator.t("cli.doctor.check.platform.scaffolded", { platform }),
      hint: translator.t("cli.doctor.check.platform.star_hint"),
    });
  }

  checks.push(checkPluginOptions(translator));
  checks.push(checkConfigFile(translator));
  checks.push(checkLegacy(translator));

  if (options.json) {
    console.log(JSON.stringify({ platform, checks }, null, 2));
    return;
  }

  printReport(translator, platform, checks);

  const hasFail = checks.some((c) => c.level === "fail");
  process.exitCode = hasFail ? 1 : 0;
}

function checkNode(translator: Translator): CheckResult {
  const version = process.versions.node;
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);
  if (major >= 20) {
    return {
      label: translator.t("cli.doctor.check.node"),
      level: "ok",
      detail: `v${version}`,
    };
  }
  return {
    label: translator.t("cli.doctor.check.node"),
    level: "fail",
    detail: `v${version}`,
    hint: translator.t("cli.doctor.check.node.hint"),
  };
}

function checkPlatform(translator: Translator): CheckResult {
  const platform = detectPlatform();
  if (platform === "windows") {
    return {
      label: translator.t("cli.doctor.check.platform"),
      level: "ok",
      detail: "Windows",
    };
  }
  if (platform === "unknown") {
    return {
      label: translator.t("cli.doctor.check.platform"),
      level: "fail",
      detail: process.platform,
      hint: translator.t("cli.doctor.check.platform.unsupported_hint"),
    };
  }
  return {
    label: translator.t("cli.doctor.check.platform"),
    level: "warn",
    detail: platform,
    hint: translator.t("cli.doctor.check.platform.future_hint"),
  };
}

async function checkPowerShell(translator: Translator): Promise<CheckResult> {
  const script = "$PSVersionTable.PSVersion.ToString()";
  const result = await runPowerShell({ script, timeoutMs: 5000 });
  if (result.ok && result.stdout) {
    const firstLine = result.stdout.split("\n")[0] ?? result.stdout;
    return {
      label: translator.t("cli.doctor.check.powershell"),
      level: "ok",
      detail: firstLine,
    };
  }
  return {
    label: translator.t("cli.doctor.check.powershell"),
    level: "fail",
    detail: result.stderr || translator.t("cli.doctor.check.powershell.unreachable"),
    hint: translator.t("cli.doctor.check.powershell.hint"),
  };
}

function checkClaudeExecutable(translator: Translator): CheckResult {
  const path = detectClaudeExecutable();
  if (path) {
    return {
      label: translator.t("cli.doctor.check.claude"),
      level: "ok",
      detail: path,
    };
  }
  return {
    label: translator.t("cli.doctor.check.claude"),
    level: "warn",
    detail: translator.t("cli.doctor.check.claude.notfound"),
    hint: translator.t("cli.doctor.check.claude.hint", { command: "`ringly init --force`" }),
  };
}

async function checkAumid(translator: Translator): Promise<CheckResult> {
  const shortcut = defaultShortcutPath();
  if (!existsSync(shortcut)) {
    return {
      label: translator.t("cli.doctor.check.aumid"),
      level: "fail",
      detail: translator.t("cli.doctor.check.aumid.notreg"),
      hint: translator.t("cli.doctor.check.aumid.notreg_hint", { command: "`ringly init`" }),
    };
  }
  const status = await queryAumidStatus(shortcut);
  if (status.aumid === "Claude.Code.CLI") {
    return {
      label: translator.t("cli.doctor.check.aumid"),
      level: "ok",
      detail: status.aumid,
    };
  }
  if (status.aumid) {
    return {
      label: translator.t("cli.doctor.check.aumid"),
      level: "warn",
      detail: status.aumid,
      hint: translator.t("cli.doctor.check.aumid.mismatch_hint", {
        command: "`ringly init --force`",
      }),
    };
  }
  return {
    label: translator.t("cli.doctor.check.aumid"),
    level: "fail",
    detail: status.error || translator.t("cli.doctor.check.aumid.missing"),
    hint: translator.t("cli.doctor.check.aumid.repair_hint", { command: "`ringly init --force`" }),
  };
}

/**
 * Reporta a presença do sistema PowerShell antigo (`notify-toast.ps1` em
 * `~/.claude/hooks/`). Quando ele coexiste com o Ringly, o usuário recebe
 * **duas** notificações pro mesmo evento. Aqui informamos o estado e
 * sugerimos o comando de migração.
 */
function checkLegacy(translator: Translator): CheckResult {
  const detection = detectLegacy();
  const hooksCount = detection.hooksFound.length;
  const scriptsCount = detection.scriptsFound.length;

  if (hooksCount === 0 && scriptsCount === 0) {
    return {
      label: translator.t("cli.doctor.check.legacy"),
      level: "ok",
      detail: translator.t("cli.doctor.check.legacy.none"),
    };
  }

  const parts: string[] = [];
  if (hooksCount > 0) parts.push(`${hooksCount} hook(s): ${detection.hooksFound.join(", ")}`);
  if (scriptsCount > 0) parts.push(`${scriptsCount} script(s)`);

  return {
    label: translator.t("cli.doctor.check.legacy"),
    level: "warn",
    detail: parts.join(" + "),
    hint: translator.t("cli.doctor.check.legacy.hint", {
      command: "`ringly uninstall --legacy`",
    }),
  };
}

function checkPluginOptions(translator: Translator): CheckResult {
  const file = getClaudeSettingsFile();
  if (!existsSync(file)) {
    return {
      label: translator.t("cli.doctor.check.plugin"),
      level: "warn",
      detail: translator.t("cli.doctor.check.plugin.notfound", { file }),
      hint: translator.t("cli.doctor.check.plugin.notfound_hint", {
        plugin: "`/plugin`",
        command: "`ringly config`",
      }),
    };
  }
  const options = readRinglyPluginOptions();
  const definedKeys = Object.keys(options);
  if (definedKeys.length === 0) {
    return {
      label: translator.t("cli.doctor.check.plugin"),
      level: "warn",
      detail: translator.t("cli.doctor.check.plugin.nooptions"),
      hint: translator.t("cli.doctor.check.plugin.nooptions_hint", {
        plugin: "`/plugin`",
        command: "`ringly config`",
      }),
    };
  }
  const language = options.language ?? "(default)";
  return {
    label: translator.t("cli.doctor.check.plugin"),
    level: "ok",
    detail: translator.t("cli.doctor.check.plugin.ok", {
      count: definedKeys.length,
      language,
    }),
  };
}

function checkConfigFile(translator: Translator): CheckResult {
  const file = getConfigFile();
  const exists = existsSync(file);
  if (!exists) {
    return {
      label: translator.t("cli.doctor.check.config"),
      level: "ok",
      detail: translator.t("cli.doctor.check.config.absent"),
    };
  }
  try {
    const config = loadConfig();
    return {
      label: translator.t("cli.doctor.check.config"),
      level: "ok",
      detail: translator.t("cli.doctor.check.config.ok", { file, language: config.language }),
    };
  } catch (err) {
    return {
      label: translator.t("cli.doctor.check.config"),
      level: "fail",
      detail: (err as Error).message,
      hint: translator.t("cli.doctor.check.config.broken_hint", { command: "`ringly init`" }),
    };
  }
}

function printReport(translator: Translator, platform: string, checks: CheckResult[]): void {
  const okCount = checks.filter((c) => c.level === "ok").length;
  const warnCount = checks.filter((c) => c.level === "warn").length;
  const failCount = checks.filter((c) => c.level === "fail").length;
  const total = checks.length;

  const headerLine = `◉ ${translator.t("cli.doctor.header")}  ·  ${platform}  ·  ${okCount}/${total} OK`;
  const border = "─".repeat(headerLine.length + 2);

  console.log("");
  console.log(chalk.cyan(`╭${border}╮`));
  console.log(chalk.cyan("│ ") + chalk.bold.cyan(headerLine) + chalk.cyan(" │"));
  console.log(chalk.cyan(`╰${border}╯`));
  console.log("");

  for (const c of checks) {
    const icon =
      c.level === "ok" ? chalk.green("✓") : c.level === "warn" ? chalk.yellow("⚠") : chalk.red("✗");
    const labelColor =
      c.level === "ok" ? chalk.bold : c.level === "warn" ? chalk.bold.yellow : chalk.bold.red;
    const label = labelColor(c.label);
    const detail = c.detail ? chalk.dim(` — ${c.detail}`) : "";
    console.log(`  ${icon}  ${label}${detail}`);
    if (c.hint && c.level !== "ok") {
      console.log(`     ${chalk.dim("↳ ")}${chalk.dim(c.hint)}`);
    }
  }

  console.log("");
  const summary: string[] = [];
  if (okCount > 0) summary.push(chalk.green(translator.t("cli.doctor.passed", { count: okCount })));
  if (warnCount > 0) {
    summary.push(
      chalk.yellow(
        translator.t(warnCount > 1 ? "cli.doctor.warnings" : "cli.doctor.warning", {
          count: warnCount,
        }),
      ),
    );
  }
  if (failCount > 0) {
    summary.push(chalk.red(translator.t("cli.doctor.failed", { count: failCount })));
  }
  console.log(
    `  ${chalk.dim(translator.t("cli.doctor.summary"))} ${summary.join(chalk.dim(" · "))}`,
  );
  console.log(
    `  ${chalk.dim(translator.t("cli.doctor.log_file"))} ${chalk.dim(logger.getLogFile())}`,
  );
  console.log("");
}
