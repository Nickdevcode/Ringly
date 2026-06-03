import { buildDefaultChannels, dispatchToChannels } from "../channels/index.js";
import { mapEvent } from "./eventMapper.js";
import { EVENT_BY_NAME } from "./events.js";
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

export interface NotifyOptions {
  event: ClaudeHookEventName;
  payload: ClaudeHookPayload;
  config: RinglyConfig;
}

export async function notify(options: NotifyOptions): Promise<void> {
  if (!isEventEnabled(options.event, options.config)) {
    logger.debug("Event disabled by config; skipping", { event: options.event });
    return;
  }

  const intent = buildIntent({
    event: options.event,
    payload: options.payload,
    config: options.config,
  });

  // Verbose (high-frequency) events are throttled/deduped so a busy session
  // can't flood the notification center. Non-verbose events (the original
  // four) skip this entirely and never touch the filesystem here.
  const descriptor = EVENT_BY_NAME[options.event];
  if (descriptor.verbose) {
    const dataDir = await resolveDataDirForThrottle();
    if (dataDir) {
      // Task events carry a per-session sequential `task_id`. We fold every
      // task event into per-session progress state (so `maxId`/the total grows
      // as tasks appear), but only surface the counter on `TaskCompleted`.
      // Recorded BEFORE the throttle gate: a throttled completion must still
      // count — throttling is anti-spam for the toast, not for the tally.
      let progress: TaskProgress | undefined;
      const { payload, event } = options;
      if (descriptor.resolver === "taskNamed" && payload.session_id && payload.task_id) {
        try {
          const { recordTask } = await import("./sessionProgress.js");
          const recorded = recordTask(
            dataDir,
            payload.session_id,
            payload.task_id,
            event === "TaskCompleted",
          );
          if (event === "TaskCompleted") progress = recorded;
        } catch {
          /* fail-open: notify without a counter */
        }
      }

      // Rebuild the intent only when we actually have a counter to show; the
      // common case keeps the single `buildIntent` above. (Cheap: no I/O,
      // just translator + mapper.)
      const effectiveIntent = progress
        ? buildIntent({ event, payload, config: options.config, progress })
        : intent;

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

      const channels = buildDefaultChannels({ appId: options.config.appId });
      await dispatchToChannels(effectiveIntent, channels);
      return;
    }
  }

  const channels = buildDefaultChannels({ appId: options.config.appId });
  await dispatchToChannels(intent, channels);
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
