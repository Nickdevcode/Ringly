import { basename } from "node:path";
import type { Translator } from "./translator.js";
import type {
  ClaudeHookEventName,
  ClaudeHookPayload,
  NotificationIntent,
  NotificationSeverity,
  ToastSoundName,
} from "./types.js";

const KNOWN_NOTIFICATION_TYPES = new Set([
  "permission_prompt",
  "idle_prompt",
  "auth_success",
  "elicitation_dialog",
  "elicitation_complete",
  "elicitation_response",
]);

const KNOWN_ERROR_TYPES = new Set([
  "rate_limit",
  "authentication_failed",
  "oauth_org_not_allowed",
  "billing_error",
  "invalid_request",
  "model_not_found",
  "server_error",
  "max_output_tokens",
  "unknown",
]);

export interface MapEventOptions {
  payload: ClaudeHookPayload;
  event: ClaudeHookEventName;
  translator: Translator;
  soundEnabled: boolean;
  projectDirOverride?: string | undefined;
}

export function mapEvent(options: MapEventOptions): NotificationIntent {
  const { payload, event, translator, soundEnabled, projectDirOverride } = options;

  const projectName = extractProjectName(payload.cwd, projectDirOverride);
  const prefix = projectName ? `${projectName}: ` : "";

  const built = buildEventBody({ event, payload, translator, prefix });

  return {
    event,
    title: built.title,
    body: built.body,
    severity: built.severity,
    projectName,
    sound: soundEnabled,
    soundName: built.sound,
  };
}

interface EventBody {
  title: string;
  body: string;
  severity: NotificationSeverity;
  sound: ToastSoundName;
}

interface BuildEventBodyOptions {
  event: ClaudeHookEventName;
  payload: ClaudeHookPayload;
  translator: Translator;
  prefix: string;
}

function buildEventBody(options: BuildEventBodyOptions): EventBody {
  const { event, payload, translator, prefix } = options;

  switch (event) {
    case "Stop":
      return {
        title: translator.t("title.stop"),
        body: `${prefix}${translator.t("body.stop")}`,
        severity: "info",
        sound: "Notification.IM",
      };
    case "Notification":
      return {
        title: translator.t("title.notification"),
        body: `${prefix}${resolveNotificationBody(payload, translator)}`,
        severity: "warning",
        sound: "Notification.Default",
      };
    case "StopFailure":
      return {
        title: translator.t("title.stopFailure"),
        body: `${prefix}${resolveStopFailureBody(payload, translator)}`,
        severity: "error",
        sound: "Notification.Looping.Alarm2",
      };
    case "SubagentStop":
      return {
        title: translator.t("title.subagentStop"),
        body: `${prefix}${resolveSubagentBody(payload, translator)}`,
        severity: "info",
        sound: "Notification.IM",
      };
  }
}

function resolveNotificationBody(payload: ClaudeHookPayload, translator: Translator): string {
  const explicitType = payload.notification_type ?? payload.type;
  if (explicitType && KNOWN_NOTIFICATION_TYPES.has(explicitType)) {
    return translator.t(`notification.type.${explicitType}`);
  }

  const message = payload.message?.trim();
  if (message && message.length > 0) {
    const toolMatch = /^Claude needs your permission to use\s+(.+?)\s*$/.exec(message);
    if (toolMatch?.[1]) {
      return translator.t("notification.tool_permission", { tool: toolMatch[1] });
    }
    if (/^Claude (is waiting for|needs) your input/.test(message)) {
      return translator.t("notification.waiting_input");
    }
    if (/^Claude needs your attention/.test(message)) {
      return translator.t("notification.attention");
    }
    if (/Needs your attention/i.test(message)) {
      return translator.t("notification.attention_generic");
    }
    return `${translator.t("body.notification.fallback")} (${message})`;
  }

  return translator.t("body.notification.fallback");
}

function resolveStopFailureBody(payload: ClaudeHookPayload, translator: Translator): string {
  const errType = payload.error_type;
  if (errType && KNOWN_ERROR_TYPES.has(errType)) {
    return translator.t(`stopFailure.type.${errType}`);
  }

  const message = (payload.message ?? payload.error ?? "").trim();
  if (message.length > 0) {
    const lower = message.toLowerCase();
    if (/rate.?limit/.test(lower)) return translator.t("stopFailure.fallback.rate_limit");
    if (/authenticat/.test(lower)) return translator.t("stopFailure.fallback.authentication");
    if (/billing|payment/.test(lower)) return translator.t("stopFailure.fallback.billing");
    if (/invalid.?request/.test(lower)) return translator.t("stopFailure.fallback.invalid_request");
    if (/model.?not.?found/.test(lower)) return translator.t("stopFailure.fallback.model");
    if (/server.?error|5\d{2}/.test(lower)) return translator.t("stopFailure.fallback.server");
    if (/max.?(output)?.?tokens/.test(lower))
      return translator.t("stopFailure.fallback.max_tokens");
    return `${translator.t("body.stopFailure.fallback")} (${message})`;
  }

  return translator.t("body.stopFailure.fallback");
}

function resolveSubagentBody(payload: ClaudeHookPayload, translator: Translator): string {
  const agent = payload.agent_type?.trim();
  if (agent && agent.length > 0) {
    return translator.t("body.subagentStop.named", { agent });
  }
  return translator.t("body.subagentStop.fallback");
}

function extractProjectName(cwd?: string, override?: string): string | null {
  const source = (override && override.trim().length > 0 ? override : cwd) ?? "";
  if (!source) return null;
  try {
    const normalized = source.replace(/\\/g, "/").replace(/\/+$/, "");
    const name = basename(normalized);
    return name && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}
