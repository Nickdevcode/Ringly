# Changelog

> Notas de versão / Release notes — formato baseado em [Keep a Changelog](https://keepachangelog.com/).
> Este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/) ([SemVer](https://semver.org/)).

---

## [0.2.1] — 2026-05-25

### 🇧🇷 Português

**Mudanças importantes**

- **Internacionalização completa da TUI e dos comandos CLI.** Antes, várias strings da interface (Welcome, LanguagePicker, HookPicker, SoundDebugPicker, AumidRegister, Done, ConfigDone) e dos comandos `doctor`, `uninstall`, `test`, `init --non-interactive` estavam hardcoded em inglês. Agora **toda a interface respeita o idioma escolhido** (pt-BR ou en-US). Durante o `ringly init`, a TUI sempre **começa em inglês** (decisão de design para apresentar uma interface previsível a qualquer usuário); assim que o usuário escolhe um idioma no LanguagePicker, **todas as telas seguintes mudam na hora**. Os comandos não-interativos leem o idioma da config salva e renderizam tudo no idioma correto.
- **Hooks agora leem `~/.claude/settings.json` diretamente.** Em todas as versões anteriores, o `dispatch.mjs` dependia de variáveis de ambiente `CLAUDE_PLUGIN_OPTION_*` que o Claude Code **não exporta** para hooks. Isso fazia com que toggles de idioma, eventos e som configurados pelo plugin manager fossem **silenciosamente ignorados**, e o fallback caía no `LANG` do SO (resultando, no Brasil, em notificações sempre em pt-BR mesmo com `en-US` selecionado). A v0.2.1 lê o `settings.json` diretamente em cada disparo, garantindo que toda configuração — idioma, eventos habilitados/desabilitados, som — funcione de fato.
- **Filtro de eventos agora é respeitado em todos os caminhos.** Antes, desligar `events_stop` via TUI/plugin manager não impedia que o `dispatch.mjs` continuasse disparando o fallback embedded — apenas o caminho "rico" (CLI Node) filtrava. Agora o filtro é aplicado **antes** de qualquer dispatch, em todos os caminhos.
- **`sound: false` agora silencia o fallback embedded.** O toast XML passa a usar `<audio silent="true"/>` quando o usuário desliga o som via `settings.json`. Antes, o som tocava mesmo com a config off.
- **Spawn `EINVAL` no Windows corrigido** no `tryCliBinary`: arquivos `.cmd`/`.bat` agora são executados com `shell: true`, permitindo que o caminho "rico" do CLI funcione no Windows. Antes, sempre caía no fallback embedded.
- **`tryNodeModule` agora tenta também o `npm root -g`** como segunda estratégia de resolução. Isso permite que o módulo `ringly/hook` seja encontrado mesmo quando o plugin está instalado em `~/.claude/plugins/cache/` (que não tem `node_modules`).
- **`loadConfig()` do CLI** agora prioriza `~/.claude/settings.json` sobre o `config.json` antigo do env-paths. O `config.json` continua sendo lido como fallback para instalações pré-0.2.x e ainda é escrito (junto com o `settings.json`) por compatibilidade. Em uma versão futura ele será removido.
- **`ringly test` sem `--lang`** agora respeita a config real do usuário (lendo do `settings.json`), em vez de sempre usar os defaults internos.

**Mudanças importantes (v0.2.0)**

- **`ringly config` agora escreve no `settings.json` do Claude Code** (em `pluginConfigs.ringly.options`) em vez do antigo `config.json` local. Isso corrige o bug em que mudar a config pelo CLI não refletia nas notificações reais, pois o plugin manager do Claude Code é a fonte de verdade. Backup automático com timestamp é criado antes de sobrescrever. A tela final agora avisa para rodar `/reload-plugins` no Claude Code.
- **Novo módulo `claudeSettings.ts`** abstrai leitura/escrita do `~/.claude/settings.json` com merge seguro (preserva `theme`, `hooks`, outros plugins, etc.).
- **`ringly doctor`** ganhou check separado para "Claude Code plugin settings" (com contagem de opções definidas e idioma ativo) além do antigo "Local configuration fallback".

**Corrigido**

- **Comando de instalação do marketplace** com sintaxe inválida. O prefixo `github:` não é aceito pelo Claude Code — o formato correto é `owner/repo`. Todas as referências em README, CHANGELOG, `ringly init` e `ringly config` foram atualizadas para `/plugin marketplace add nickdevcode/Ringly`.
- **`userConfig` do `plugin.json`** estava como array (`[...]`) e usava tipo `select`, ambos inválidos pelo schema oficial do Claude Code. Reescrito como objeto (`{...}`) com chaves planas (`events_notification`, `events_stop`, etc.) e tipos suportados (`string`, `boolean`). Adicionado campo `title` obrigatório em cada opção. Corrige o erro `userConfig: Invalid input: expected record, received array` ao instalar o plugin.
- **Tabela de configuração no README** estava com chaves no formato antigo (`events.notification`). Atualizada para refletir o `userConfig` real (`events_notification`, etc.). Também corrigido em `plugin/README.md`.
- **Documentação "Como funciona"** mencionava `node dispatch.mjs <Event>` direto, mas o `hooks.json` usa `command: "node"` + `args: [...]`. Comando documentado agora bate com o real.
- **`detectSystemLanguage`** considerava o valor `"auto"` como candidato válido na detecção de idioma, caindo no fallback `en-US` em vez de detectar pelo locale do SO. Agora ignora `"auto"` explicitamente.

**Adicionado**

- **Seção "Atualizando"** no README com o comando `npm install -g ringly@latest` e instruções para `/plugin marketplace update`.
- **Componentes reutilizáveis de TUI**: `Header` (com indicador de passo) e `Footer` (com atalhos de teclado) em `src/tui/components/`.
- **Banner ASCII** no `Welcome` da TUI do `ringly init`.
- **Ícones Unicode modernos** (`◉ ◯`) e emojis contextuais (`🔔 ✅ ⚠️ 🤖 🔊 🪵 🇧🇷 🇺🇸`) nas telas de seleção.
- **Cabeçalho visual com borda** em todos os comandos não-interativos (`doctor`, `uninstall`, `test`, `init --non-interactive`) usando box-drawing chars.
- **Resumo de checks** no final do `ringly doctor` (X passed · Y warnings · Z failed).

**Otimizado**

- **`logger.ts`** agora cacheia diretórios já criados, evitando chamadas redundantes de `mkdirSync` em cada `logger.debug/info/warn/error` (impacto perceptível em modo debug).
- **`AumidRegister` da TUI** reduziu o delay cosmético de 600ms para 300ms na transição final.

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

**Major fixes (v0.2.1)**

- **Full TUI and CLI internationalization.** Previously, several interface strings (Welcome, LanguagePicker, HookPicker, SoundDebugPicker, AumidRegister, Done, ConfigDone) and the `doctor`, `uninstall`, `test`, `init --non-interactive` commands were hardcoded in English. Now **the entire interface respects the chosen language** (pt-BR or en-US). During `ringly init`, the TUI always **starts in English** (design choice — every user gets a predictable starting point); the moment a language is selected on the LanguagePicker, **every subsequent screen switches on the fly**. Non-interactive commands read the saved language and render everything in the right language.
- **Hooks now read `~/.claude/settings.json` directly.** Every previous release had `dispatch.mjs` depend on `CLAUDE_PLUGIN_OPTION_*` environment variables that Claude Code **does not export** to hooks. That meant language, event, and sound toggles configured through the plugin manager were **silently ignored**, and the fallback ended up reading `LANG` from the OS (so Brazilian users always got pt-BR notifications even with `en-US` selected). v0.2.1 reads `settings.json` directly on every dispatch, so every config — language, enabled events, sound — actually works.
- **Event filter now respected on every path.** Previously, disabling `events_stop` from the TUI/plugin manager didn't stop `dispatch.mjs` from firing the embedded fallback — only the "rich" Node CLI path filtered. The filter now runs **before** any dispatch, on every path.
- **`sound: false` now silences the embedded fallback.** The toast XML now uses `<audio silent="true"/>` when the user disables sound via `settings.json`. Before, sound played anyway.
- **Windows `EINVAL` spawn fix** in `tryCliBinary`: `.cmd`/`.bat` files now run with `shell: true`, letting the rich CLI path actually work on Windows. Before, it always fell back to embedded.
- **`tryNodeModule` now also tries `npm root -g`** as a second resolution strategy, so `ringly/hook` is found even when the plugin lives in `~/.claude/plugins/cache/` (which has no `node_modules`).
- **CLI `loadConfig()`** now prefers `~/.claude/settings.json` over the legacy env-paths `config.json`. The local `config.json` is still read as a fallback for pre-0.2.x installs and is still written (alongside `settings.json`) for compatibility. It will be removed in a future release.
- **`ringly test` without `--lang`** now uses the user's actual config (from `settings.json`), instead of always falling back to internal defaults.

**Breaking changes (v0.2.0)**

- **`ringly config` now writes to Claude Code's `settings.json`** (under `pluginConfigs.ringly.options`) instead of the old local `config.json`. This fixes the bug where changing the config via the CLI didn't reflect in real notifications, because the Claude Code plugin manager is the source of truth. An automatic timestamped backup is created before overwriting. The final screen now reminds you to run `/reload-plugins` inside Claude Code.
- **New `claudeSettings.ts` module** abstracts reading/writing `~/.claude/settings.json` with safe merging (preserves `theme`, `hooks`, other plugins, etc.).
- **`ringly doctor`** now has a separate check for "Claude Code plugin settings" (with count of defined options and active language) alongside the older "Local configuration fallback" check.

**Fixed**

- **Marketplace install command** had invalid syntax. The `github:` prefix is not accepted by Claude Code — the correct format is `owner/repo`. All references in README, CHANGELOG, `ringly init`, and `ringly config` were updated to `/plugin marketplace add nickdevcode/Ringly`.
- **`userConfig` in `plugin.json`** was declared as an array (`[...]`) and used the `select` type — both invalid per the official Claude Code schema. Rewritten as an object (`{...}`) with flat keys (`events_notification`, `events_stop`, etc.) and supported types (`string`, `boolean`). Added the required `title` field on every option. Fixes the `userConfig: Invalid input: expected record, received array` error during plugin install.
- **Configuration table in the README** still showed the old key format (`events.notification`). Updated to match the actual `userConfig` (`events_notification`, etc.). Also fixed in `plugin/README.md`.
- **"How it works" documentation** described `node dispatch.mjs <Event>`, but `hooks.json` uses `command: "node"` + `args: [...]`. Documented command now matches the real one.
- **`detectSystemLanguage`** was treating the value `"auto"` as a valid candidate during language detection, falling back to `en-US` instead of resolving from the system locale. Now explicitly ignores `"auto"`.

**Added**

- **"Updating" section** in the README with the `npm install -g ringly@latest` command and instructions for `/plugin marketplace update`.
- **Reusable TUI components**: `Header` (with step indicator) and `Footer` (with keyboard hints) in `src/tui/components/`.
- **ASCII banner** in the `Welcome` screen of `ringly init`.
- **Modern Unicode icons** (`◉ ◯`) and contextual emojis (`🔔 ✅ ⚠️ 🤖 🔊 🪵 🇧🇷 🇺🇸`) across selection screens.
- **Visual header with border** on every non-interactive command (`doctor`, `uninstall`, `test`, `init --non-interactive`) using box-drawing chars.
- **Check summary** at the end of `ringly doctor` (X passed · Y warnings · Z failed).

**Optimized**

- **`logger.ts`** now caches already-created directories, avoiding redundant `mkdirSync` calls on every `logger.debug/info/warn/error` (noticeable impact in debug mode).
- **`AumidRegister` TUI** reduced the cosmetic delay from 600ms to 300ms on the final transition.

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

[Unreleased]: https://github.com/nickdevcode/Ringly/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/nickdevcode/Ringly/releases/tag/v0.2.1
[0.2.0]: https://github.com/nickdevcode/Ringly/releases/tag/v0.2.0
[0.1.1]: https://github.com/nickdevcode/Ringly/releases/tag/v0.1.1
[0.1.0]: https://github.com/nickdevcode/Ringly/releases/tag/v0.1.0
