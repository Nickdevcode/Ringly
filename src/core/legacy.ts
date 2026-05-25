import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "./logger.js";

/**
 * Caminhos e nomes do sistema antigo (PowerShell scripts em ~/.claude/hooks/).
 * Estes valores correspondem ao protótipo pessoal que existia antes do Ringly
 * ser empacotado como projeto open-source. Mantemos aqui para que o Ringly
 * consiga detectar instalações pré-existentes, fazer migração segura
 * (com backup) e evitar disparo duplicado de toasts.
 */
const LEGACY_FILES = ["notify-toast.ps1", "register-toast-aumid.ps1"] as const;
const LEGACY_EVENTS = ["Notification", "Stop", "StopFailure", "SubagentStop"] as const;

export interface LegacyDetection {
  scriptsFound: string[];
  hooksFound: string[];
  hooksFile: string;
  hooksDir: string;
}

interface LegacyHookCommand {
  type?: string;
  command?: string;
}

interface LegacyHookEntry {
  hooks?: LegacyHookCommand[];
}

type LegacySettings = Record<string, unknown> & {
  hooks?: Record<string, LegacyHookEntry[]>;
};

/**
 * Resolve o diretório raiz do Claude Code do usuário (`~/.claude/`).
 * Esse caminho é fixo na convenção do Claude Code e independe do projeto.
 */
function getClaudeRoot(): string {
  return join(homedir(), ".claude");
}

function getHooksDir(): string {
  return join(getClaudeRoot(), "hooks");
}

function getSettingsFile(): string {
  return join(getClaudeRoot(), "settings.json");
}

/**
 * Decide se uma entrada do `settings.json` corresponde a um hook do
 * sistema antigo. Procura por padrões característicos dos scripts
 * `notify-toast.ps1` e `register-toast-aumid.ps1`.
 */
function isLegacyHookCommand(cmd: string | undefined): boolean {
  if (!cmd) return false;
  const lower = cmd.toLowerCase();
  return (
    lower.includes("notify-toast.ps1") ||
    lower.includes("register-toast-aumid.ps1") ||
    lower.includes("\\.claude\\hooks\\notify") ||
    lower.includes("/.claude/hooks/notify")
  );
}

/**
 * Verifica quais arquivos `.ps1` legados estão presentes no disco e
 * quais eventos do `settings.json` ainda apontam para esses scripts.
 * Não altera nada — apenas relata o estado atual.
 */
export function detectLegacy(): LegacyDetection {
  const hooksDir = getHooksDir();
  const scriptsFound = LEGACY_FILES.filter((name) => existsSync(join(hooksDir, name)));

  const settingsFile = getSettingsFile();
  const hooksFound: string[] = [];

  if (existsSync(settingsFile)) {
    try {
      const raw = readFileSync(settingsFile, { encoding: "utf8" });
      const parsed = JSON.parse(raw) as LegacySettings;
      const hookGroups = parsed.hooks ?? {};

      for (const event of LEGACY_EVENTS) {
        const entries = hookGroups[event];
        if (!Array.isArray(entries)) continue;
        const hasLegacy = entries.some((entry) =>
          (entry.hooks ?? []).some((h) => isLegacyHookCommand(h.command)),
        );
        if (hasLegacy) hooksFound.push(event);
      }
    } catch (err) {
      logger.warn("Failed to parse legacy settings.json", {
        message: (err as Error).message,
      });
    }
  }

  return {
    scriptsFound,
    hooksFound,
    hooksFile: settingsFile,
    hooksDir,
  };
}

export interface LegacyDisableResult {
  removedHooks: string[];
  movedScripts: string[];
  backupFile: string | null;
  backupDir: string | null;
}

/**
 * Desativa o sistema antigo sem destruir nada:
 *
 * 1. Faz backup do `settings.json` em `settings.json.ringly-bak.<timestamp>`.
 * 2. Remove apenas as entradas de hook que apontam para `notify-toast.ps1`
 *    (preservando outros hooks do usuário, se existirem).
 * 3. Move os arquivos `.ps1` para uma pasta `legacy-bak-<timestamp>/` ao
 *    lado deles, mantendo a possibilidade de restauração manual.
 *
 * A operação é idempotente: se nada estiver instalado, retorna listas vazias.
 */
export function disableLegacy(): LegacyDisableResult {
  const detection = detectLegacy();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const result: LegacyDisableResult = {
    removedHooks: [],
    movedScripts: [],
    backupFile: null,
    backupDir: null,
  };

  if (detection.hooksFound.length > 0) {
    const backupFile = `${detection.hooksFile}.ringly-bak.${timestamp}`;
    copyFileSync(detection.hooksFile, backupFile);
    result.backupFile = backupFile;

    const raw = readFileSync(detection.hooksFile, { encoding: "utf8" });
    const parsed = JSON.parse(raw) as LegacySettings;
    const hookGroups = parsed.hooks ?? {};

    for (const event of detection.hooksFound) {
      const entries = hookGroups[event];
      if (!Array.isArray(entries)) continue;

      const filteredEntries: LegacyHookEntry[] = [];
      for (const entry of entries) {
        const filtered = (entry.hooks ?? []).filter((h) => !isLegacyHookCommand(h.command));
        if (filtered.length > 0) {
          filteredEntries.push({ ...entry, hooks: filtered });
        }
      }

      if (filteredEntries.length > 0) {
        hookGroups[event] = filteredEntries;
      } else {
        delete hookGroups[event];
      }
      result.removedHooks.push(event);
    }

    if (Object.keys(hookGroups).length === 0) {
      delete parsed.hooks;
    } else {
      parsed.hooks = hookGroups;
    }

    writeFileSync(detection.hooksFile, `${JSON.stringify(parsed, null, 2)}\n`, {
      encoding: "utf8",
    });
  }

  if (detection.scriptsFound.length > 0) {
    const backupDir = join(detection.hooksDir, `legacy-bak-${timestamp}`);
    result.backupDir = backupDir;
    for (const name of detection.scriptsFound) {
      const from = join(detection.hooksDir, name);
      const to = join(backupDir, name);
      ensureDir(backupDir);
      try {
        renameSync(from, to);
        result.movedScripts.push(name);
      } catch (err) {
        logger.warn("Failed to move legacy script", {
          file: name,
          message: (err as Error).message,
        });
      }
    }
  }

  return result;
}

/**
 * Cria um diretório (e ancestrais) se ele ainda não existir.
 * Usado como helper local para evitar `mkdirSync` espalhado no fluxo.
 */
function ensureDir(dir: string): void {
  if (existsSync(dir)) return;
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    logger.warn("Failed to create directory", {
      dir,
      message: (err as Error).message,
    });
  }
}

/**
 * Indica se há vestígios do sistema antigo (hooks ativos OU scripts no disco).
 * Atalho de leitura para o `doctor` exibir alertas amarelos.
 */
export function hasLegacyActive(): boolean {
  const detection = detectLegacy();
  return detection.hooksFound.length > 0 || detection.scriptsFound.length > 0;
}
