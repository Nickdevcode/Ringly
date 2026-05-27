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
import { type SpawnOptions, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import chalk from "chalk";
import {
  type ChangelogGroup,
  extractSection,
  findEntry,
  parseChangelog,
  readPackagedChangelog,
} from "../core/changelog.js";
import { DEFAULT_CONFIG, loadConfig } from "../core/config.js";
import { logger } from "../core/logger.js";
import { readOwnVersion } from "../core/ownVersion.js";
import { createTranslator, type Translator } from "../core/translator.js";
import type { SupportedLanguage } from "../core/types.js";
import { checkForUpdate, type UpdateCheckResult } from "../core/updateCheck.js";

export interface RunUpdateOptions {
  check: boolean;
  yes: boolean;
}

export interface SnapshotNotesGroup {
  /** Localized title ("Novidades", "What's new", …). */
  title: string;
  /** Plain-text bullets, ready for the slash command to rewrite. */
  items: string[];
}

export interface SnapshotNotes {
  version: string;
  heading: string;
  groups: SnapshotNotesGroup[];
}

interface CheckSnapshot {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  reachable: boolean;
  /**
   * Language the slash command should answer in. Always a concrete locale —
   * "auto" is already resolved here via `Translator.language`. This is the
   * single source of truth the `/ringly-update` `.md` consumes to decide
   * the language for every user-facing line it writes itself.
   */
  language: SupportedLanguage;
  /**
   * Localized release notes for `latest`, when both `hasUpdate` is true and
   * the packaged CHANGELOG.md has an entry for that version. `null` in every
   * other case (no update, no CHANGELOG, parse failure, version not listed).
   */
  notes: SnapshotNotes | null;
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

  const notes = result?.hasUpdate ? buildNotesFor(result.latestVersion, translator) : null;

  if (options.check) {
    emitJsonSnapshot(current, result, translator, notes);
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

  if (notes) {
    printNotes(notes);
  }

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

function emitJsonSnapshot(
  current: string,
  result: UpdateCheckResult | null,
  translator: Translator,
  notes: SnapshotNotes | null,
): void {
  const snapshot: CheckSnapshot = result
    ? {
        current: result.currentVersion,
        latest: result.latestVersion,
        hasUpdate: result.hasUpdate,
        reachable: true,
        language: translator.language,
        notes,
      }
    : {
        current,
        latest: null,
        hasUpdate: false,
        reachable: false,
        language: translator.language,
        notes: null,
      };
  console.log(JSON.stringify(snapshot));
}

/**
 * Maps a CHANGELOG group heading (in pt-BR or en-US, as the author wrote it)
 * to one of the canonical translator keys. Anything that doesn't fit the
 * five well-known buckets falls through to `notes_group.other`, which keeps
 * the parser tolerant of new section names without breaking the snapshot.
 */
function localizedGroupTitle(heading: string, translator: Translator): string {
  const normalized = heading.toLowerCase().trim();

  const ADDED = ["adicionado", "added", "novo", "new"];
  const CHANGED = ["mudado", "changed"];
  const FIXED = ["corrigido", "fixed", "fixes"];
  const BREAKING = [
    "mudança incompatível",
    "mudanca incompativel",
    "breaking change",
    "breaking changes",
  ];
  const REMOVED = ["removido", "removed", "deprecated", "depreciado"];

  if (ADDED.includes(normalized)) return translator.t("cli.update.notes_group.added");
  if (CHANGED.includes(normalized)) return translator.t("cli.update.notes_group.changed");
  if (FIXED.includes(normalized)) return translator.t("cli.update.notes_group.fixed");
  if (BREAKING.includes(normalized)) return translator.t("cli.update.notes_group.breaking");
  if (REMOVED.includes(normalized)) return translator.t("cli.update.notes_group.removed");
  return translator.t("cli.update.notes_group.other");
}

/**
 * Builds the localized SnapshotNotes for a given version, by reading the
 * packaged CHANGELOG and selecting the section for `translator.language`.
 * Returns `null` when the CHANGELOG is missing, unparseable, or doesn't
 * have an entry for that version.
 */
export function buildNotesFor(version: string, translator: Translator): SnapshotNotes | null {
  const raw = readPackagedChangelog(import.meta.url);
  if (!raw) return null;
  const entries = parseChangelog(raw);
  const entry = findEntry(entries, version);
  if (!entry) return null;

  const groups: ChangelogGroup[] = extractSection(entry, translator.language);
  if (groups.length === 0) return null;

  return {
    version,
    heading: translator.t("cli.update.notes_heading", { version }),
    groups: groups.map((g) => ({
      title: localizedGroupTitle(g.heading, translator),
      items: g.bullets,
    })),
  };
}

function printNotes(notes: SnapshotNotes): void {
  console.log(`  ${chalk.bold(notes.heading)}`);
  console.log("");
  for (const group of notes.groups) {
    if (group.items.length === 0) continue;
    console.log(`  ${chalk.bold.cyan(group.title)}`);
    for (const item of group.items) {
      console.log(`    ${chalk.dim("•")} ${item}`);
    }
    console.log("");
  }
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

export interface NpmInstallSpec {
  command: string;
  args: readonly string[];
  options: SpawnOptions;
}

/**
 * Resolve how `npm install -g ringly@latest` should be spawned for the given
 * platform.
 *
 * On Windows, Node 20.12+/21.7+/22+ refuses to spawn `.bat`/`.cmd` shims
 * directly (CVE-2024-27980): the call throws `EINVAL` unless `shell: true` is
 * set so that `cmd.exe` resolves the shim. The arguments here are hardcoded
 * literals (no user input), so enabling the shell is safe — there is no
 * surface for command injection.
 *
 * On macOS/Linux, `npm` is a real executable on PATH and runs without a
 * shell, matching prior behavior.
 */
export function buildNpmInstallSpec(platform: NodeJS.Platform = process.platform): NpmInstallSpec {
  const isWindows = platform === "win32";
  return {
    command: "npm",
    args: ["install", "-g", "ringly@latest"],
    options: {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: isWindows,
    },
  };
}

async function runNpmInstallLatest(): Promise<InstallResult> {
  return await new Promise<InstallResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const spec = buildNpmInstallSpec();
    const child = spawn(spec.command, [...spec.args], spec.options);

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }, NPM_INSTALL_TIMEOUT_MS);

    // stdio is hardcoded to ["ignore", "pipe", "pipe"] in buildNpmInstallSpec,
    // so stdout/stderr exist at runtime. Optional chaining keeps the call
    // safe even if TS widens the type when SpawnOptions is passed in.
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
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
