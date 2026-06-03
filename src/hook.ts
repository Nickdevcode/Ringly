import { runHook } from "./commands/hook.js";
import { runUpdateCheckHook } from "./commands/updateCheckHook.js";
import { ALLOWED_EVENT_NAMES } from "./core/events.js";
import { logger } from "./core/logger.js";
import type { ClaudeHookEventName } from "./core/types.js";

const SESSION_START = "SessionStart";

type ForcedEvent = ClaudeHookEventName | typeof SESSION_START;

// Validation is driven by the event registry (single source of truth via
// `ALLOWED_EVENT_NAMES`) so every event — including the verbose ones
// (SubagentStart, TaskCreated, TaskCompleted, PreCompact, PostCompact) — is
// recognized when `plugin/hooks/dispatch.mjs` passes it as an argv token. A
// hardcoded subset here previously dropped the newer events onto the stdin
// fallback. `SessionStart` is deliberately not in the registry, so it is
// matched explicitly below.
function parseForcedEvent(): ForcedEvent | undefined {
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg) continue;
    if (arg === SESSION_START) return SESSION_START;
    if (ALLOWED_EVENT_NAMES.has(arg)) {
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
