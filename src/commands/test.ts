import { buildDefaultChannels, dispatchToChannels } from "../channels/index.js";
import { DEFAULT_CONFIG } from "../core/config.js";
import { logger } from "../core/logger.js";
import { buildIntent } from "../core/notifier.js";
import { createTranslator } from "../core/translator.js";
import type {
  ClaudeHookEventName,
  ClaudeHookPayload,
  LanguageSetting,
  NotificationIntent,
} from "../core/types.js";

export interface RunTestOptions {
  event: ClaudeHookEventName;
  lang: LanguageSetting;
  title?: string | undefined;
  body?: string | undefined;
  silent: boolean;
}

const SAMPLE_PAYLOADS: Record<ClaudeHookEventName, ClaudeHookPayload> = {
  Notification: {
    hook_event_name: "Notification",
    message: "Claude needs your permission to use Bash",
  },
  Stop: {
    hook_event_name: "Stop",
  },
  StopFailure: {
    hook_event_name: "StopFailure",
    error_type: "rate_limit",
    message: "Rate limit exceeded",
  },
  SubagentStop: {
    hook_event_name: "SubagentStop",
    agent_type: "gsd-executor",
  },
};

export async function runTest(options: RunTestOptions): Promise<void> {
  const config = { ...DEFAULT_CONFIG, language: options.lang, sound: !options.silent };
  const translator = createTranslator(options.lang);
  const payload = SAMPLE_PAYLOADS[options.event];

  let intent: NotificationIntent = buildIntent({
    payload,
    event: options.event,
    config,
  });

  if (options.title) intent = { ...intent, title: options.title };
  if (options.body) intent = { ...intent, body: options.body };

  logger.info("Running test toast", {
    event: intent.event,
    lang: translator.language,
    title: intent.title,
  });

  console.log(translator.t("test.intro"));
  console.log(`  ${intent.title}`);
  console.log(`  ${intent.body}`);

  const channels = buildDefaultChannels({ appId: config.appId });
  await dispatchToChannels(intent, channels);

  console.log("");
  console.log(translator.t("test.done"));
  console.log(`Log: ${logger.getLogFile()}`);
}
