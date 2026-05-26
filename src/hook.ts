import { runHook } from "./commands/hook.js";
import { runUpdateCheckHook } from "./commands/updateCheckHook.js";
import { logger } from "./core/logger.js";
import type { ClaudeHookEventName } from "./core/types.js";

const NOTIFICATION_EVENTS: ReadonlySet<ClaudeHookEventName> = new Set([
  "Notification",
  "Stop",
  "StopFailure",
  "SubagentStop",
]);

const SESSION_START = "SessionStart";

type ForcedEvent = ClaudeHookEventName | typeof SESSION_START;

function parseForcedEvent(): ForcedEvent | undefined {
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg) continue;
    if (arg === SESSION_START) return SESSION_START;
    if (NOTIFICATION_EVENTS.has(arg as ClaudeHookEventName)) {
      return arg as ClaudeHookEventName;
    }
  }
  return undefined;
}

async function main(forced: ForcedEvent | undefined): Promise<void> {
  if (forced === SESSION_START) {
    await runUpdateCheckHook();
    return;
  }
  await runHook(forced ? { forcedEvent: forced } : {});
}

main(parseForcedEvent())
  .catch((err) => {
    logger.error("Hook fatal", { message: (err as Error).message });
  })
  .finally(() => {
    process.exit(0);
  });
