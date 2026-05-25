#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendFileSync } from "node:fs";

const ALLOWED_EVENTS = new Set(["Notification", "Stop", "StopFailure", "SubagentStop"]);

const debugEnabled =
  process.env["RINGLY_DEBUG"] === "1" ||
  process.env["CLAUDE_PLUGIN_OPTION_DEBUG"] === "true";

function debugLog(msg) {
  if (!debugEnabled) return;
  try {
    const file = join(
      process.env["CLAUDE_PLUGIN_DATA"] || tmpdir(),
      "ringly-dispatch.log",
    );
    appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`, { encoding: "utf8" });
  } catch {
    /* silent */
  }
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
      if (size > 10 * 1024 * 1024) {
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
  try {
    const require = createRequire(import.meta.url);
    return require.resolve("ringly/hook");
  } catch {
    return null;
  }
}

async function tryNodeModule(forcedEvent, rawStdin) {
  const entry = findNodeModuleEntry();
  if (!entry) return false;
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
    }, 10000);
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
  return await new Promise((resolve) => {
    let child;
    try {
      child = spawn(binaryPath, ["hook", forcedEvent], {
        stdio: ["pipe", "ignore", "pipe"],
        windowsHide: true,
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
    child.on("error", (err) => {
      debugLog(`CLI spawn error: ${err.message}`);
      resolve(false);
    });
    child.on("close", (code) => {
      if (code === 0) {
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

const EMBEDDED_TRANSLATIONS = {
  "pt-BR": {
    titleNotification: "Claude Code — Atenção necessária",
    titleStop: "Claude Code — Tarefa concluída",
    titleStopFailure: "Claude Code — Erro de API",
    titleSubagent: "Claude Code — Subagent finalizado",
    bodyStop: "Aguardando próximo input",
    bodyNotification: "Claude Code precisa da sua atenção",
    bodyStopFailure: "A sessão foi encerrada por um erro",
    bodySubagent: "Um subagent terminou",
  },
  "en-US": {
    titleNotification: "Claude Code — Attention required",
    titleStop: "Claude Code — Task complete",
    titleStopFailure: "Claude Code — API error",
    titleSubagent: "Claude Code — Subagent finished",
    bodyStop: "Waiting for your next input",
    bodyNotification: "Claude Code needs your attention",
    bodyStopFailure: "The session ended with an error",
    bodySubagent: "A subagent finished",
  },
};

function detectLanguage() {
  const explicit = process.env["CLAUDE_PLUGIN_OPTION_LANGUAGE"];
  if (explicit === "pt-BR" || explicit === "en-US") return explicit;
  const candidates = [process.env["LANG"], process.env["LANGUAGE"]].filter(Boolean);
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
  const dict = EMBEDDED_TRANSLATIONS[lang];

  let title = dict.titleStop;
  let body = dict.bodyStop;
  let sound = "Notification.IM";

  switch (event) {
    case "Notification":
      title = dict.titleNotification;
      body = payload?.message?.toString() || dict.bodyNotification;
      sound = "Notification.Default";
      break;
    case "Stop":
      title = dict.titleStop;
      body = dict.bodyStop;
      sound = "Notification.IM";
      break;
    case "StopFailure":
      title = dict.titleStopFailure;
      body =
        payload?.error_type?.toString() ||
        payload?.message?.toString() ||
        dict.bodyStopFailure;
      sound = "Notification.Looping.Alarm2";
      break;
    case "SubagentStop":
      title = dict.titleSubagent;
      body = payload?.agent_type
        ? `${payload.agent_type}: ${dict.bodySubagent}`
        : dict.bodySubagent;
      sound = "Notification.IM";
      break;
  }

  const project = extractProjectName(payload?.cwd);
  if (project) body = `${project}: ${body}`;

  return { title: escapeXml(title), body: escapeXml(body), sound };
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

  const { title, body, sound } = buildEmbeddedToast(event, payload);
  const appId = "Claude.Code.CLI";

  const toastXml = `<toast><visual><binding template="ToastGeneric"><text>${title}</text><text>${body}</text></binding></visual><audio src="ms-winsoundevent:${sound}"/></toast>`;

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
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        encoded,
      ],
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
  debugLog("Embedded toast dispatched");
}

async function main() {
  const event = pickEvent();
  const rawStdin = await readStdin();

  if (!event) {
    debugLog("No recognizable event in argv");
    return;
  }

  debugLog(`Event=${event}, stdinBytes=${rawStdin.length}`);

  if (await tryNodeModule(event, rawStdin)) return;
  if (await tryCliBinary(event, rawStdin)) return;

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
