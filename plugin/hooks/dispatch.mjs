#!/usr/bin/env node
import { spawnSync as nodeSpawnSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const requireFromHere = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/**
 * Event metadata + embedded translations come from `dispatch.data.mjs`, which
 * is generated from the TypeScript registry (`src/core/events.ts`) at build
 * time and committed alongside this file. If that import ever fails, we fall
 * back to an inline definition of the original four events so the hook never
 * crashes — worst case is the pre-registry behavior, never an error.
 */
const FALLBACK_DATA = {
  events: {
    Notification: {
      configKey: "notification",
      defaultEnabled: true,
      verbose: false,
      sound: "Notification.Default",
      resolver: "notification",
      scenario: null,
    },
    Stop: {
      configKey: "stop",
      defaultEnabled: true,
      verbose: false,
      sound: "Notification.IM",
      resolver: null,
      scenario: null,
    },
    StopFailure: {
      configKey: "stopFailure",
      defaultEnabled: true,
      verbose: false,
      sound: "Notification.Looping.Alarm2",
      resolver: "stopFailure",
      scenario: null,
    },
    SubagentStop: {
      configKey: "subagentStop",
      defaultEnabled: false,
      verbose: false,
      sound: "Notification.IM",
      resolver: "agentNamed",
      scenario: null,
    },
  },
  translations: {
    "pt-BR": {
      Notification: {
        title: "Claude Code — Atenção necessária",
        body: "Claude Code precisa da sua atenção",
      },
      Stop: { title: "Claude Code — Tarefa concluída", body: "Aguardando próximo input" },
      StopFailure: {
        title: "Claude Code — Erro de API",
        body: "A sessão foi encerrada por um erro",
      },
      SubagentStop: { title: "Claude Code — Subagent finalizado", body: "Um subagent terminou" },
    },
    "en-US": {
      Notification: {
        title: "Claude Code — Attention required",
        body: "Claude Code needs your attention",
      },
      Stop: { title: "Claude Code — Task complete", body: "Waiting for your next input" },
      StopFailure: { title: "Claude Code — API error", body: "The session ended with an error" },
      SubagentStop: { title: "Claude Code — Subagent finished", body: "A subagent finished" },
    },
  },
};

async function loadDispatchData() {
  try {
    const mod = await import(pathToFileURL(join(here, "dispatch.data.mjs")).href);
    if (mod?.DISPATCH_DATA?.events && mod.DISPATCH_DATA.translations) return mod.DISPATCH_DATA;
  } catch {
    /* fall through to inline fallback */
  }
  return FALLBACK_DATA;
}

const DISPATCH_DATA = await loadDispatchData();

// Notification events come from the data mirror; SessionStart (update check) is
// always allowed and handled separately (it is not a notification event).
const ALLOWED_EVENTS = new Set([...Object.keys(DISPATCH_DATA.events), "SessionStart"]);

const SETTINGS_FILE = join(homedir(), ".claude", "settings.json");

// Defaults derived from the registry: `events_<configKey>` per event +
// the non-event options. Keeps this in lockstep with the TypeScript path.
const DEFAULT_OPTIONS = (() => {
  const opts = { language: "auto", sound: true, debug: false, check_updates: true };
  for (const meta of Object.values(DISPATCH_DATA.events)) {
    opts[`events_${meta.configKey}`] = meta.defaultEnabled;
  }
  return opts;
})();

function loadOptions() {
  try {
    if (!existsSync(SETTINGS_FILE)) return { ...DEFAULT_OPTIONS };
    const raw = readFileSync(SETTINGS_FILE, { encoding: "utf8" });
    if (raw.trim().length === 0) return { ...DEFAULT_OPTIONS };
    const parsed = JSON.parse(raw);
    const entry = parsed?.pluginConfigs?.ringly?.options ?? {};
    return { ...DEFAULT_OPTIONS, ...entry };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

const OPTIONS = loadOptions();

const debugEnabled =
  process.env["RINGLY_DEBUG"] === "1" ||
  process.env["CLAUDE_PLUGIN_OPTION_DEBUG"] === "true" ||
  OPTIONS.debug === true;

function debugLog(msg) {
  if (!debugEnabled) return;
  try {
    const file = join(process.env["CLAUDE_PLUGIN_DATA"] || tmpdir(), "ringly-dispatch.log");
    appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`, { encoding: "utf8" });
  } catch {
    /* silent */
  }
}

function eventEnabled(event) {
  // SessionStart is the update check, not a notification.
  if (event === "SessionStart") return OPTIONS.check_updates !== false;

  const meta = DISPATCH_DATA.events[event];
  if (!meta) return false;

  const value = OPTIONS[`events_${meta.configKey}`];
  // Events on by default fire unless explicitly disabled; events off by default
  // (incl. all verbose ones) fire only when explicitly enabled.
  return meta.defaultEnabled ? value !== false : value === true;
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  return await new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.removeAllListeners();
      resolve(value);
    };
    const timer = setTimeout(() => finish(Buffer.concat(chunks).toString("utf8")), 4000);
    process.stdin.on("data", (chunk) => {
      size += chunk.length;
      if (size > 256 * 1024) {
        finish("");
        return;
      }
      chunks.push(chunk);
    });
    process.stdin.on("end", () => finish(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", () => finish(""));
  });
}

function pickEvent() {
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (ALLOWED_EVENTS.has(arg)) return arg;
  }
  return null;
}

function findNodeModuleEntry() {
  const candidates = [];
  try {
    candidates.push(() => requireFromHere.resolve("ringly/hook"));
  } catch {
    /* ignore */
  }
  try {
    const globalRoot = resolveGlobalNpmRoot();
    if (globalRoot) {
      const candidatePath = join(globalRoot, "ringly", "dist", "hook.js");
      candidates.push(() => (existsSync(candidatePath) ? candidatePath : null));
    }
  } catch {
    /* ignore */
  }
  for (const fn of candidates) {
    try {
      const resolved = fn();
      if (resolved) return resolved;
    } catch {
      /* try next */
    }
  }
  return null;
}

function resolveGlobalNpmRoot() {
  try {
    const result = nodeSpawnSync("npm", ["root", "-g"], {
      encoding: "utf8",
      shell: process.platform === "win32",
      windowsHide: true,
      timeout: 5000,
    });
    if (result?.stdout) {
      const line = result.stdout.split(/\r?\n/).find((l) => l.trim().length > 0);
      return line ? line.trim() : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function tryNodeModule(forcedEvent, rawStdin) {
  const entry = findNodeModuleEntry();
  if (!entry) {
    debugLog("Node module entry not found");
    return false;
  }
  debugLog(`Node module entry: ${entry}`);
  return await spawnNode([entry, forcedEvent], rawStdin, "module");
}

async function spawnNode(args, rawStdin, label) {
  return await new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, args, {
        stdio: ["pipe", "ignore", "pipe"],
        windowsHide: true,
      });
    } catch (err) {
      debugLog(`${label} spawn failed: ${err?.message ?? err}`);
      resolve(false);
      return;
    }
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      debugLog(`${label} timed out`);
      resolve(false);
    }, 12000);
    child.on("error", (err) => {
      clearTimeout(timer);
      debugLog(`${label} error: ${err.message}`);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        debugLog(`${label} OK`);
        resolve(true);
      } else {
        debugLog(`${label} exited code=${code} stderr=${stderr}`);
        resolve(false);
      }
    });
    try {
      child.stdin?.end(rawStdin);
    } catch {
      resolve(false);
    }
  });
}

async function resolveBinaryPath() {
  const cliCmd = process.platform === "win32" ? "ringly.cmd" : "ringly";
  const lookup = process.platform === "win32" ? "where.exe" : "which";
  return await new Promise((resolve) => {
    const child = spawn(lookup, [cliCmd], {
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    let stdout = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const firstLine = stdout.split(/\r?\n/).find((line) => line.trim().length > 0);
      resolve(firstLine ? firstLine.trim() : null);
    });
  });
}

async function tryCliBinary(forcedEvent, rawStdin) {
  const binaryPath = await resolveBinaryPath();
  if (!binaryPath) {
    debugLog("CLI binary not found in PATH");
    return false;
  }
  debugLog(`CLI binary: ${binaryPath}`);
  const isCmdScript = process.platform === "win32" && /\.(cmd|bat)$/i.test(binaryPath);
  return await new Promise((resolve) => {
    let child;
    try {
      child = spawn(binaryPath, ["hook", forcedEvent], {
        stdio: ["pipe", "ignore", "pipe"],
        windowsHide: true,
        shell: isCmdScript,
      });
    } catch (err) {
      debugLog(`spawn failed: ${err?.message ?? err}`);
      resolve(false);
      return;
    }
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      debugLog("CLI timed out");
      resolve(false);
    }, 12000);
    child.on("error", (err) => {
      clearTimeout(timer);
      debugLog(`CLI spawn error: ${err.message}`);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        debugLog("CLI OK");
        resolve(true);
      } else {
        debugLog(`CLI exited code=${code} stderr=${stderr}`);
        resolve(false);
      }
    });
    try {
      child.stdin?.end(rawStdin);
    } catch {
      resolve(false);
    }
  });
}

function detectLanguage() {
  const fromSettings = OPTIONS.language;
  if (fromSettings === "pt-BR" || fromSettings === "en-US") return fromSettings;
  if (fromSettings && fromSettings !== "auto") {
    const v = String(fromSettings).toLowerCase();
    if (v.startsWith("pt")) return "pt-BR";
    if (v.startsWith("en")) return "en-US";
  }
  const candidates = [
    process.env["LANG"],
    process.env["LANGUAGE"],
    process.env["LC_ALL"],
    process.env["LC_MESSAGES"],
  ].filter(Boolean);
  for (const value of candidates) {
    const v = value.toLowerCase();
    if (v.startsWith("pt")) return "pt-BR";
    if (v.startsWith("en")) return "en-US";
  }
  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (locale.startsWith("pt")) return "pt-BR";
  } catch {
    /* fall-through */
  }
  return "en-US";
}

function escapeXml(input) {
  if (!input) return "";
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i);
    const code = input.charCodeAt(i);
    switch (ch) {
      case "&":
        out += "&amp;";
        break;
      case "<":
        out += "&lt;";
        break;
      case ">":
        out += "&gt;";
        break;
      case '"':
        out += "&quot;";
        break;
      case "'":
        out += "&apos;";
        break;
      default:
        if (code > 126 || code < 32) out += `&#${code};`;
        else out += ch;
    }
  }
  return out;
}

function buildEmbeddedToast(event, payload) {
  const lang = detectLanguage();
  const meta = DISPATCH_DATA.events[event];
  const dict = DISPATCH_DATA.translations[lang] ?? DISPATCH_DATA.translations["en-US"];
  const entry = dict?.[event] ?? { title: "Claude Code", body: "" };

  const title = entry.title;
  let body = entry.body;
  const sound = meta?.sound ?? "Notification.IM";

  // The embedded path is intentionally simpler than the TypeScript resolvers;
  // it just covers the common shapes so a toast still appears when the CLI
  // module is unreachable.
  if (event === "Notification") {
    body = payload?.message?.toString() || entry.body;
  } else if (event === "StopFailure") {
    body = payload?.error_type?.toString() || payload?.message?.toString() || entry.body;
  } else if (meta?.resolver === "agentNamed" && payload?.agent_type) {
    body = `${payload.agent_type}: ${entry.body}`;
  }

  const project = extractProjectName(payload?.cwd);
  if (project) body = `${project}: ${body}`;

  const silent = OPTIONS.sound === false;
  const scenario = meta?.scenario ?? null;

  return { title: escapeXml(title), body: escapeXml(body), sound, silent, scenario };
}

function extractProjectName(cwd) {
  if (!cwd) return null;
  try {
    const normalized = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
    const idx = normalized.lastIndexOf("/");
    return idx >= 0 ? normalized.slice(idx + 1) : normalized;
  } catch {
    return null;
  }
}

async function runEmbeddedToast(event, payload) {
  if (process.platform !== "win32") {
    debugLog(`Embedded toast unsupported on platform ${process.platform}`);
    return;
  }

  const { title, body, sound, silent, scenario } = buildEmbeddedToast(event, payload);
  const appId = "Claude.Code.CLI";

  const audioTag = silent ? '<audio silent="true"/>' : `<audio src="ms-winsoundevent:${sound}"/>`;
  const scenarioAttr =
    scenario && scenario !== "default" ? ` scenario="${escapeXml(scenario)}"` : "";

  const toastXml = `<toast${scenarioAttr}><visual><binding template="ToastGeneric"><text>${title}</text><text>${body}</text></binding></visual>${audioTag}</toast>`;

  const script = `
$ErrorActionPreference = 'SilentlyContinue'
try {
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime]
    [void][Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType=WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime]
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml('${toastXml.replace(/'/g, "''")}')
    $appId = '${appId}'
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId)
    if ($notifier.Setting -ne [Windows.UI.Notifications.NotificationSetting]::Enabled) {
        try { [Console]::Beep(800, 200) } catch { }
        exit 0
    }
    $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
    $notifier.Show($toast)
} catch { }
exit 0
`.trim();

  const encoded = Buffer.from(script, "utf16le").toString("base64");

  await new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { windowsHide: true, stdio: "ignore" },
    );
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      resolve();
    }, 8000);
    child.on("close", () => {
      clearTimeout(timer);
      resolve();
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  debugLog(`Embedded toast dispatched (lang=${detectLanguage()}, silent=${silent})`);
}

async function main() {
  const event = pickEvent();
  const rawStdin = await readStdin();

  if (!event) {
    debugLog("No recognizable event in argv");
    return;
  }

  debugLog(`Event=${event}, stdinBytes=${rawStdin.length}, opts=${JSON.stringify(OPTIONS)}`);

  if (!eventEnabled(event)) {
    debugLog(`Event ${event} disabled by user settings; skipping`);
    return;
  }

  if (await tryNodeModule(event, rawStdin)) return;
  if (await tryCliBinary(event, rawStdin)) return;

  // SessionStart is an update-check trigger, not a user-facing notification.
  // If the CLI module/binary is unreachable we cannot perform the check —
  // there's nothing useful the embedded PowerShell toast can do here, so we
  // simply give up silently rather than firing a misleading toast.
  if (event === "SessionStart") {
    debugLog("SessionStart: no CLI reachable; skipping update check");
    return;
  }

  let payload = {};
  if (rawStdin.trim().length > 0) {
    try {
      payload = JSON.parse(rawStdin.replace(/^﻿/, ""));
    } catch {
      payload = {};
    }
  }
  await runEmbeddedToast(event, payload);
}

main()
  .catch((err) => {
    debugLog(`Fatal: ${err?.message ?? err}`);
  })
  .finally(() => {
    process.exit(0);
  });
