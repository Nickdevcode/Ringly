/**
 * `ringly update` — checks npm for a newer release of the `ringly`
 * package and optionally runs `npm install -g ringly@latest`.
 *
 * Two modes:
 *  - `--check`: prints a JSON snapshot suitable for the `/ringly-update`
 *    slash command (which parses it via Bash and decides what to do).
 *  - interactive: pretty-prints the result, asks for confirmation, runs
 *    npm install with a long timeout, and prints the post-install
 *    `/reload-plugins` instruction.
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import chalk from "chalk";
import { DEFAULT_CONFIG, loadConfig } from "../core/config.js";
import { logger } from "../core/logger.js";
import { readOwnVersion } from "../core/ownVersion.js";
import { createTranslator } from "../core/translator.js";
import { checkForUpdate, type UpdateCheckResult } from "../core/updateCheck.js";

export interface RunUpdateOptions {
  check: boolean;
  yes: boolean;
}

interface CheckSnapshot {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  reachable: boolean;
}

const PACKAGE_NAME = "ringly";
const NPM_INSTALL_TIMEOUT_MS = 120_000;

export async function runUpdate(options: RunUpdateOptions): Promise<void> {
  const config = (() => {
    try {
      return loadConfig();
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  })();
  const translator = createTranslator(config.language);

  const current = readOwnVersion(import.meta.url);
  const result = await checkForUpdate({
    packageName: PACKAGE_NAME,
    currentVersion: current,
  });

  if (options.check) {
    emitJsonSnapshot(current, result);
    return;
  }

  printHeader(translator);

  if (!result) {
    console.log(`  ${chalk.yellow("⚠")}  ${translator.t("cli.update.check_failed")}`);
    console.log("");
    process.exitCode = 1;
    return;
  }

  console.log(
    `  ${chalk.bold(translator.t("cli.update.current_version"))}  ${chalk.cyan(result.currentVersion)}`,
  );
  console.log(
    `  ${chalk.bold(translator.t("cli.update.latest_version"))}   ${chalk.cyan(result.latestVersion)}`,
  );
  console.log("");

  if (!result.hasUpdate) {
    console.log(
      `  ${chalk.green("✓")}  ${translator.t("cli.update.already_latest", { version: result.currentVersion })}`,
    );
    console.log("");
    return;
  }

  console.log(
    `  ${chalk.yellow("◉")}  ${translator.t("cli.update.available", { current: result.currentVersion, latest: result.latestVersion })}`,
  );
  console.log("");

  const confirmed = options.yes ? true : await askConfirmation(translator, result.latestVersion);
  if (!confirmed) {
    console.log(`  ${chalk.dim(translator.t("cli.update.aborted"))}`);
    console.log("");
    return;
  }

  console.log(
    `  ${chalk.dim(translator.t("cli.update.installing", { version: result.latestVersion }))}`,
  );
  console.log("");

  const installResult = await runNpmInstallLatest();

  if (installResult.ok) {
    console.log(`  ${chalk.green("✓")}  ${translator.t("cli.update.install_succeeded")}`);
    console.log("");
    return;
  }

  const isWindowsLock =
    process.platform === "win32" && /EBUSY|EPERM|access is denied/i.test(installResult.stderr);
  const key = isWindowsLock
    ? "cli.update.install_failed_windows_locked"
    : "cli.update.install_failed";

  console.log(`  ${chalk.red("✗")}  ${translator.t(key)}`);
  console.log(
    `  ${chalk.dim(translator.t("cli.update.run_manually", { command: "npm install -g ringly@latest" }))}`,
  );
  if (installResult.stderr) {
    console.log("");
    console.log(chalk.dim(installResult.stderr.trim()));
  }
  console.log("");
  process.exitCode = 1;
}

function emitJsonSnapshot(current: string, result: UpdateCheckResult | null): void {
  const snapshot: CheckSnapshot = result
    ? {
        current: result.currentVersion,
        latest: result.latestVersion,
        hasUpdate: result.hasUpdate,
        reachable: true,
      }
    : { current, latest: null, hasUpdate: false, reachable: false };
  console.log(JSON.stringify(snapshot));
}

function printHeader(translator: ReturnType<typeof createTranslator>): void {
  const header = `◉ ${translator.t("cli.update.header")}`;
  const border = "─".repeat(header.length + 2);
  console.log("");
  console.log(chalk.cyan(`╭${border}╮`));
  console.log(chalk.cyan("│ ") + chalk.bold.cyan(header) + chalk.cyan(" │"));
  console.log(chalk.cyan(`╰${border}╯`));
  console.log("");
}

async function askConfirmation(
  translator: ReturnType<typeof createTranslator>,
  latestVersion: string,
): Promise<boolean> {
  const promptKey =
    translator.language === "pt-BR" ? "cli.update.confirm_prompt" : "cli.update.confirm_prompt_en";
  const prompt = translator.t(promptKey, { latest: latestVersion });

  if (!process.stdin.isTTY) {
    console.log(`  ${chalk.dim(prompt)} ${chalk.dim("(no TTY → assuming No)")}`);
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`  ${prompt} `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(
        normalized === "y" || normalized === "s" || normalized === "yes" || normalized === "sim",
      );
    });
  });
}

interface InstallResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

async function runNpmInstallLatest(): Promise<InstallResult> {
  return await new Promise<InstallResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(npmCommand, ["install", "-g", "ringly@latest"], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }, NPM_INSTALL_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      logger.error("npm install spawn error", { message: err.message });
      resolve({ ok: false, stdout, stderr: stderr || err.message, code: null, timedOut });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code,
        timedOut,
      });
    });
  });
}
