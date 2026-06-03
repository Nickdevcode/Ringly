import { buildDefaultChannels, dispatchToChannels } from "../channels/index.js";
import { mapEvent } from "./eventMapper.js";
import { EVENT_BY_NAME, type EventDescriptor } from "./events.js";
import { logger } from "./logger.js";
import { throttleGate, throttleKey } from "./throttle.js";
import { createTranslator } from "./translator.js";
import type {
  ClaudeHookEventName,
  ClaudeHookPayload,
  NotificationIntent,
  RinglyConfig,
  TaskProgress,
} from "./types.js";

export interface BuildIntentOptions {
  payload: ClaudeHookPayload;
  event: ClaudeHookEventName;
  config: RinglyConfig;
  /** Per-session task progress for the `TaskCompleted` counter (optional). */
  progress?: TaskProgress | undefined;
}

export function buildIntent(options: BuildIntentOptions): NotificationIntent {
  const translator = createTranslator(options.config.language);
  const projectDir = process.env["CLAUDE_PROJECT_DIR"];
  return mapEvent({
    payload: options.payload,
    event: options.event,
    translator,
    soundEnabled: options.config.sound,
    projectDirOverride: projectDir,
    progress: options.progress,
  });
}

export function isEventEnabled(event: ClaudeHookEventName, config: RinglyConfig): boolean {
  return config.events[EVENT_BY_NAME[event].configKey] === true;
}

/**
 * Whether `TaskCreated` should be folded into the progress tally even though it
 * won't show a toast. The `TaskCompleted` counter (e.g. "2/4") needs to know how
 * many tasks the checklist was CREATED with — its denominator. But `TaskCreated`
 * is off by default (it would otherwise spam a toast per created task), and the
 * tally used to sit behind the same enabled-gate as the toast. The upshot was a
 * denominator that only ever saw completions, so the counter read 1/1, 2/2,
 * 3/3 instead of 1/4, 2/4, 3/4. So: whenever the counter itself is enabled
 * (`TaskCompleted` on), we still RECORD creations — silently, no toast — so the
 * denominator is correct. Creation toasts remain gated on `taskCreated`.
 */
function shouldRecordCreationSilently(event: ClaudeHookEventName, config: RinglyConfig): boolean {
  return (
    event === "TaskCreated" &&
    !isEventEnabled("TaskCreated", config) &&
    isEventEnabled("TaskCompleted", config)
  );
}

export interface NotifyOptions {
  event: ClaudeHookEventName;
  payload: ClaudeHookPayload;
  config: RinglyConfig;
}

export async function notify(options: NotifyOptions): Promise<void> {
  const { event, payload, config } = options;

  if (!isEventEnabled(event, config)) {
    // The counter's denominator depends on recording creations even when the
    // creation toast is disabled — do that here, then stop (no toast).
    if (shouldRecordCreationSilently(event, config)) {
      const dataDir = await resolveDataDirForThrottle();
      if (dataDir) await recordTaskProgress(dataDir, event, payload);
      return;
    }
    logger.debug("Event disabled by config; skipping", { event });
    return;
  }

  const intent = buildIntent({ event, payload, config });

  // Verbose (high-frequency) events are throttled/deduped so a busy session
  // can't flood the notification center. Non-verbose events (the original
  // four) skip this entirely and never touch the filesystem here.
  const descriptor = EVENT_BY_NAME[event];
  if (descriptor.verbose) {
    const dataDir = await resolveDataDirForThrottle();
    if (dataDir) {
      // Task events carry a session-global sequential `task_id`. We fold every
      // task event into per-checklist progress state (creations grow the total;
      // a creation after a completion starts a fresh checklist), but only
      // surface the counter on `TaskCompleted`. Recorded BEFORE the throttle
      // gate: a throttled completion must still count — throttling is anti-spam
      // for the toast, not for the tally.
      const recorded = await recordTaskProgress(dataDir, event, payload);
      const progress = event === "TaskCompleted" ? recorded : undefined;

      // Rebuild the intent only when we actually have a counter to show; the
      // common case keeps the single `buildIntent` above. (Cheap: no I/O,
      // just translator + mapper.)
      const effectiveIntent = progress ? buildIntent({ event, payload, config, progress }) : intent;

      // Dedup discriminant: for task events the identity is the task title
      // (so distinct tasks each notify), otherwise the agent name. This keeps
      // the per-task specificity the toast now shows from being collapsed away.
      const discriminant =
        descriptor.resolver === "taskNamed"
          ? (payload.task_subject ?? payload.task_description ?? null)
          : (payload.agent_type ?? null);
      const key = throttleKey(event, effectiveIntent.projectName, discriminant);
      if (!throttleGate(dataDir, key)) {
        logger.debug("Verbose event throttled; skipping", { event, key });
        return;
      }

      const channels = buildDefaultChannels({ appId: config.appId });
      await dispatchToChannels(effectiveIntent, channels);
      return;
    }
  }

  const channels = buildDefaultChannels({ appId: config.appId });
  await dispatchToChannels(intent, channels);
}

/**
 * Folds a task event into the per-session progress tally and returns the
 * resulting `{ completed, total }` (or undefined for non-task events / on any
 * failure — always fail-open). Both `TaskCreated` and `TaskCompleted` are
 * recorded so the counter's denominator reflects the whole checklist; the
 * caller decides when to actually SHOW the counter (only on completion).
 */
async function recordTaskProgress(
  dataDir: string,
  event: ClaudeHookEventName,
  payload: ClaudeHookPayload,
): Promise<TaskProgress | undefined> {
  const descriptor: EventDescriptor = EVENT_BY_NAME[event];
  if (descriptor.resolver !== "taskNamed" || !payload.session_id || !payload.task_id) {
    return undefined;
  }
  try {
    const { recordTask } = await import("./sessionProgress.js");
    return recordTask(
      dataDir,
      payload.session_id,
      payload.task_id,
      event === "TaskCompleted" ? "completed" : "created",
    );
  } catch {
    /* fail-open: notify without a counter */
    return undefined;
  }
}

/**
 * Resolves the throttle state dir cheaply for the hot path: `CLAUDE_PLUGIN_DATA`
 * is set whenever we run under Claude Code (the common case), so we read it
 * inline and never import `env-paths`. Only standalone CLI usage (no env var)
 * pays for the lazy `dataDir` import. Returns null if resolution fails — the
 * caller then notifies without throttling rather than dropping the toast.
 */
async function resolveDataDirForThrottle(): Promise<string | null> {
  const pluginData = process.env["CLAUDE_PLUGIN_DATA"];
  if (pluginData && pluginData.trim().length > 0) return pluginData;
  try {
    const { resolveDataDir } = await import("./dataDir.js");
    return resolveDataDir();
  } catch {
    return null;
  }
}
