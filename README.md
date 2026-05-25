# Ringly

> Notificações nativas cross-platform para o Claude Code, com tradução pt-BR / en-US.
>
> Native cross-platform notifications for Claude Code, with pt-BR / en-US translation.

[![CI](https://github.com/nickdevcode/Ringly/actions/workflows/ci.yml/badge.svg)](https://github.com/nickdevcode/Ringly/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ringly.svg)](https://www.npmjs.com/package/ringly)
[![license](https://img.shields.io/npm/l/ringly.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/ringly.svg)](https://nodejs.org/)

---

## Português 🇧🇷

O **Ringly** liga os hooks do Claude Code (`Notification`, `Stop`, `StopFailure`, `SubagentStop`)
a notificações nativas do sistema operacional, com mensagens traduzidas e contextualizadas
pelo nome do projeto. Você nunca mais precisa ficar olhando o terminal pra saber o que o
Claude está esperando de você.

O projeto é distribuído em **duas camadas complementares**:

- **Plugin do Claude Code** (`/plugin install ringly@ringly`) — registra os hooks e traz
  um fallback embutido para que as notificações funcionem mesmo sem nenhuma dependência
  Node.js extra.
- **Pacote npm `ringly`** — adiciona um instalador interativo (`ringly init`), um
  diagnóstico (`ringly doctor`) e o motor de tradução completo.

Pra melhor experiência, instale os dois.

### Status

O Ringly está em desenvolvimento ativo. **Windows 11** é o alvo suportado para a v1.0.
macOS e Linux têm os back-ends estruturados e estão planejados para a próxima versão.

| Recurso          | Windows 11 | macOS | Linux |
| ---------------- | :--------: | :---: | :---: |
| Toast nativo     |     ✓      |  ⏳   |  ⏳   |
| Som de fallback  |     ✓      |  ⏳   |  ⏳   |
| Registro AUMID   |     ✓      |   —   |   —   |
| i18n pt-BR/en-US |     ✓      |   ✓   |   ✓   |

### Instalação

#### Opção A — só o plugin (zero dependências)

Dentro do Claude Code:

```text
/plugin marketplace add nickdevcode/Ringly
/plugin install ringly@ringly
```

O plugin inclui um dispatcher embutido, então as notificações já funcionam no Windows 11.
Configure idioma, eventos habilitados, som e debug pela própria UI do gerenciador de plugins.

#### Opção B — plugin + CLI npm (recomendado)

```bash
npm install -g ringly
ringly init
```

O instalador interativo registra o AUMID do Windows (obrigatório para o toast nativo
aparecer), salva a configuração no local padrão do sistema e mostra o comando exato
para você colar dentro do Claude Code.

Depois, instale o plugin como na Opção A. As duas camadas se reconhecem automaticamente.

### Configuração

O Ringly lê configuração de três lugares, nesta ordem de prioridade:

1. `userConfig` do plugin (UI do Claude Code).
2. Variáveis de ambiente (`CLAUDE_PLUGIN_OPTION_*`).
3. Arquivo local em:
   - **Windows** — `%APPDATA%\ringly\config.json`
   - **macOS** — `~/Library/Application Support/ringly/config.json`
   - **Linux** — `~/.config/ringly/config.json`

Opções disponíveis:

| Chave                 | Tipo                  | Padrão | Descrição                                             |
| --------------------- | --------------------- | :----: | ----------------------------------------------------- |
| `language`            | `auto / pt-BR / en-US`| `auto` | `auto` detecta pelo locale do sistema.                |
| `events.notification` | boolean               |  true  | Notifica quando o Claude pede permissão ou input.     |
| `events.stop`         | boolean               |  true  | Notifica quando o Claude termina uma resposta.        |
| `events.stopFailure`  | boolean               |  true  | Notifica quando um erro de API encerra a sessão.      |
| `events.subagentStop` | boolean               | false  | Notifica quando um subagent termina.                  |
| `sound`               | boolean               |  true  | Toca som junto da notificação.                        |
| `debug`               | boolean               | false  | Escreve logs detalhados.                              |

### Comandos da CLI

```bash
ringly init                    # instalador interativo (TUI)
ringly init --migrate-legacy   # antes do init, remove o sistema antigo
ringly init --non-interactive  # aplica defaults, sem TUI
ringly config                  # reconfigura interativamente
ringly doctor                  # diagnóstico do ambiente local
ringly test --event Stop --lang pt-BR
ringly uninstall               # remove AUMID, atalho e configuração local
ringly uninstall --legacy      # também remove hooks antigos de PowerShell
```

### Migração do sistema PowerShell antigo

Se você já tinha um sistema **caseiro** de notificações em
`~/.claude/hooks/notify-toast.ps1` (que foi o que originou o Ringly), o `doctor`
vai detectar e te alertar. Para evitar **notificações duplicadas**, rode antes
de instalar:

```bash
ringly init --migrate-legacy
# ou, depois de já instalado:
ringly uninstall --legacy
```

O Ringly **nunca apaga nada destrutivamente**: o `settings.json` original vai
para `settings.json.ringly-bak.<timestamp>` e os scripts `.ps1` para
`~/.claude/hooks/legacy-bak-<timestamp>/`. Se quiser reverter, basta restaurar
manualmente.

### Como funciona

1. O Claude Code emite um evento de hook (`Notification`, `Stop`, `StopFailure`, `SubagentStop`).
2. O `hooks.json` do plugin executa `node dispatch.mjs <Event>`.
3. O `dispatch.mjs` lê o payload JSON via stdin e tenta, nessa ordem:
   - o módulo Node `ringly/hook` (melhor tradução, contexto de projeto),
   - o binário `ringly` no PATH,
   - um fallback embutido que só depende de PowerShell + WinRT.
4. No Windows, o toast é gerado como XML e exibido via o AUMID registrado
   `Claude.Code.CLI`. Um beep é tocado como fallback se o Modo Foco ou Não Perturbe
   estiverem bloqueando as notificações.

### Solução de problemas

- **Não aparece toast**: confira Modo Foco ou Não Perturbe no Windows. Rode
  `ringly doctor` para inspecionar o registro AUMID e as permissões.
- **AUMID ausente**: rode `ringly init --force` para recriar o atalho do Menu Iniciar
  e re-registrar o ID da aplicação.
- **Hook parece silencioso**: ative `debug: true` na config do plugin e verifique o
  log mostrado no fim do `ringly doctor`.

### Contribuindo

Issues e pull requests são bem-vindos. Leia o [`CONTRIBUTING.md`](./CONTRIBUTING.md)
antes de abrir uma PR — ele tem o setup local, padrões de commit e como rodar
os checks.

Histórico de versões: [`CHANGELOG.md`](./CHANGELOG.md).

Repositório: [github.com/nickdevcode/Ringly](https://github.com/nickdevcode/Ringly).

---

## English 🇺🇸

**Ringly** wires up the Claude Code hook system (`Notification`, `Stop`, `StopFailure`,
`SubagentStop`) to native operating-system notifications, with translated, project-aware
messages so you always know what Claude needs from you without staring at your terminal.

It is distributed in **two complementary pieces**:

- **Claude Code plugin** (`/plugin install ringly@ringly`) — wires up the hooks and
  ships an embedded fallback so notifications work even without Node.js dependencies.
- **`ringly` npm package** — adds an interactive installer (`ringly init`), a
  diagnostic tool (`ringly doctor`), and the full translation engine.

For the best experience, install both.

### Status

Ringly is in active development. **Windows 11** is the supported target for v1.0.
macOS and Linux toast back-ends are scaffolded and planned for the next release.

| Surface          | Windows 11 | macOS | Linux |
| ---------------- | :--------: | :---: | :---: |
| Native toast     |     ✓      |  ⏳   |  ⏳   |
| Sound fallback   |     ✓      |  ⏳   |  ⏳   |
| AUMID register   |     ✓      |   —   |   —   |
| i18n pt-BR/en-US |     ✓      |   ✓   |   ✓   |

### Installation

#### Option A — Plugin only (zero dependencies)

Inside Claude Code:

```text
/plugin marketplace add nickdevcode/Ringly
/plugin install ringly@ringly
```

The plugin includes an embedded toast dispatcher, so notifications work right away on
Windows 11. Configure language, enabled events, sound, and debug from the plugin
manager UI.

#### Option B — Plugin + npm CLI (recommended)

```bash
npm install -g ringly
ringly init
```

The interactive installer registers the Windows AUMID (required for native toasts to
appear), writes configuration to your OS standard location, and prints the exact slash
command to install the plugin.

After that, install the plugin as in Option A. Both layers will talk to each other
automatically.

### Configuration

Ringly reads configuration from three places, in this priority order:

1. `userConfig` provided by Claude Code (plugin manager UI).
2. Environment variables (`CLAUDE_PLUGIN_OPTION_*`).
3. Local config file under the OS standard location:
   - **Windows** — `%APPDATA%\ringly\config.json`
   - **macOS** — `~/Library/Application Support/ringly/config.json`
   - **Linux** — `~/.config/ringly/config.json`

Available settings:

| Key                       | Type                   | Default | Description                                              |
| ------------------------- | ---------------------- | :-----: | -------------------------------------------------------- |
| `language`                | `auto / pt-BR / en-US` | `auto`  | Auto-detects from system locale when set to `auto`.      |
| `events.notification`     | boolean                |  true   | Notify when Claude requests permission or input.         |
| `events.stop`             | boolean                |  true   | Notify when Claude finishes a response.                  |
| `events.stopFailure`      | boolean                |  true   | Notify when an API error ends the session.               |
| `events.subagentStop`     | boolean                |  false  | Notify when a subagent finishes.                         |
| `sound`                   | boolean                |  true   | Play a sound with each notification.                     |
| `debug`                   | boolean                |  false  | Write detailed logs.                                     |

### CLI commands

```bash
ringly init                    # interactive installer (TUI)
ringly init --migrate-legacy   # remove the pre-Ringly system before init
ringly init --non-interactive  # apply defaults, skip the TUI
ringly config                  # reconfigure interactively
ringly doctor                  # run a diagnostic of the local setup
ringly test --event Stop --lang pt-BR
ringly uninstall               # remove AUMID, shortcut, and local config
ringly uninstall --legacy      # also remove the legacy PowerShell hooks
```

### Migrating from a legacy PowerShell setup

If you already had a home-grown notification setup at
`~/.claude/hooks/notify-toast.ps1` (the prototype this project grew from),
`doctor` will detect and warn you. To avoid **duplicate toasts**, run before
installing:

```bash
ringly init --migrate-legacy
# or, if Ringly is already installed:
ringly uninstall --legacy
```

Ringly **never destroys anything**: the original `settings.json` is moved to
`settings.json.ringly-bak.<timestamp>` and the `.ps1` scripts go to
`~/.claude/hooks/legacy-bak-<timestamp>/`. To revert, restore them manually.

### How it works

1. Claude Code emits a hook event (`Notification`, `Stop`, `StopFailure`, `SubagentStop`).
2. The plugin's `hooks.json` runs `node dispatch.mjs <Event>`.
3. `dispatch.mjs` reads the JSON payload from stdin and tries, in order:
   - the `ringly/hook` Node module (best translations, project-aware),
   - the `ringly` CLI binary on the PATH,
   - an embedded fallback that only depends on PowerShell + WinRT.
4. On Windows, the toast is generated as XML and shown via the registered
   AUMID `Claude.Code.CLI`. A beep is played as a fallback if Focus Assist or
   Do Not Disturb is blocking notifications.

### Troubleshooting

- **No toast appears**: check Focus Assist or Do Not Disturb on Windows. Run
  `ringly doctor` to inspect AUMID registration and notification permissions.
- **AUMID missing**: re-run `ringly init --force` to recreate the Start Menu shortcut
  and re-register the application ID.
- **Hook seems silent**: enable debug mode (`debug: true` in the plugin config) and
  check the log file path printed by `ringly doctor`.

### Contributing

Issues and pull requests are welcome. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md)
before opening a PR — it covers local setup, commit conventions, and how to run
the checks.

Release history: [`CHANGELOG.md`](./CHANGELOG.md).

Repository: [github.com/nickdevcode/Ringly](https://github.com/nickdevcode/Ringly).

---

## License

[MIT](./LICENSE)
