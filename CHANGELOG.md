# Changelog

> Notas de versão / Release notes — formato baseado em [Keep a Changelog](https://keepachangelog.com/).
> Este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/) ([SemVer](https://semver.org/)).

---

## [Unreleased]

### 🇧🇷 Português

**Corrigido**

- **Comando de instalação do marketplace** com sintaxe inválida. O prefixo `github:` não é aceito pelo Claude Code — o formato correto é `owner/repo`. Todas as referências em README, CHANGELOG, `ringly init` e `ringly config` foram atualizadas para `/plugin marketplace add nickdevcode/Ringly`.
- **`userConfig` do `plugin.json`** estava como array (`[...]`) e usava tipo `select`, ambos inválidos pelo schema oficial do Claude Code. Reescrito como objeto (`{...}`) com chaves planas (`events_notification`, `events_stop`, etc.) e tipos suportados (`string`, `boolean`). Adicionado campo `title` obrigatório em cada opção. Corrige o erro `userConfig: Invalid input: expected record, received array` ao instalar o plugin.

**Adicionado**

- **Detecção e migração do sistema PowerShell antigo** (`notify-toast.ps1` em `~/.claude/hooks/`). O `doctor` agora identifica hooks/scripts legados e o `init` exibe um aviso amarelo.
- **`ringly init --migrate-legacy`** — remove os hooks antigos (com backup automático) antes de iniciar o setup novo.
- **`ringly uninstall --legacy`** — limpa também o sistema antigo (com backup do `settings.json` e dos scripts `.ps1`).
- Endurecimento de segurança no `dispatch.mjs`: remoção do `shell: true` no spawn (agora resolve via `where`/`which` + path absoluto).
- Cobertura de testes ampliada (34 testes, +5 cobrindo o módulo `legacy.ts`).
- **Comentários profissionais** no código fonte para facilitar contribuições externas.

### Planejado

- Suporte nativo a macOS (osascript / `NSUserNotification`)
- Suporte nativo a Linux (`notify-send` / DBus)
- Canal de webhook genérico (Discord, Slack, Telegram, Teams)
- Som customizado por evento (arquivos `.wav` do usuário)
- Modo "horário silencioso" (não notifica entre HH:MM e HH:MM)
- Submissão ao marketplace oficial `claude-community`

### 🇺🇸 English

**Fixed**

- **Marketplace install command** had invalid syntax. The `github:` prefix is not accepted by Claude Code — the correct format is `owner/repo`. All references in README, CHANGELOG, `ringly init`, and `ringly config` were updated to `/plugin marketplace add nickdevcode/Ringly`.
- **`userConfig` in `plugin.json`** was declared as an array (`[...]`) and used the `select` type — both invalid per the official Claude Code schema. Rewritten as an object (`{...}`) with flat keys (`events_notification`, `events_stop`, etc.) and supported types (`string`, `boolean`). Added the required `title` field on every option. Fixes the `userConfig: Invalid input: expected record, received array` error during plugin install.

**Added**

- **Legacy PowerShell system detection and migration** (`notify-toast.ps1` in `~/.claude/hooks/`). `doctor` now flags legacy hooks/scripts and `init` shows a yellow warning.
- **`ringly init --migrate-legacy`** — removes legacy hooks (with automatic backup) before fresh setup.
- **`ringly uninstall --legacy`** — also cleans up the legacy system (backs up `settings.json` and `.ps1` scripts).
- Security hardening in `dispatch.mjs`: removed `shell: true` from `spawn` (now resolves via `where`/`which` + absolute path).
- Test coverage expanded (34 tests total, +5 covering the `legacy.ts` module).
- **Professional comments** added across the source code to help external contributors.

### Planned

- Native macOS support (osascript / `NSUserNotification`)
- Native Linux support (`notify-send` / DBus)
- Generic webhook channel (Discord, Slack, Telegram, Teams)
- Custom per-event sound (user `.wav` files)
- "Quiet hours" mode (no notifications between HH:MM and HH:MM)
- Submission to the official `claude-community` marketplace

---

## [0.1.0] — 2026-05-25

### 🇧🇷 Português

Primeira versão pública. Suporte completo a Windows 11 com tradução pt-BR / en-US.

**Adicionado**

- **Plugin Claude Code** instalável via `/plugin marketplace add nickdevcode/Ringly`
- **CLI npm** `ringly` com os comandos `init`, `config`, `doctor`, `test`, `uninstall`, `hook`
- **Toast nativo Windows 11** via WinRT (`ToastNotificationManager`) com AUMID `Claude.Code.CLI`
- **Quatro hooks suportados**: `Notification`, `Stop`, `StopFailure`, `SubagentStop`
- **Internacionalização (i18n)** com `pt-BR` e `en-US` (auto-detect pelo locale do sistema)
- **TUI interativa** (Ink/React) para o `ringly init` — escolha de idioma, eventos, som, debug
- **`userConfig` no plugin.json** — UI nativa do Claude Code para alterar configuração
- **Modo embedded** no `dispatch.mjs` — o plugin funciona mesmo sem o npm instalado
- **Diagnóstico (`ringly doctor`)** — checa Node, PowerShell, AUMID, config, executável do Claude Code
- **Falha silenciosa** — qualquer erro vira log; o hook sempre retorna `exit 0` para nunca quebrar o Claude Code
- **Logs persistidos** em `${CLAUDE_PLUGIN_DATA}` (quando rodando como plugin) ou no diretório padrão do SO
- **Suporte a paths padrão por SO**: `%APPDATA%\ringly` (Windows), `~/Library/Application Support/ringly` (macOS), `~/.config/ringly` (Linux)
- **GitHub Actions** com lint, typecheck, testes e build em matriz `[windows, macos, ubuntu] × [Node 20, 22]`
- **Workflow de release** publica no npm com `--provenance` em cada tag `v*.*.*`
- **Stubs de macOS / Linux** prontos para implementação futura sem refactor

**Arquitetura**

- Stack: **Node.js 20+** + **TypeScript 6** + **ESM**
- Bundle dual com **tsup** (esbuild): `dist/cli.{js,cjs}` (~72 KB) e `dist/hook.{js,cjs}` (~20 KB)
- Cold start do hook em ~80 ms (sem React/Ink no caminho crítico)
- 29 testes unitários (Vitest) cobrindo `eventMapper`, `translator`, `xml`, `config`
- Lint e format via **Biome 2**

### 🇺🇸 English

First public release. Full Windows 11 support with pt-BR / en-US translation.

**Added**

- **Claude Code plugin** installable via `/plugin marketplace add nickdevcode/Ringly`
- **`ringly` npm CLI** with commands `init`, `config`, `doctor`, `test`, `uninstall`, `hook`
- **Native Windows 11 toast** via WinRT (`ToastNotificationManager`) using AUMID `Claude.Code.CLI`
- **Four supported hooks**: `Notification`, `Stop`, `StopFailure`, `SubagentStop`
- **Internationalization (i18n)** with `pt-BR` and `en-US` (auto-detects system locale)
- **Interactive TUI** (Ink/React) for `ringly init` — language, events, sound, and debug pickers
- **`userConfig` in plugin.json** — native Claude Code UI to manage configuration
- **Embedded mode** in `dispatch.mjs` — the plugin keeps working without the npm CLI
- **Diagnostics (`ringly doctor`)** — checks Node, PowerShell, AUMID, config, Claude Code executable
- **Silent failure** — every error is logged; the hook always exits `0` so it never breaks Claude Code
- **Persisted logs** under `${CLAUDE_PLUGIN_DATA}` (when running as a plugin) or the OS standard log path
- **OS-standard paths**: `%APPDATA%\ringly` (Windows), `~/Library/Application Support/ringly` (macOS), `~/.config/ringly` (Linux)
- **GitHub Actions** with lint, typecheck, tests, and build across `[windows, macos, ubuntu] × [Node 20, 22]`
- **Release workflow** publishes to npm with `--provenance` on each `v*.*.*` tag
- **macOS / Linux stubs** ready for future implementation without refactoring

**Architecture**

- Stack: **Node.js 20+** + **TypeScript 6** + **ESM**
- Dual bundle with **tsup** (esbuild): `dist/cli.{js,cjs}` (~72 KB) and `dist/hook.{js,cjs}` (~20 KB)
- Hook cold start around 80 ms (no React/Ink on the hot path)
- 29 unit tests (Vitest) covering `eventMapper`, `translator`, `xml`, `config`
- Lint and format via **Biome 2**

---

[Unreleased]: https://github.com/nickdevcode/Ringly/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nickdevcode/Ringly/releases/tag/v0.1.0
