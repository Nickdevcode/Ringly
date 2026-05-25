import { buildDefaultChannels, dispatchToChannels } from "../channels/index.js";
import { mapEvent } from "./eventMapper.js";
import { logger } from "./logger.js";
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
  switch (event) {
    case "Notification":
      return config.events.notification;
    case "Stop":
      return config.events.stop;
    case "StopFailure":
      return config.events.stopFailure;
    case "SubagentStop":
      return config.events.subagentStop;
  }
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

  const channels = buildDefaultChannels({ appId: options.config.appId });
  await dispatchToChannels(intent, channels);
}
