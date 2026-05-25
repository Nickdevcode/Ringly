import { appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import envPaths from "env-paths";

type LogLevel = "debug" | "info" | "warn" | "error";

const paths = envPaths("ringly", { suffix: "" });

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

function writeLine(level: LogLevel, message: string, meta?: unknown): void {
  if (level === "debug" && !isDebugEnabled()) return;

  const timestamp = new Date().toISOString();
  const metaStr = meta === undefined ? "" : ` ${safeStringify(meta)}`;
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;

  try {
    const file = resolveLogFile();
    ensureDirOnce(dirname(file));
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
