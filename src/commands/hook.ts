import { applyEnvOverrides, loadConfig } from "../core/config.js";
import { ALLOWED_EVENT_NAMES } from "../core/events.js";
import { logger } from "../core/logger.js";
import { notify } from "../core/notifier.js";
import { coerceClaudeHookPayload } from "../core/payloadGuards.js";
import { readStdin, tryParseJson } from "../core/stdin.js";
import type { ClaudeHookEventName, ClaudeHookPayload } from "../core/types.js";

export interface RunHookOptions {
  forcedEvent?: ClaudeHookEventName | undefined;
}

/**
 * Hot path for Claude Code hooks. Every failure is swallowed and logged
 * via `logger.error`; the process always exits 0 (see `src/hook.ts`).
 * This is intentional — a non-zero exit here would surface as a hook
 * failure inside Claude Code and disrupt the user's session, which is
 * a worse outcome than a missing notification. Diagnose issues via
 * `ringly.log` instead of exit codes.
 */
export async function runHook(options: RunHookOptions = {}): Promise<void> {
  try {
    const raw = await readStdin({ timeoutMs: 4000 });
    const parsed = tryParseJson<unknown>(raw);
    const payload: ClaudeHookPayload = coerceClaudeHookPayload(parsed);

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
  if (forced && ALLOWED_EVENT_NAMES.has(forced)) return forced;
  const fromPayload = payload.hook_event_name;
  if (fromPayload && ALLOWED_EVENT_NAMES.has(fromPayload)) return fromPayload;
  return null;
}
