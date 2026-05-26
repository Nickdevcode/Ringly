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

O projeto é distribuído em **duas camadas complementares e obrigatórias**,
nesta ordem:

1. **Pacote npm `ringly`** (passo 1) — registra o **AUMID do Windows** (sem ele,
   o Windows 10/11 silencia o toast nativo), instala o atalho no Menu Iniciar,
   escreve a configuração inicial e fornece os utilitários `ringly doctor` /
   `ringly config` / `ringly uninstall`.
2. **Plugin do Claude Code** (passo 2) — registra os hooks (`Notification`,
   `Stop`, `StopFailure`, `SubagentStop`) e roda o dispatcher que delega ao
   módulo Node do `ringly` e, por fim, monta e dispara o toast usando o AUMID
   já registrado no passo 1.

> ⚠️ **Os dois passos são obrigatórios.** O plugin sozinho até roda o dispatcher,
> mas no Windows 10/11 o `ToastNotificationManager` exige um AUMID registrado para
> exibir notificações na Central de Ações — esse registro é feito apenas pelo
> `ringly init`. Sem ele, você ouve no máximo um beep de fallback (ou nada).

### Status

O Ringly está em desenvolvimento ativo. **Windows 10 e 11** são os sistemas suportados na v1.0.
macOS e Linux têm os back-ends estruturados e estão planejados para a próxima versão.

| Recurso                     | Windows 10/11 | macOS | Linux |
| --------------------------- | :-----------: | :---: | :---: |
| Toast nativo                |       ✓       |  ⏳   |  ⏳   |
| Som de fallback             |       ✓       |  ⏳   |  ⏳   |
| Registro AUMID              |       ✓       |   —   |   —   |
| Notificações em pt-BR/en-US |       ✓       |   ✓   |   ✓   |
| TUI e CLI em pt-BR/en-US    |       ✓       |   ✓   |   ✓   |

### Instalação

A instalação é feita em **dois passos**. Pule um e o toast nativo não vai
aparecer no Windows 10/11 — não é uma escolha, é uma exigência do próprio sistema
operacional (veja a nota acima sobre o AUMID).

#### Passo 1 — Instalar a CLI `ringly` (registra o AUMID)

```bash
npm install -g ringly
ringly init
```

O instalador interativo:

- registra o **AUMID `Claude.Code.CLI`** no Windows (obrigatório para que o
  `ToastNotificationManager` autorize o toast),
- cria o atalho no Menu Iniciar amarrado a esse AUMID,
- salva a configuração no `~/.claude/settings.json` (com backup automático),
- imprime o comando exato do passo 2 pra você colar no Claude Code.

#### Passo 2 — Instalar o plugin no Claude Code (registra os hooks)

Dentro do Claude Code:

```text
/plugin marketplace add nickdevcode/Ringly
/plugin install ringly@ringly
```

O plugin registra os hooks (`Notification`, `Stop`, `StopFailure`, `SubagentStop`)
e o dispatcher embutido passa a usar o AUMID já registrado no passo 1. A partir
daí, configure idioma, eventos, som e debug pelo gerenciador de plugins, por
`ringly config` (TUI), ou editando `~/.claude/settings.json` direto.

### Atualizando

Para pegar a versão mais recente publicada no npm:

```bash
npm install -g ringly@latest
```

Verifique a versão instalada com `ringly --version` ou `npm list -g ringly`.
O plugin do Claude Code atualiza automaticamente quando você sobe uma nova
versão no marketplace — se quiser forçar manualmente, rode `/plugin marketplace update`
dentro do Claude Code.

### Configuração

> **Importante:** o **plugin manager do Claude Code é a fonte de verdade**. Toda configuração do Ringly fica em `~/.claude/settings.json` sob a chave `pluginConfigs.ringly.options` — exatamente como a Anthropic recomenda para qualquer plugin.

#### Três formas de configurar (todas escrevem no mesmo lugar)

| Forma                                                       | Quando usar                                          |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| **`ringly config`** — TUI bonita no terminal (✨ recomendado) | Melhor experiência: setas pra navegar, espaço pra toggle, seletor visual de idioma. Escreve no `settings.json` por você e lembra de rodar `/reload-plugins` ao final. |
| **Editar `settings.json` manualmente**                      | Para automação/CI. Sempre rode `/reload-plugins` depois. |
| **Plugin manager** — `/plugin` → Installed → Ringly         | Forma oficial nativa do Claude Code. **Limitação atual**: o campo `language` é renderizado como input de texto livre (o schema oficial não suporta enum), e `Enter` em booleanos só navega entre campos — use `Space` para alternar. Para uma UX bem mais agradável, prefira `ringly config`. |

#### Como o Ringly resolve a configuração em runtime

O dispatcher dos hooks lê, **nesta ordem de prioridade**:

1. **`~/.claude/settings.json` → `pluginConfigs.ringly.options`** — fonte primária. O Ringly lê esse arquivo diretamente no início de cada hook, então qualquer mudança feita pelo plugin manager do Claude Code ou por `ringly config` é aplicada imediatamente, sem precisar de restart.
2. **`config.json` local** (`%APPDATA%\ringly\config.json` no Windows, `~/.config/ringly` no Linux, `~/Library/Application Support/ringly` no macOS) — fallback usado apenas quando o `settings.json` não tem a chave `pluginConfigs.ringly`. Mantido para compatibilidade com instalações pré-0.2.1.
3. **Variáveis de ambiente `RINGLY_DEBUG=1` e `CLAUDE_PLUGIN_OPTION_DEBUG=true`** — apenas para forçar logs detalhados durante diagnóstico, sem persistir nada.
4. **Defaults internos** — última camada.

> O Claude Code **não exporta** as opções de `pluginConfigs` como variáveis de ambiente para os hooks. Por isso o Ringly precisa ler o `settings.json` diretamente. Sempre que possível, use o plugin manager ou `ringly config` — eles cuidam de fazer backup do arquivo antes de cada gravação.

#### Opções disponíveis

As chaves abaixo correspondem ao `userConfig` declarado no `plugin.json` e ficam todas em `pluginConfigs.ringly.options` dentro de `~/.claude/settings.json`.

| Chave                 | Tipo                  | Padrão | Descrição                                             |
| --------------------- | --------------------- | :----: | ----------------------------------------------------- |
| `language`            | `auto / pt-BR / en-US`| `auto` | `auto` detecta pelo locale do sistema.                |
| `events_notification` | boolean               |  true  | Notifica quando o Claude pede permissão ou input.     |
| `events_stop`         | boolean               |  true  | Notifica quando o Claude termina uma resposta.        |
| `events_stopFailure`  | boolean               |  true  | Notifica quando um erro de API encerra a sessão.      |
| `events_subagentStop` | boolean               | false  | Notifica quando um subagent termina.                  |
| `sound`               | boolean               |  true  | Toca som junto da notificação.                        |
| `debug`               | boolean               | false  | Escreve logs detalhados.                              |

### Comandos da CLI

```bash
ringly init                    # instalador interativo (TUI)
ringly init --non-interactive  # aplica defaults, sem TUI
ringly config                  # reconfigura interativamente
ringly doctor                  # diagnóstico do ambiente local
ringly test --event Stop --lang pt-BR
ringly uninstall               # remove AUMID, atalho e configurações do Ringly
```

### Como funciona

1. O Claude Code emite um evento de hook (`Notification`, `Stop`, `StopFailure`, `SubagentStop`).
2. O `hooks.json` do plugin executa `node ${CLAUDE_PLUGIN_ROOT}/hooks/dispatch.mjs <Event>`.
3. O `dispatch.mjs` lê o `~/.claude/settings.json` e checa as opções do Ringly. Se o evento
   estiver desabilitado pelo usuário, o dispatcher encerra silenciosamente — sem disparar nada.
4. Caso o evento esteja habilitado, o dispatcher lê o payload JSON via stdin e tenta, nessa ordem:
   - **o módulo Node `ringly/hook`** — caminho normal quando a CLI foi instalada
     (passo 1 da instalação). Traz a tradução mais rica e contexto de projeto.
   - **o binário `ringly` no PATH** — usado quando o módulo não é resolvido pelo
     `require` mas a CLI existe globalmente.
   - **um fallback embutido em PowerShell + WinRT** — último recurso, só dispara
     se os dois anteriores falharem. Como o AUMID `Claude.Code.CLI` precisa estar
     registrado pelo `ringly init`, esse fallback **não substitui o passo 1**:
     sem CLI, ele toca no máximo um beep e sai.
5. No Windows, o toast é gerado como XML e exibido via o AUMID registrado
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

It is distributed as **two complementary layers, both required**, in this order:

1. **`ringly` npm package** (step 1) — registers the **Windows AUMID** (without
   it Windows 10/11 silently drops the native toast), installs the Start Menu
   shortcut, writes the initial configuration, and ships the `ringly doctor` /
   `ringly config` / `ringly uninstall` utilities.
2. **Claude Code plugin** (step 2) — registers the hooks (`Notification`,
   `Stop`, `StopFailure`, `SubagentStop`) and runs the dispatcher that delegates
   to the `ringly` Node module and ultimately builds and shows the toast using
   the AUMID already registered in step 1.

> ⚠️ **Both steps are required.** The plugin alone runs the dispatcher, but on
> Windows 10/11 `ToastNotificationManager` only displays notifications from apps
> with a registered AUMID — and that registration is performed exclusively by
> `ringly init`. Skip it and you'll get a fallback beep at best, nothing at worst.

### Status

Ringly is in active development. **Windows 10 and 11** are the supported targets for v1.0.
macOS and Linux toast back-ends are scaffolded and planned for the next release.

| Surface                       | Windows 10/11 | macOS | Linux |
| ----------------------------- | :-----------: | :---: | :---: |
| Native toast                  |       ✓       |  ⏳   |  ⏳   |
| Sound fallback                |       ✓       |  ⏳   |  ⏳   |
| AUMID register                |       ✓       |   —   |   —   |
| Notifications in pt-BR/en-US  |       ✓       |   ✓   |   ✓   |
| TUI & CLI in pt-BR/en-US      |       ✓       |   ✓   |   ✓   |

### Installation

Installation is a **two-step** process. Skip either one and native toasts won't
show up on Windows 10/11 — this isn't a choice, it's an OS-level requirement (see
the note above about the AUMID).

#### Step 1 — Install the `ringly` CLI (registers the AUMID)

```bash
npm install -g ringly
ringly init
```

The interactive installer:

- registers the **`Claude.Code.CLI` AUMID** on Windows (required for
  `ToastNotificationManager` to authorize the toast),
- creates a Start Menu shortcut bound to that AUMID,
- writes the configuration to `~/.claude/settings.json` (with an automatic backup),
- prints the exact step 2 command to paste into Claude Code.

#### Step 2 — Install the plugin inside Claude Code (registers the hooks)

Inside Claude Code:

```text
/plugin marketplace add nickdevcode/Ringly
/plugin install ringly@ringly
```

The plugin registers the hooks (`Notification`, `Stop`, `StopFailure`,
`SubagentStop`) and the embedded dispatcher uses the AUMID registered in step 1.
From here, tweak language, events, sound, and debug via the plugin manager,
`ringly config` (TUI), or by editing `~/.claude/settings.json` directly.

### Updating

To pull the latest version published on npm:

```bash
npm install -g ringly@latest
```

Check the installed version with `ringly --version` or `npm list -g ringly`.
The Claude Code plugin updates automatically when a new version is pushed to
the marketplace — to force a manual refresh, run `/plugin marketplace update`
inside Claude Code.

### Configuration

> **Important:** the **Claude Code plugin manager is the source of truth**. All Ringly settings live in `~/.claude/settings.json` under `pluginConfigs.ringly.options` — exactly how Anthropic recommends for every plugin.

#### Three ways to configure (all write to the same file)

| Method                                                      | When to use                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| **`ringly config`** — slick TUI in your terminal (✨ recommended) | Best experience: arrow keys to navigate, space to toggle, visual language picker. Writes into `settings.json` for you and reminds you to run `/reload-plugins` at the end. |
| **Edit `settings.json` directly**                           | Best for automation/CI. Always run `/reload-plugins` after. |
| **Plugin manager** — `/plugin` → Installed → Ringly         | Official native flow inside Claude Code. **Current limitation**: the `language` field is rendered as a free-text input (the official schema does not support enum), and `Enter` on booleans only moves between fields — use `Space` to toggle. For a much smoother UX, prefer `ringly config`. |

#### How Ringly resolves the config at runtime

The hook dispatcher reads, **in this priority order**:

1. **`~/.claude/settings.json` → `pluginConfigs.ringly.options`** — primary source. Ringly reads this file directly at the start of every hook, so changes made through Claude Code's plugin manager or `ringly config` apply immediately, with no restart required.
2. **Local `config.json`** (`%APPDATA%\ringly\config.json` on Windows, `~/.config/ringly` on Linux, `~/Library/Application Support/ringly` on macOS) — fallback used only when `settings.json` has no `pluginConfigs.ringly` entry. Kept for backwards compatibility with pre-0.2.1 installs.
3. **Environment variables `RINGLY_DEBUG=1` and `CLAUDE_PLUGIN_OPTION_DEBUG=true`** — only to force verbose logging during diagnostics; nothing is persisted.
4. **Built-in defaults** — final fallback.

> Claude Code **does not export** `pluginConfigs` options as environment variables to hooks. That's why Ringly reads `settings.json` directly. Prefer the plugin manager or `ringly config` whenever possible — both take a backup of the file before writing.

#### Available settings

The keys below match the `userConfig` declared in `plugin.json` and live in `pluginConfigs.ringly.options` inside `~/.claude/settings.json`.

| Key                   | Type                   | Default | Description                                              |
| --------------------- | ---------------------- | :-----: | -------------------------------------------------------- |
| `language`            | `auto / pt-BR / en-US` | `auto`  | Auto-detects from system locale when set to `auto`.      |
| `events_notification` | boolean                |  true   | Notify when Claude requests permission or input.         |
| `events_stop`         | boolean                |  true   | Notify when Claude finishes a response.                  |
| `events_stopFailure`  | boolean                |  true   | Notify when an API error ends the session.               |
| `events_subagentStop` | boolean                |  false  | Notify when a subagent finishes.                         |
| `sound`               | boolean                |  true   | Play a sound with each notification.                     |
| `debug`               | boolean                |  false  | Write detailed logs.                                     |

### CLI commands

```bash
ringly init                    # interactive installer (TUI)
ringly init --non-interactive  # apply defaults, skip the TUI
ringly config                  # reconfigure interactively
ringly doctor                  # run a diagnostic of the local setup
ringly test --event Stop --lang pt-BR
ringly uninstall               # remove AUMID, shortcut, and Ringly settings
```

### How it works

1. Claude Code emits a hook event (`Notification`, `Stop`, `StopFailure`, `SubagentStop`).
2. The plugin's `hooks.json` runs `node ${CLAUDE_PLUGIN_ROOT}/hooks/dispatch.mjs <Event>`.
3. `dispatch.mjs` reads `~/.claude/settings.json` and checks your Ringly options. If the event
   is disabled, the dispatcher exits silently — nothing is fired.
4. If the event is enabled, the dispatcher reads the JSON payload from stdin and tries, in order:
   - **the `ringly/hook` Node module** — the normal path once the CLI has been
     installed (step 1 of the installation). Ships the richest translations and
     project-aware context.
   - **the `ringly` CLI binary on PATH** — used when `require` can't resolve the
     module but the CLI is installed globally.
   - **an embedded PowerShell + WinRT fallback** — last resort, only fires if
     the two above failed. Because the `Claude.Code.CLI` AUMID has to be
     registered by `ringly init`, this fallback **does not replace step 1**:
     without the CLI it plays a beep at best and exits.
5. On Windows, the toast is generated as XML and shown via the registered
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
