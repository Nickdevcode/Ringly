/**
 * Event registry — the single source of truth for every Claude Code hook
 * event Ringly turns into a notification.
 *
 * Adding a new notification used to mean editing ~16 coupled spots (union
 * types, switches, Sets, fixed config objects, the TUI list, the standalone
 * `dispatch.mjs`, …). This module collapses all of that: each event is one
 * `EventDescriptor` entry in `EVENTS`, and every consumer derives its data
 * from here (the union type, defaults, settings read/write, the event→intent
 * mapping, the allow-list, the TUI rows, sample payloads, and — via build-time
 * codegen — the plugin fallback).
 *
 * IMPORTANT — this module is on the hook hot path. It is imported by
 * `notifier.ts`, `eventMapper.ts`, `config.ts`, `claudeSettings.ts`,
 * `payloadGuards.ts` and `hook.ts`, all of which ship in `dist/hook.{js,cjs}`.
 * So it MUST stay pure: type/data declarations + tiny pure helpers only.
 * No `fs`, no `chalk`, no React, and never import the settings/config
 * write-path. It may import only from `./types.js`.
 *
 * `SessionStart` is deliberately NOT in this registry — it is not a
 * notification. It triggers the throttled npm update check and is routed
 * separately in `cli.ts` and `plugin/hooks/dispatch.mjs` (the `check_updates`
 * option). Adding it here would break update checks.
 */
import type { NotificationSeverity, ToastSoundName } from "./types.js";

/**
 * How `eventMapper` resolves the notification body for an event:
 *  - `"notification"` — parse `message`/`notification_type` (permission, idle, …).
 *  - `"stopFailure"`  — parse `error_type`/`message` into a friendly API-error line.
 *  - `"agentNamed"`   — show `agent_type` if present, else the plain fallback
 *                       (uses `<bodyKey>` for the fallback and the sibling
 *                       `<…>.named` key for the named variant).
 *  - `"compact"`      — pick the body by `trigger` (`manual`/`auto`), falling
 *                       back to `<bodyKey>` when absent (uses the sibling
 *                       `<…>.manual` / `<…>.auto` keys).
 *  - omitted          — plain `projectPrefix + t(bodyKey)`.
 */
export type EventResolver = "notification" | "stopFailure" | "agentNamed" | "compact";

/**
 * Which Windows toast `scenario` an event maps to. `reminder` keeps the toast
 * pre-expanded on screen until dismissed (good for compaction notices). Most
 * events use the implicit default. See `ps`/toast builder.
 */
export type EventScenario = "reminder" | "alarm";

export interface EventDescriptor {
  /** Canonical Claude Code event name (= argv token = `payload.hook_event_name`). */
  readonly name: string;
  /**
   * camelCase key. Drives: the `RinglyConfig.events` key, the i18n/env-var
   * suffix, and the persisted `events_<configKey>` field in settings.json.
   */
  readonly configKey: string;
  /** i18n key for the toast title. */
  readonly titleKey: string;
  /** i18n key for the body fallback. */
  readonly bodyKey: string;
  readonly severity: NotificationSeverity;
  readonly sound: ToastSoundName;
  /** Whether the event notifies out of the box. */
  readonly defaultEnabled: boolean;
  /**
   * High-frequency event: off by default and subject to throttle/dedup so a
   * busy session can't flood the notification center. The original four
   * events are all non-verbose and never touch the throttle on the hot path.
   */
  readonly verbose: boolean;
  /** Emoji shown for this event in the `ringly config` / `ringly init` TUI. */
  readonly icon: string;
  /** Body resolution strategy (see `EventResolver`). Omitted = plain fallback. */
  readonly resolver?: EventResolver;
  /** Windows toast scenario override (see `EventScenario`). Omitted = default. */
  readonly scenario?: EventScenario;
}

/**
 * The registry. Order here is the order events appear in the TUI.
 *
 * `as const satisfies readonly EventDescriptor[]` gives us BOTH the
 * literal-narrowed union (recovered below via indexed access) AND
 * compile-time validation that every entry is a well-formed descriptor.
 */
export const EVENTS = [
  {
    name: "Notification",
    configKey: "notification",
    titleKey: "title.notification",
    bodyKey: "body.notification.fallback",
    severity: "warning",
    sound: "Notification.Default",
    defaultEnabled: true,
    verbose: false,
    icon: "🔔",
    resolver: "notification",
  },
  {
    name: "Stop",
    configKey: "stop",
    titleKey: "title.stop",
    bodyKey: "body.stop",
    severity: "info",
    sound: "Notification.IM",
    defaultEnabled: true,
    verbose: false,
    icon: "✅",
  },
  {
    name: "StopFailure",
    configKey: "stopFailure",
    titleKey: "title.stopFailure",
    bodyKey: "body.stopFailure.fallback",
    severity: "error",
    sound: "Notification.Looping.Alarm2",
    defaultEnabled: true,
    verbose: false,
    icon: "⚠️ ",
    resolver: "stopFailure",
  },
  {
    name: "SubagentStop",
    configKey: "subagentStop",
    titleKey: "title.subagentStop",
    bodyKey: "body.subagentStop.fallback",
    severity: "info",
    sound: "Notification.IM",
    defaultEnabled: false,
    verbose: false,
    icon: "🤖",
    resolver: "agentNamed",
  },
  // --- Events added in this milestone. All OFF by default and `verbose`
  // (high-frequency), so they are opt-in and throttled. See `throttle.ts`.
  {
    name: "SubagentStart",
    configKey: "subagentStart",
    titleKey: "title.subagentStart",
    bodyKey: "body.subagentStart.fallback",
    severity: "info",
    sound: "Notification.IM",
    defaultEnabled: false,
    verbose: true,
    icon: "🚀",
    resolver: "agentNamed",
  },
  {
    name: "TaskCreated",
    configKey: "taskCreated",
    titleKey: "title.taskCreated",
    bodyKey: "body.taskCreated.fallback",
    severity: "info",
    sound: "Notification.IM",
    defaultEnabled: false,
    verbose: true,
    icon: "📝",
    resolver: "agentNamed",
  },
  {
    name: "TaskCompleted",
    configKey: "taskCompleted",
    titleKey: "title.taskCompleted",
    bodyKey: "body.taskCompleted.fallback",
    severity: "info",
    sound: "Notification.IM",
    defaultEnabled: false,
    verbose: true,
    icon: "🏁",
    resolver: "agentNamed",
  },
  {
    name: "PreCompact",
    configKey: "preCompact",
    titleKey: "title.preCompact",
    bodyKey: "body.preCompact.fallback",
    severity: "info",
    sound: "Notification.Reminder",
    defaultEnabled: false,
    verbose: true,
    icon: "🧹",
    resolver: "compact",
    scenario: "reminder",
  },
  {
    name: "PostCompact",
    configKey: "postCompact",
    titleKey: "title.postCompact",
    bodyKey: "body.postCompact.fallback",
    severity: "info",
    sound: "Notification.Reminder",
    defaultEnabled: false,
    verbose: true,
    icon: "✨",
    resolver: "compact",
  },
] as const satisfies readonly EventDescriptor[];

/** Union of every notification event name, narrowed from the registry. */
export type ClaudeHookEventName = (typeof EVENTS)[number]["name"];

/** Union of every event config key, narrowed from the registry. */
export type EventConfigKey = (typeof EVENTS)[number]["configKey"];

/** All event names, in registry order. */
export const EVENT_NAMES: readonly ClaudeHookEventName[] = EVENTS.map((e) => e.name);

/**
 * Descriptor lookup by canonical event name, preserving each entry's literal
 * type. Crucially `EVENT_BY_NAME[event].configKey` keeps its literal type
 * (a member of `EventConfigKey`), so consumers can index `RinglyConfig.events`
 * with it without a cast.
 */
type EventByName = { [E in (typeof EVENTS)[number] as E["name"]]: E };

export const EVENT_BY_NAME = Object.fromEntries(EVENTS.map((e) => [e.name, e])) as EventByName;

/** Fast membership test for incoming event names (replaces ad-hoc `ALLOWED_EVENTS` Sets). */
export const ALLOWED_EVENT_NAMES: ReadonlySet<string> = new Set(EVENT_NAMES);

/** The persisted settings.json field name for a config key (`events_<configKey>`). */
export function optionField(configKey: string): `events_${string}` {
  return `events_${configKey}`;
}

/** The env-var suffix for a config key (`CLAUDE_PLUGIN_OPTION_EVENTS_<SUFFIX>`). */
export function envSuffix(configKey: string): string {
  return configKey.toUpperCase();
}

/**
 * Builds the default `events` map from the registry. The single localized
 * `as` cast here keeps `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess`
 * happy without scattering casts across the codebase — every consumer that
 * needs default events calls this instead.
 */
export function buildDefaultEvents(): Record<EventConfigKey, boolean> {
  const out = {} as Record<EventConfigKey, boolean>;
  for (const e of EVENTS) {
    out[e.configKey as EventConfigKey] = e.defaultEnabled;
  }
  return out;
}
