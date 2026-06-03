/**
 * Lightweight, dependency-free coercion of the hook payload that arrives
 * via stdin. We avoid pulling in zod/ajv (~50 KB to the hot path bundle)
 * because the payload shape is small and the validation rules are simple.
 *
 * Limits below are intentionally tight: real Claude Code payloads are
 * <2 KB and contain short fields. Anything beyond these limits is either
 * a misuse or a probe — we truncate instead of failing so the hook
 * stays best-effort, and we discard unknown fields entirely to avoid
 * accidentally surfacing them in toast text or logs.
 */
import { ALLOWED_EVENT_NAMES } from "./events.js";
import type { ClaudeHookEventName, ClaudeHookPayload } from "./types.js";

// 500 chars is enough for any human-readable error/message we render in a
// toast body; 1024 covers realistic file paths even on deep WSL/macOS trees.
const MAX_STRING_LENGTH = 500;
const MAX_PATH_LENGTH = 1024;
// Task ids are short tokens ("1", "2", …); cap tightly to reject anything odd.
const MAX_ID_LENGTH = 64;

function coerceString(value: unknown, maxLength: number = MAX_STRING_LENGTH): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length === 0) return undefined;
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength);
}

function coerceEvent(value: unknown): ClaudeHookEventName | undefined {
  if (typeof value !== "string") return undefined;
  if (!ALLOWED_EVENT_NAMES.has(value)) return undefined;
  return value as ClaudeHookEventName;
}

export function coerceClaudeHookPayload(raw: unknown): ClaudeHookPayload {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;

  const result: ClaudeHookPayload = {};

  const event = coerceEvent(obj.hook_event_name);
  if (event) result.hook_event_name = event;

  const cwd = coerceString(obj.cwd, MAX_PATH_LENGTH);
  if (cwd) result.cwd = cwd;

  const message = coerceString(obj.message);
  if (message) result.message = message;

  const agentType = coerceString(obj.agent_type);
  if (agentType) result.agent_type = agentType;

  const errorType = coerceString(obj.error_type);
  if (errorType) result.error_type = errorType;

  const notificationType = coerceString(obj.notification_type);
  if (notificationType) result.notification_type = notificationType;

  const typeField = coerceString(obj.type);
  if (typeField) result.type = typeField;

  const error = coerceString(obj.error);
  if (error) result.error = error;

  const sessionId = coerceString(obj.session_id);
  if (sessionId) result.session_id = sessionId;

  const transcriptPath = coerceString(obj.transcript_path, MAX_PATH_LENGTH);
  if (transcriptPath) result.transcript_path = transcriptPath;

  const trigger = coerceString(obj.trigger);
  if (trigger) result.trigger = trigger;

  const taskSubject = coerceString(obj.task_subject);
  if (taskSubject) result.task_subject = taskSubject;

  const taskDescription = coerceString(obj.task_description);
  if (taskDescription) result.task_description = taskDescription;

  const taskId = coerceString(obj.task_id, MAX_ID_LENGTH);
  if (taskId) result.task_id = taskId;

  return result;
}
