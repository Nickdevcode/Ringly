import { logger } from "../../core/logger.js";
import type { ToastOptions, ToastSoundName } from "../../core/types.js";
import { escapeXmlAttribute, escapeXmlText } from "../../core/xml.js";
import { runPowerShell } from "./powershell.js";
import { buildToastScript } from "./ps-templates.js";

const SOUND_PREFIX = "ms-winsoundevent:";

function buildAudioTag(sound: ToastSoundName): string {
  if (sound === "silent") {
    return '<audio silent="true"/>';
  }
  const src = `${SOUND_PREFIX}${sound}`;
  return `<audio src="${escapeXmlAttribute(src)}"/>`;
}

export function buildToastXml(options: ToastOptions): string {
  const title = escapeXmlText(options.title);
  const body = escapeXmlText(options.body);
  const audio = buildAudioTag(options.sound);

  return [
    "<toast>",
    "  <visual>",
    '    <binding template="ToastGeneric">',
    `      <text>${title}</text>`,
    `      <text>${body}</text>`,
    "    </binding>",
    "  </visual>",
    `  ${audio}`,
    "</toast>",
  ].join("\n");
}

export interface SendToastResult {
  delivered: boolean;
  blocked: boolean;
  reason?: string;
}

export async function sendWindowsToast(options: ToastOptions): Promise<SendToastResult> {
  const toastXml = buildToastXml(options);
  const script = buildToastScript({ appId: options.appId, toastXml });

  logger.debug("Toast XML", { xml: toastXml });

  const result = await runPowerShell({ script, timeoutMs: 8000 });

  if (result.timedOut) {
    logger.error("Toast PowerShell timed out");
    return { delivered: false, blocked: false, reason: "timeout" };
  }

  const out = result.stdout;
  if (out === "OK") {
    logger.debug("Toast delivered");
    return { delivered: true, blocked: false };
  }
  if (out.startsWith("BLOCKED:")) {
    logger.warn("Toast blocked", { setting: out });
    return { delivered: false, blocked: true, reason: out };
  }
  if (out.startsWith("ERROR:")) {
    logger.error("Toast error", { message: out, stderr: result.stderr });
    return { delivered: false, blocked: false, reason: out };
  }

  logger.warn("Toast unknown PowerShell output", { stdout: out, stderr: result.stderr });
  return { delivered: false, blocked: false, reason: "unknown_output" };
}
