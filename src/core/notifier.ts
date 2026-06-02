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
} from "./types.js";

export interface BuildIntentOptions {
  payload: ClaudeHookPayload;
  event: ClaudeHookEventName;
  config: RinglyConfig;
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
  if (EVENT_BY_NAME[options.event].verbose) {
    const dataDir = await resolveDataDirForThrottle();
    if (dataDir) {
      const key = throttleKey(
        options.event,
        intent.projectName,
        options.payload.agent_type ?? null,
      );
      if (!throttleGate(dataDir, key)) {
        logger.debug("Verbose event throttled; skipping", { event: options.event, key });
        return;
      }
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
