# Ringly — plugin

Native cross-platform notifications for Claude Code, distributed as a Claude Code plugin.

This is the **plugin layer** of Ringly. It registers five hooks
(`SessionStart`, `Notification`, `Stop`, `StopFailure`, `SubagentStop`) and routes
them to a shared `dispatch.mjs` shim that:

1. Tries to delegate to the `ringly` Node.js package (richer translation, logs, config),
2. Falls back to spawning the `ringly` CLI binary if installed globally,
3. Falls back to an **embedded toast** as a last resort (notification events only).

The plugin also ships a slash command — `/ringly-update` — that lets you check
for and install a newer Ringly release without leaving Claude Code. A
once-a-day check runs in the background on `SessionStart` and fires a native
toast when a new version is available on npm.

> ⚠️ **This plugin is not standalone.** On Windows 10/11, the
> `ToastNotificationManager` only displays toasts from apps with a registered
> AUMID, and that registration is performed exclusively by `ringly init` (from
> the companion npm package). Installing only the plugin will at best play a
> fallback beep. Always install the CLI first — see the repository README for
> the full two-step flow.

See the top-level `README.md` of the [Ringly repository](https://github.com/nickdevcode/Ringly)
for full installation and configuration instructions.

## Configuration

This plugin exposes user-facing settings via the Claude Code plugin manager. Every option
is stored in `~/.claude/settings.json` under `pluginConfigs.ringly.options` and is read
by the dispatcher on every hook invocation — no restart required.

- `language`: `auto`, `pt-BR`, or `en-US`
- `events_notification` / `events_stop` / `events_stopFailure` / `events_subagentStop`: toggle each hook
- `sound`: enables or disables notification sound
- `debug`: writes detailed logs
- `check_updates`: enables the once-a-day npm check + update toast (default `true`)

### Required companion CLI

Install **before** the plugin so the AUMID is in place by the time the first
hook fires:

```bash
npm install -g ringly
ringly init
ringly doctor
```

## License

MIT — see `LICENSE` in the repository root.
