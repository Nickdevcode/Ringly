import { applyEnvOverrides, loadConfig } from "../core/config.js";
import { logger } from "../core/logger.js";
import { notify } from "../core/notifier.js";
import { readStdin, tryParseJson } from "../core/stdin.js";
import type { ClaudeHookEventName, ClaudeHookPayload } from "../core/types.js";

const ALLOWED_EVENTS: ReadonlySet<ClaudeHookEventName> = new Set([
  "Notification",
  "Stop",
  "StopFailure",
  "SubagentStop",
]);

export interface RunHookOptions {
  forcedEvent?: ClaudeHookEventName | undefined;
}

export async function runHook(options: RunHookOptions = {}): Promise<void> {
  try {
    const raw = await readStdin({ timeoutMs: 4000 });
    const payload = (tryParseJson<ClaudeHookPayload>(raw) ?? {}) as ClaudeHookPayload;

    const event = pickEvent(options.forcedEvent, payload);
    if (!event) {
      logger.warn("Hook invoked without a recognizable event", { argv: process.argv });
      return;
    }

    const baseConfig = loadConfig();
    const config = applyEnvOverrides(baseConfig);

    if (config.debug) {
      process.env["RINGLY_DEBUG"] = "1";
    }

    logger.debug("Hook payload received", { event, payload });

    await notify({ event, payload, config });
  } catch (err) {
    logger.error("Hook fatal error (suppressed)", {
      message: (err as Error).message,
      stack: (err as Error).stack,
    });
  }
}

function pickEvent(
  forced: ClaudeHookEventName | undefined,
  payload: ClaudeHookPayload,
): ClaudeHookEventName | null {
  if (forced && ALLOWED_EVENTS.has(forced)) return forced;
  const fromPayload = payload.hook_event_name;
  if (fromPayload && ALLOWED_EVENTS.has(fromPayload)) return fromPayload;
  return null;
}
