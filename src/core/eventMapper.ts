import { basename } from "node:path";
import { EVENT_BY_NAME, type EventDescriptor } from "./events.js";
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

  const descriptor: EventDescriptor = EVENT_BY_NAME[event];
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
    scenario: descriptor.scenario,
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

/**
 * Builds title/body/severity/sound for an event, fully driven by its
 * `EventDescriptor`. Title, severity and sound come straight from the
 * registry; only the body varies, dispatched on `descriptor.resolver`.
 * A descriptor with no resolver yields the plain `prefix + t(bodyKey)`.
 */
function buildEventBody(options: BuildEventBodyOptions): EventBody {
  const { event, payload, translator, prefix } = options;
  const descriptor = EVENT_BY_NAME[event];

  return {
    title: translator.t(descriptor.titleKey),
    body: `${prefix}${resolveBody(descriptor, payload, translator)}`,
    severity: descriptor.severity,
    sound: descriptor.sound,
  };
}

function resolveBody(
  descriptor: EventDescriptor,
  payload: ClaudeHookPayload,
  translator: Translator,
): string {
  switch (descriptor.resolver) {
    case "notification":
      return resolveNotificationBody(payload, translator);
    case "stopFailure":
      return resolveStopFailureBody(payload, translator);
    case "agentNamed":
      return resolveAgentNamedBody(descriptor, payload, translator);
    case "taskNamed":
      return resolveTaskNamedBody(descriptor, payload, translator);
    case "compact":
      return resolveCompactBody(descriptor, payload, translator);
    default:
      return translator.t(descriptor.bodyKey);
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

/**
 * Body for "agent-aware" events (subagent start/stop, task created/completed):
 * shows the agent name when `agent_type` is present, otherwise the plain
 * fallback. The named variant lives at the descriptor's `<bodyKey>` sibling
 * with the trailing segment swapped to `.named` — e.g. a `bodyKey` of
 * `body.subagentStop.fallback` resolves the named key `body.subagentStop.named`.
 */
function resolveAgentNamedBody(
  descriptor: EventDescriptor,
  payload: ClaudeHookPayload,
  translator: Translator,
): string {
  const agent = payload.agent_type?.trim();
  if (agent && agent.length > 0) {
    return translator.t(namedKeyFor(descriptor.bodyKey), { agent });
  }
  return translator.t(descriptor.bodyKey);
}

/**
 * Body for task events (`TaskCreated`/`TaskCompleted`): shows the human-readable
 * task title when present, otherwise the plain fallback. The title comes from
 * `task_subject` (the field Claude Code sends per the hooks docs), falling back
 * to `task_description`. The named variant lives at the descriptor's `<bodyKey>`
 * sibling with the trailing segment swapped to `.named` and a `{task}`
 * placeholder — e.g. `body.taskCompleted.fallback` → `body.taskCompleted.named`.
 *
 * Defensive on purpose: if a future Claude Code version renames the field, we
 * simply fall through to the generic body instead of breaking the toast.
 */
function resolveTaskNamedBody(
  descriptor: EventDescriptor,
  payload: ClaudeHookPayload,
  translator: Translator,
): string {
  const task = (payload.task_subject ?? payload.task_description)?.trim();
  if (task && task.length > 0) {
    return translator.t(namedKeyFor(descriptor.bodyKey), { task });
  }
  return translator.t(descriptor.bodyKey);
}

/**
 * Body for compaction events (`PreCompact`/`PostCompact`): picks the
 * `manual`/`auto` variant from `payload.trigger`, falling back to the plain
 * body when the trigger is missing or unrecognized. Variant keys are the
 * descriptor's `<base>.manual` / `<base>.auto` siblings.
 */
function resolveCompactBody(
  descriptor: EventDescriptor,
  payload: ClaudeHookPayload,
  translator: Translator,
): string {
  const trigger = payload.trigger?.trim().toLowerCase();
  if (trigger === "manual" || trigger === "auto") {
    const key = `${baseKeyFor(descriptor.bodyKey)}.${trigger}`;
    if (translator.has(key)) return translator.t(key);
  }
  return translator.t(descriptor.bodyKey);
}

/** Maps a `*.fallback` body key to its `*.named` sibling (else appends `.named`). */
function namedKeyFor(bodyKey: string): string {
  return `${baseKeyFor(bodyKey)}.named`;
}

/** Strips a trailing `.fallback` segment to get the body key's base. */
function baseKeyFor(bodyKey: string): string {
  return bodyKey.endsWith(".fallback") ? bodyKey.slice(0, -".fallback".length) : bodyKey;
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
