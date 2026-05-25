import { runHook } from "./commands/hook.js";
import { logger } from "./core/logger.js";
import type { ClaudeHookEventName } from "./core/types.js";

const ALLOWED: ReadonlySet<ClaudeHookEventName> = new Set([
  "Notification",
  "Stop",
  "StopFailure",
  "SubagentStop",
]);

function parseForcedEvent(): ClaudeHookEventName | undefined {
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg) continue;
    if (ALLOWED.has(arg as ClaudeHookEventName)) return arg as ClaudeHookEventName;
  }
  return undefined;
}

const forcedEvent = parseForcedEvent();

runHook(forcedEvent ? { forcedEvent } : {})
  .catch((err) => {
    logger.error("Hook fatal", { message: (err as Error).message });
  })
  .finally(() => {
    process.exit(0);
  });
