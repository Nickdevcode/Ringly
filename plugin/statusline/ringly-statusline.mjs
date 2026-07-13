#!/usr/bin/env node
// Ringly status line renderer.
//
// A standalone Node ESM script (like plugin/hooks/dispatch.mjs) wired into
// `~/.claude/settings.json`'s `statusLine.command`. Claude Code runs it on
// every render, pipes a JSON session snapshot on stdin, and displays whatever
// this prints. It MUST be fast and MUST NEVER throw — a thrown error blanks the
// line — so every segment is individually guarded and the whole thing is
// wrapped in a top-level try/catch with a stdin timeout.
//
// It imports NOTHING from `dist/` (keeping it independent of the CLI bundle)
// and reads its own configuration straight from the same settings.json under
// `pluginConfigs.ringly.options.statusline_*`.
//
// The visual output is a faithful port of the user's original hybrid statusline
// (model · task · dir · context meter · git · lines · rate limits) with the
// GSD-specific bits removed. Segments are individually toggleable.

import { spawnSync } from "node:child_process";
import { existsSync, openSync, readSync, closeSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

// --- Config -----------------------------------------------------------------

// Mirror of DEFAULT_CONFIG.statusline.segments in src/core/config.ts. Kept in
// sync by a drift test (test/ringlyStatusline.test.ts). Same accepted
// duplication as dispatch.mjs's DEFAULT_OPTIONS.
const DEFAULT_SEGMENTS = {
  model: true,
  task: true,
  dirname: true,
  context: true,
  lastCommand: false,
  git: true,
  lines: true,
  rateLimits: true,
};

const SETTINGS_FILE = join(homedir(), ".claude", "settings.json");

/**
 * Reads Ringly's options from settings.json. Never throws — returns `{}` on any
 * failure so the renderer falls back to defaults. Does NOT consult the
 * `CLAUDE_PLUGIN_OPTION_*` env vars: the statusLine process may not carry them.
 */
function readRinglyOptions() {
  try {
    if (!existsSync(SETTINGS_FILE)) return {};
    const raw = readFileSync(SETTINGS_FILE, { encoding: "utf8" });
    if (raw.trim().length === 0) return {};
    const parsed = JSON.parse(raw);
    return parsed?.pluginConfigs?.ringly?.options ?? {};
  } catch {
    return {};
  }
}

/** Resolves the effective segment switches from options, defaulting per segment. */
function resolveSegments(options) {
  const out = { ...DEFAULT_SEGMENTS };
  for (const key of Object.keys(DEFAULT_SEGMENTS)) {
    const value = options[`statusline_segment_${key}`];
    if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

// --- Git helpers (ported verbatim from the hybrid statusline) ---------------

function readGitState(dir) {
  try {
    const opts = { cwd: dir, timeout: 800, encoding: "utf8", windowsHide: true };

    const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], opts);
    if (inside.status !== 0 || !inside.stdout.trim().startsWith("true")) return null;

    const branchRes = spawnSync("git", ["symbolic-ref", "--short", "-q", "HEAD"], opts);
    let branch = branchRes.stdout.trim();
    if (!branch) {
      const shortSha = spawnSync("git", ["rev-parse", "--short", "HEAD"], opts);
      branch = shortSha.stdout.trim() ? `@${shortSha.stdout.trim()}` : "?";
    }

    let ahead = 0;
    let behind = 0;
    const upstream = spawnSync("git", ["rev-list", "--left-right", "--count", "@{u}...HEAD"], opts);
    if (upstream.status === 0) {
      const parts = upstream.stdout.trim().split(/\s+/);
      if (parts.length === 2) {
        behind = Number.parseInt(parts[0], 10) || 0;
        ahead = Number.parseInt(parts[1], 10) || 0;
      }
    }

    const statusRes = spawnSync("git", ["status", "--porcelain"], opts);
    const dirty = statusRes.status === 0 ? statusRes.stdout.split("\n").filter(Boolean).length : 0;

    return { branch, ahead, behind, dirty };
  } catch {
    return null;
  }
}

// --- Rate limit reset formatter (ported verbatim) ---------------------------

function formatReset(iso) {
  if (!iso) return "";
  let t;
  if (typeof iso === "number") {
    t = iso < 1e12 ? iso * 1000 : iso;
  } else {
    t = Date.parse(iso);
  }
  if (!Number.isFinite(t)) return "";
  const deltaMin = Math.floor((t - Date.now()) / 60000);
  if (deltaMin <= 0) return "";
  if (deltaMin < 60) return `${deltaMin}m`;
  const h = Math.floor(deltaMin / 60);
  const m = deltaMin % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

// --- Last-slash-command reader (ported verbatim) ----------------------------

/**
 * Extracts the most recently invoked slash command from a Claude Code JSONL
 * transcript. Returns the command name (no leading slash) or null. Reads only
 * the tail (256 KiB) to stay cheap per render.
 */
function readLastSlashCommand(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== "string") return null;
  let content;
  try {
    if (!existsSync(transcriptPath)) return null;
    const stat = statSync(transcriptPath);
    const MAX = 256 * 1024;
    const start = Math.max(0, stat.size - MAX);
    const fd = openSync(transcriptPath, "r");
    try {
      const buf = Buffer.alloc(stat.size - start);
      readSync(fd, buf, 0, buf.length, start);
      content = buf.toString("utf8");
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
  const tagClose = "</command-name>";
  const idx = content.lastIndexOf(tagClose);
  if (idx < 0) return null;
  const openTag = "<command-name>";
  const openIdx = content.lastIndexOf(openTag, idx);
  if (openIdx < 0) return null;
  let name = content.slice(openIdx + openTag.length, idx).trim();
  if (name.startsWith("/")) name = name.slice(1);
  if (!name || /[\s\\"<>]/.test(name) || name.length > 80) return null;
  return name;
}

// --- Current task reader (ported; GSD-state fallback removed) ----------------

/**
 * The current in-progress todo's activeForm, from the Claude Code todos dir
 * (NOT from GSD). Returns "" when there is no in-progress task.
 */
function readCurrentTask(session, homeDir) {
  if (!session) return "";
  const claudeDir = process.env["CLAUDE_CONFIG_DIR"] || join(homeDir, ".claude");
  const todosDir = join(claudeDir, "todos");
  try {
    if (!existsSync(todosDir)) return "";
    const files = readdirSync(todosDir)
      .filter((f) => f.startsWith(session) && f.includes("-agent-") && f.endsWith(".json"))
      .map((f) => ({ name: f, mtime: statSync(join(todosDir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) return "";
    const todos = JSON.parse(readFileSync(join(todosDir, files[0].name), "utf8"));
    const inProgress = todos.find((t) => t.status === "in_progress");
    return inProgress ? inProgress.activeForm || "" : "";
  } catch {
    return "";
  }
}

// --- Context meter (ported; bridge-file write dropped, total_tokens fixed) ---

/**
 * Renders the context-usage meter segment (e.g. " ██░░░░░░░░ 18%"), colored by
 * threshold. Returns "" when the percentage is unavailable.
 *
 * Matches the original hybrid behavior: it derives "used" from
 * `remaining_percentage` minus the auto-compact buffer (16.5% by default, or
 * `CLAUDE_CODE_AUTO_COMPACT_WINDOW` / total when that env var is set). The
 * official session JSON also exposes a pre-calculated `used_percentage`; a
 * hidden `statusline_context_precalc` option (not surfaced in the TUI) switches
 * to it for anyone who prefers the simpler number.
 */
function renderContextMeter(data, options) {
  const cw = data.context_window || {};
  if (options?.statusline_context_precalc === true) {
    const used = cw.used_percentage;
    if (used == null) return "";
    return formatContextMeter(Math.max(0, Math.min(100, Math.round(used))));
  }

  const remaining = cw.remaining_percentage;
  if (remaining == null) return "";

  // context_window_size is the current field (the old `total_tokens` is gone).
  const totalCtx = cw.context_window_size || 1_000_000;
  const acw = Number.parseInt(process.env["CLAUDE_CODE_AUTO_COMPACT_WINDOW"] || "0", 10);
  const AUTO_COMPACT_BUFFER_PCT = acw > 0 ? Math.min(100, (acw / totalCtx) * 100) : 16.5;

  const usableRemaining = Math.max(
    0,
    ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100,
  );
  const used = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));
  return formatContextMeter(used);
}

function formatContextMeter(used) {
  const filled = Math.floor(used / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  if (used < 50) return ` \x1b[32m${bar} ${used}%\x1b[0m`;
  if (used < 65) return ` \x1b[33m${bar} ${used}%\x1b[0m`;
  if (used < 80) return ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
  return ` \x1b[5;31m💀 ${bar} ${used}%\x1b[0m`;
}

// --- Tail segments: git / lines / rate limits (ported verbatim) -------------

function renderGit(git) {
  if (!git) return "";
  const segs = [`\x1b[36m${git.branch}\x1b[0m`];
  if (git.ahead) segs.push(`\x1b[32m↑${git.ahead}\x1b[0m`);
  if (git.behind) segs.push(`\x1b[31m↓${git.behind}\x1b[0m`);
  if (git.dirty) segs.push(`\x1b[33m●${git.dirty}\x1b[0m`);
  return ` │ ${segs.join(" ")}`;
}

function renderLines(data) {
  const added = data.cost?.total_lines_added;
  const removed = data.cost?.total_lines_removed;
  if ((added == null || added <= 0) && (removed == null || removed <= 0)) return "";
  const a = added || 0;
  const r = removed || 0;
  return ` │ \x1b[32m+${a}\x1b[0m \x1b[31m-${r}\x1b[0m`;
}

function renderRateLimits(data) {
  const fiveHourPct = data.rate_limits?.five_hour?.used_percentage;
  const sevenDayPct = data.rate_limits?.seven_day?.used_percentage;
  if (fiveHourPct == null && sevenDayPct == null) return "";

  const limitsParts = [];
  const makeUsageBar = (pct) => {
    const filled = Math.floor(pct / 20);
    return "█".repeat(filled) + "░".repeat(5 - filled);
  };
  const usageColor = (pct) => (pct < 50 ? "\x1b[32m" : pct < 75 ? "\x1b[33m" : "\x1b[31m");

  if (fiveHourPct != null) {
    const pct = Math.round(fiveHourPct);
    const reset = formatReset(data.rate_limits?.five_hour?.resets_at);
    const resetStr = reset ? ` \x1b[2m(${reset})\x1b[0m` : "";
    limitsParts.push(`\x1b[2m5h\x1b[0m ${usageColor(pct)}${makeUsageBar(pct)} ${pct}%\x1b[0m${resetStr}`);
  }
  if (sevenDayPct != null) {
    const pct = Math.round(sevenDayPct);
    const reset = formatReset(data.rate_limits?.seven_day?.resets_at);
    const resetStr = reset ? ` \x1b[2m(${reset})\x1b[0m` : "";
    limitsParts.push(`\x1b[2m7d\x1b[0m ${usageColor(pct)}${makeUsageBar(pct)} ${pct}%\x1b[0m${resetStr}`);
  }

  return ` │ ${limitsParts.join(" \x1b[2m·\x1b[0m ")}`;
}

// --- Composer ---------------------------------------------------------------

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

/**
 * Joins the "core" segments (everything before the git/lines/rate-limits tail)
 * with ` │ `, dropping absent pieces so no dangling separators appear. The
 * context meter glues directly onto the model (front) or the directory (end)
 * exactly like the original template; the last-command suffix is appended last.
 *
 * For the all-default-on inputs this reproduces the original hybrid layout
 * byte-for-byte (locked by a test).
 */
function composeCore({ model, ctx, middle, dirname, lastCmdSuffix, position }) {
  const pos = position === "front" ? "front" : "end";

  if (pos === "front") {
    // ctx sits right after the model so it stays visible in narrow terminals.
    const first = model != null ? `${model}${ctx}` : ctx || null;
    const pieces = [first, middle, dirname].filter((p) => p != null && p !== "");
    return `${pieces.join(" │ ")}${lastCmdSuffix}`;
  }

  // "end": ctx trails the directory.
  const last = dirname != null ? `${dirname}${ctx}` : ctx || null;
  const pieces = [model, middle, last].filter((p) => p != null && p !== "");
  return `${pieces.join(" │ ")}${lastCmdSuffix}`;
}

/**
 * Renders the full status line from an already-parsed session object plus the
 * Ringly options. Exported for tests (no stdin needed).
 */
export function renderStatusline(data, options) {
  const opts = options || {};
  const seg = resolveSegments(opts);

  // Master switch: belt-and-suspenders. Normally DISABLE removes the statusLine
  // key entirely, so this script wouldn't run at all.
  if (opts.statusline_enabled === false) return "";

  const dir = data.workspace?.current_dir || process.cwd();
  const session = data.session_id || "";
  const home = homedir();

  const model = seg.model ? dim(data.model?.display_name || "Claude") : null;

  const taskText = seg.task ? readCurrentTask(session, home) : "";
  const middle = taskText ? bold(taskText) : null;

  const ctx = seg.context ? renderContextMeter(data, opts) : "";

  const dirSeg = seg.dirname ? dim(basename(dir)) : null;

  let lastCmdSuffix = "";
  if (seg.lastCommand) {
    const lastCmd = readLastSlashCommand(data.transcript_path);
    if (lastCmd) lastCmdSuffix = ` │ ${dim(`last: /${lastCmd}`)}`;
  }

  const core = composeCore({
    model,
    ctx,
    middle,
    dirname: dirSeg,
    lastCmdSuffix,
    position: opts.statusline_position,
  });

  const gitStr = seg.git ? renderGit(readGitState(dir)) : "";
  const linesStr = seg.lines ? renderLines(data) : "";
  const rateLimits = seg.rateLimits ? renderRateLimits(data) : "";

  return `${core}${gitStr}${linesStr}${rateLimits}`;
}

// --- stdin driver -----------------------------------------------------------

function run() {
  let input = "";
  // If stdin never closes (pipe issues on Windows/Git Bash), exit silently.
  const stdinTimeout = setTimeout(() => process.exit(0), 3000);
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });
  process.stdin.on("end", () => {
    clearTimeout(stdinTimeout);
    try {
      const data = JSON.parse(input.replace(/^﻿/, ""));
      const options = readRinglyOptions();
      process.stdout.write(renderStatusline(data, options));
    } catch {
      // Silent fail — never break the status line on parse/render errors.
    }
  });
}

// Export pure helpers for unit tests; harmless when run as a script.
export {
  readGitState,
  formatReset,
  readLastSlashCommand,
  renderContextMeter,
  renderGit,
  renderLines,
  renderRateLimits,
  resolveSegments,
  composeCore,
  DEFAULT_SEGMENTS,
};

// Only drive stdin when executed directly (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("ringly-statusline.mjs")) {
  run();
}
