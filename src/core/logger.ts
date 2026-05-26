import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import envPaths from "env-paths";

type LogLevel = "debug" | "info" | "warn" | "error";

const paths = envPaths("ringly", { suffix: "" });

// Rotate at 5 MB: large enough to keep a few days of normal debug output
// for forensic value, small enough that pathological loops (a Claude Code
// session emitting hundreds of hooks/min in debug mode) cannot fill a
// user's disk before we react.
const MAX_LOG_BYTES = 5 * 1024 * 1024;

// Throttle the size check to once per minute. `appendFileSync` runs on
// the hot path of every hook; we cannot afford a `statSync` on every
// call. A 1-minute window means in the worst case the log overshoots
// `MAX_LOG_BYTES` by whatever fits in 60 s of writes, which is fine.
const ROTATION_CHECK_INTERVAL_MS = 60 * 1000;

function resolveLogDir(): string {
  const pluginData = process.env["CLAUDE_PLUGIN_DATA"];
  if (pluginData && pluginData.trim().length > 0) {
    return pluginData;
  }
  return paths.log;
}

function resolveLogFile(): string {
  return join(resolveLogDir(), "ringly.log");
}

function isDebugEnabled(): boolean {
  if (process.env["RINGLY_DEBUG"] === "1") return true;
  if (process.env["CLAUDE_PLUGIN_OPTION_DEBUG"] === "true") return true;
  return false;
}

const ensuredDirs = new Set<string>();

function ensureDirOnce(dir: string): void {
  if (ensuredDirs.has(dir)) return;
  mkdirSync(dir, { recursive: true });
  ensuredDirs.add(dir);
}

let lastRotationCheckMs = 0;

function maybeRotate(file: string): void {
  const now = Date.now();
  if (now - lastRotationCheckMs < ROTATION_CHECK_INTERVAL_MS) return;
  lastRotationCheckMs = now;
  try {
    const stat = statSync(file);
    if (stat.size <= MAX_LOG_BYTES) return;
    const rotated = `${file}.1`;
    renameSync(file, rotated);
  } catch {
    /* file may not exist or rename failed; continue */
  }
}

function writeLine(level: LogLevel, message: string, meta?: unknown): void {
  if (level === "debug" && !isDebugEnabled()) return;

  const timestamp = new Date().toISOString();
  const metaStr = meta === undefined ? "" : ` ${safeStringify(meta)}`;
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;

  try {
    const file = resolveLogFile();
    ensureDirOnce(dirname(file));
    maybeRotate(file);
    appendFileSync(file, line, { encoding: "utf8" });
  } catch {
    try {
      const fallback = join(tmpdir(), "ringly-fallback.log");
      appendFileSync(fallback, line, { encoding: "utf8" });
    } catch {
      /* silent */
    }
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => writeLine("debug", message, meta),
  info: (message: string, meta?: unknown) => writeLine("info", message, meta),
  warn: (message: string, meta?: unknown) => writeLine("warn", message, meta),
  error: (message: string, meta?: unknown) => writeLine("error", message, meta),
  getLogFile: () => resolveLogFile(),
  isDebugEnabled,
};

export type Logger = typeof logger;
