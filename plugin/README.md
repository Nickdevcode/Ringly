# Ringly — plugin

Native cross-platform notifications for Claude Code, distributed as a Claude Code plugin.

This is the **plugin layer** of Ringly. It registers four hooks
(`Notification`, `Stop`, `StopFailure`, `SubagentStop`) and routes them to a shared
`dispatch.mjs` shim that:

1. Tries to delegate to the `ringly` Node.js package (richer translation, logs, config),
2. Falls back to spawning the `ringly` CLI binary if installed globally,
3. Falls back to an **embedded toast** so the plugin alone keeps working without the npm package.

See the top-level `README.md` of the [Ringly repository](https://github.com/nickdevcode/Ringly)
for full installation and configuration instructions.

## Configuration

This plugin exposes user-facing settings via the Claude Code plugin manager:

- `language`: `auto`, `pt-BR`, or `en-US`
- `events.notification` / `events.stop` / `events.stopFailure` / `events.subagentStop`
- `sound`: enables or disables notification sound
- `debug`: writes detailed logs

For the best experience, also install the optional CLI:

```bash
npm install -g ringly
ringly init
ringly doctor
```

## License

MIT — see `LICENSE` in the repository root.
