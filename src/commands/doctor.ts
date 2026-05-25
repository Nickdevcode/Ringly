import { existsSync } from "node:fs";
import chalk from "chalk";
import { getConfigFile, loadConfig } from "../core/config.js";
import { detectLegacy } from "../core/legacy.js";
import { logger } from "../core/logger.js";
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
  const checks: CheckResult[] = [];

  checks.push(checkNode());
  checks.push(checkPlatform());

  const platform = detectPlatform();
  if (platform === "windows") {
    checks.push(await checkPowerShell());
    checks.push(checkClaudeExecutable());
    checks.push(await checkAumid());
  } else {
    checks.push({
      label: "Native toast back-end",
      level: "warn",
      detail: `${platform} support is scaffolded but not implemented yet`,
      hint: "Star the GitHub repo to be notified when macOS / Linux land.",
    });
  }

  checks.push(checkConfigFile());
  checks.push(checkLegacy());

  if (options.json) {
    console.log(JSON.stringify({ platform, checks }, null, 2));
    return;
  }

  printReport(platform, checks);

  const hasFail = checks.some((c) => c.level === "fail");
  process.exitCode = hasFail ? 1 : 0;
}

function checkNode(): CheckResult {
  const version = process.versions.node;
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);
  if (major >= 20) {
    return { label: "Node.js version", level: "ok", detail: `v${version}` };
  }
  return {
    label: "Node.js version",
    level: "fail",
    detail: `v${version}`,
    hint: "Node 20 or newer is required. Upgrade from nodejs.org or via nvm/volta.",
  };
}

function checkPlatform(): CheckResult {
  const platform = detectPlatform();
  if (platform === "windows") {
    return { label: "Operating system", level: "ok", detail: "Windows" };
  }
  if (platform === "unknown") {
    return {
      label: "Operating system",
      level: "fail",
      detail: process.platform,
      hint: "Ringly currently supports Windows only.",
    };
  }
  return {
    label: "Operating system",
    level: "warn",
    detail: platform,
    hint: "Native toast on this platform will arrive in a future release.",
  };
}

async function checkPowerShell(): Promise<CheckResult> {
  const script = "$PSVersionTable.PSVersion.ToString()";
  const result = await runPowerShell({ script, timeoutMs: 5000 });
  if (result.ok && result.stdout) {
    const firstLine = result.stdout.split("\n")[0] ?? result.stdout;
    return { label: "PowerShell", level: "ok", detail: firstLine };
  }
  return {
    label: "PowerShell",
    level: "fail",
    detail: result.stderr || "PowerShell not reachable",
    hint: "Make sure powershell.exe is on the PATH.",
  };
}

function checkClaudeExecutable(): CheckResult {
  const path = detectClaudeExecutable();
  if (path) {
    return { label: "Claude Code executable", level: "ok", detail: path };
  }
  return {
    label: "Claude Code executable",
    level: "warn",
    detail: "not found",
    hint: "The AUMID will use a fallback target. Run `ringly init --force` after installing Claude Code.",
  };
}

async function checkAumid(): Promise<CheckResult> {
  const shortcut = defaultShortcutPath();
  if (!existsSync(shortcut)) {
    return {
      label: "Windows AUMID",
      level: "fail",
      detail: "not registered",
      hint: "Run `ringly init` to register the Start Menu shortcut and AUMID.",
    };
  }
  const status = await queryAumidStatus(shortcut);
  if (status.aumid === "Claude.Code.CLI") {
    return { label: "Windows AUMID", level: "ok", detail: status.aumid };
  }
  if (status.aumid) {
    return {
      label: "Windows AUMID",
      level: "warn",
      detail: status.aumid,
      hint: "AUMID exists but does not match the expected value. Run `ringly init --force`.",
    };
  }
  return {
    label: "Windows AUMID",
    level: "fail",
    detail: status.error || "missing property",
    hint: "Run `ringly init --force` to repair the AUMID.",
  };
}

/**
 * Reporta a presença do sistema PowerShell antigo (`notify-toast.ps1` em
 * `~/.claude/hooks/`). Quando ele coexiste com o Ringly, o usuário recebe
 * **duas** notificações pro mesmo evento. Aqui informamos o estado e
 * sugerimos o comando de migração.
 */
function checkLegacy(): CheckResult {
  const detection = detectLegacy();
  const hooksCount = detection.hooksFound.length;
  const scriptsCount = detection.scriptsFound.length;

  if (hooksCount === 0 && scriptsCount === 0) {
    return { label: "Legacy PowerShell hooks", level: "ok", detail: "none detected" };
  }

  const parts: string[] = [];
  if (hooksCount > 0) parts.push(`${hooksCount} hook(s): ${detection.hooksFound.join(", ")}`);
  if (scriptsCount > 0) parts.push(`${scriptsCount} script(s) on disk`);

  return {
    label: "Legacy PowerShell hooks",
    level: "warn",
    detail: parts.join(" + "),
    hint: "Run `ringly uninstall --legacy` to migrate (backup is created automatically).",
  };
}

function checkConfigFile(): CheckResult {
  const file = getConfigFile();
  const exists = existsSync(file);
  if (!exists) {
    return {
      label: "Local configuration",
      level: "warn",
      detail: `not found at ${file}`,
      hint: "Run `ringly init` or `ringly config` to create it.",
    };
  }
  try {
    const config = loadConfig();
    return {
      label: "Local configuration",
      level: "ok",
      detail: `${file} (language: ${config.language})`,
    };
  } catch (err) {
    return {
      label: "Local configuration",
      level: "fail",
      detail: (err as Error).message,
      hint: "Fix or delete the config file and re-run `ringly init`.",
    };
  }
}

function printReport(platform: string, checks: CheckResult[]): void {
  console.log(chalk.bold("\nRingly diagnostics"));
  console.log(chalk.dim(`Platform: ${platform}`));
  console.log("");
  for (const c of checks) {
    const icon =
      c.level === "ok" ? chalk.green("✓") : c.level === "warn" ? chalk.yellow("!") : chalk.red("x");
    const label = chalk.bold(c.label);
    const detail = c.detail ? chalk.dim(` — ${c.detail}`) : "";
    console.log(`  ${icon} ${label}${detail}`);
    if (c.hint && c.level !== "ok") {
      console.log(`    ${chalk.dim(c.hint)}`);
    }
  }
  console.log("");
  console.log(chalk.dim(`Log file: ${logger.getLogFile()}`));
}
