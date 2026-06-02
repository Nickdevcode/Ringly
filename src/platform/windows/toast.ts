import { pathToFileURL } from "node:url";
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

/** Root `<toast …>` attributes: scenario (non-default only) + optional timestamp. */
function buildToastAttributes(options: ToastOptions): string {
  const attrs: string[] = [];
  if (options.scenario && options.scenario !== "default") {
    attrs.push(`scenario="${escapeXmlAttribute(options.scenario)}"`);
  }
  if (options.displayTimestamp) {
    attrs.push(`displayTimestamp="${escapeXmlAttribute(options.displayTimestamp)}"`);
  }
  return attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
}

/**
 * App-logo image line for the binding. Uses a `file:///` URL (the form Windows
 * accepts for a Win32 app addressed via a registered AUMID). `hint-crop="none"`
 * keeps the logo square (a circle crop chopped the corners off square art).
 * Returns "" when no icon path is given, so the toast degrades to text-only.
 */
function buildAppLogoTag(iconPath: string | undefined): string {
  if (!iconPath) return "";
  const src = pathToFileURL(iconPath).href;
  return `      <image placement="appLogoOverride" hint-crop="none" src="${escapeXmlAttribute(src)}"/>\n`;
}

export function buildToastXml(options: ToastOptions): string {
  const title = escapeXmlText(options.title);
  const body = escapeXmlText(options.body);
  const audio = buildAudioTag(options.sound);
  const rootAttrs = buildToastAttributes(options);
  const appLogo = buildAppLogoTag(options.iconPath);

  return (
    `<toast${rootAttrs}>\n` +
    "  <visual>\n" +
    '    <binding template="ToastGeneric">\n' +
    appLogo +
    `      <text>${title}</text>\n` +
    `      <text>${body}</text>\n` +
    "    </binding>\n" +
    "  </visual>\n" +
    `  ${audio}\n` +
    "</toast>"
  );
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
