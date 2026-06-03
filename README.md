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

O **Ringly** liga os hooks do Claude Code a notificações nativas do sistema operacional, com
mensagens traduzidas e contextualizadas pelo nome do projeto. Você nunca mais precisa ficar
olhando o terminal pra saber o que o Claude está esperando de você.

Por padrão ele cobre os eventos essenciais (`Notification`, `Stop`, `StopFailure` e,
opcionalmente, `SubagentStop`). A partir da v0.7.0 dá pra ligar também eventos mais granulares —
início de subagent (`SubagentStart`), criação/conclusão de tarefas (`TaskCreated`/`TaskCompleted`)
e compactação de contexto (`PreCompact`/`PostCompact`) — todos desligados por padrão e
throttled pra não te encher de notificação.

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
daí, configure idioma, eventos, som e debug pelo `ringly config` (TUI) ou
editando `~/.claude/settings.json` direto — a partir da v0.5.0 o Ringly **não**
expõe mais uma tela no gerenciador de plugins do Claude Code (veja a seção
[Configuração](#configuração) para o porquê).

### Atualizando

A partir da v0.4.0, o próprio Ringly te avisa quando tem uma versão nova:

1. **Aviso automático.** Uma vez por dia, no início da sessão do Claude Code, o
   plugin checa o npm em background. Se tiver versão nova, dispara uma toast nativa
   do tipo "Ringly 0.5.0 disponível — rode `/ringly-update` no Claude Code". É a
   mesma toast que você já conhece, só vinda do próprio plugin.
2. **Atualização guiada via slash command.** Dentro do Claude Code, rode:

   ```text
   /ringly-update
   ```

   O comando consulta o npm, mostra a diferença entre a versão instalada e a mais
   recente, pede confirmação e roda `npm install -g ringly@latest` por você.
   No final, ele lembra de rodar `/reload-plugins` para a sessão ativa carregar
   a nova versão (ou fechar e reabrir o Claude Code se houver lock de arquivos
   no Windows).

#### Atualização manual

Se preferir fazer na mão (ou estiver fora do Claude Code):

```bash
npm install -g ringly@latest
```

Verifique a versão instalada com `ringly --version` ou `ringly update --check`
(esse último imprime um JSON com `current`, `latest`, `hasUpdate`, `reachable` —
útil em scripts e CI). O plugin do Claude Code atualiza automaticamente quando
uma nova versão é publicada no marketplace; force com `/plugin marketplace update`
dentro do Claude Code se quiser puxar manualmente.

#### Desativando a checagem automática

A checagem é throttled a uma request por dia, não envia nada além da consulta
pública ao npm e respeita o opt-out. Pra desligar, marque `check_updates: false`
rodando `ringly config` ou editando `~/.claude/settings.json` direto.

### Configuração

> **A partir da v0.5.0, o Ringly é configurado exclusivamente pela CLI.** O `plugin.json` **não declara mais um `userConfig`**, então a tela `/plugin` → Installed → Ringly → Configure do Claude Code **não aparece de propósito**. Mais sobre o porquê logo abaixo.

#### Por que não usar o gerenciador de plugins do Claude Code

Até a v0.4.x o Ringly aparecia no `/plugin` manager nativo. Na prática a UX era
ruim e cheia de armadilhas que vinham do próprio gerenciador, não do nosso plugin:

- **O campo `language` era um input de texto livre.** O schema oficial do
  `userConfig` ([documentado pela Anthropic em `code.claude.com`](https://code.claude.com/docs/en/plugins-reference#user-configuration)) só permite `string`/`number`/`boolean`/`directory`/`file` — não tem suporte a enum. Resultado: o usuário precisava digitar `pt-BR` ou `en-US` letra por letra (com hífen), e um typo virava `auto` silenciosamente.
- **`Enter` em booleano não toggle.** No plugin manager, `Enter` apenas confirma a navegação entre campos. Pra alternar um boolean você precisava lembrar de apertar `Space`. Várias pessoas reportaram "marquei a opção mas continuou ligada".
- **Sem validação visual, sem confirmação atômica.** O plugin manager grava direto em `~/.claude/settings.json` sem backup explícito e sem aviso de `/reload-plugins`.

Nada disso é culpa do Claude Code — o `userConfig` é um schema genérico e
funciona bem pra plugins simples (uma URL, um token). Pro caso do Ringly (idioma
com enum, 7 toggles, contexto de "isso vai disparar notificações no seu SO"), o
custo da UX ruim era maior do que o ganho de ter uma tela nativa.

A solução técnica seria pedir pra Anthropic adicionar `enum` e `Enter`-toggle no
schema. Enquanto isso não acontece, optamos por **remover o `userConfig`
completamente** em vez de fingir que a UX é boa.

#### Como configurar (única forma oficial)

| Forma                                                       | Quando usar                                          |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| **`ringly config`** — TUI bonita no terminal (✨ recomendado) | Melhor experiência: setas pra navegar, espaço pra toggle, seletor visual de idioma. Escreve no `settings.json` por você (atomic + backup com timestamp) e lembra de rodar `/reload-plugins` ao final. |
| **Editar `settings.json` manualmente**                      | Para automação/CI. As chaves ficam em `pluginConfigs.ringly.options` (veja [Opções disponíveis](#opções-disponíveis)). Sempre rode `/reload-plugins` depois. |
| **`ringly init`**                                           | Roda o instalador interativo de novo (com banner, registro de AUMID, setup completo). Use quando estiver reinstalando ou se o `settings.json` foi apagado. |

> Se você procurar pelo Ringly em `/plugin → Installed`, o plugin aparece lá
> (ele está **instalado** — os hooks estão registrados), mas o item **Configure**
> simplesmente não existe pro Ringly. Isso é proposital, não bug.

#### Como o Ringly resolve a configuração em runtime

O dispatcher dos hooks lê, **nesta ordem de prioridade**:

1. **`~/.claude/settings.json` → `pluginConfigs.ringly.options`** — fonte única em estado estável. O Ringly lê esse arquivo diretamente no início de cada hook, então qualquer mudança feita por `ringly config` é aplicada imediatamente, sem precisar de restart.
2. **Variáveis de ambiente `RINGLY_DEBUG=1` e `CLAUDE_PLUGIN_OPTION_*`** — overrides voláteis. As `CLAUDE_PLUGIN_OPTION_*` continuam sendo lidas como override opcional (útil pra forçar `debug=true` por uma única sessão sem persistir nada), mas o Claude Code **não exporta mais nada automaticamente** já que o `userConfig` foi removido. Você precisa setar essas variáveis manualmente no seu shell se quiser usar.
3. **Defaults internos** — última camada.

#### Opções disponíveis

As chaves abaixo ficam em `pluginConfigs.ringly.options` dentro de `~/.claude/settings.json`. O `ringly config` cria/edita todas elas pra você.

| Chave                  | Tipo                  | Padrão | Descrição                                             |
| ---------------------- | --------------------- | :----: | ----------------------------------------------------- |
| `language`             | `auto / pt-BR / en-US`| `auto` | `auto` detecta pelo locale do sistema.                |
| `events_notification`  | boolean               |  true  | Notifica quando o Claude pede permissão ou input.     |
| `events_stop`          | boolean               |  true  | Notifica quando o Claude termina uma resposta.        |
| `events_stopFailure`   | boolean               |  true  | Notifica quando um erro de API encerra a sessão.      |
| `events_subagentStop`  | boolean               | false  | Notifica quando um subagent termina.                  |
| `events_subagentStart` | boolean               | false  | Notifica quando um subagent **começa**. Verboso (throttled). |
| `events_taskCreated`   | boolean               | false  | Notifica quando uma tarefa é criada. Verboso (throttled). |
| `events_taskCompleted` | boolean               | false  | Notifica quando uma tarefa é concluída. Verboso (throttled). |
| `events_preCompact`    | boolean               | false  | Notifica **antes** do contexto ser compactado. Verboso (throttled). |
| `events_postCompact`   | boolean               | false  | Notifica **depois** do contexto ser compactado. Verboso (throttled). |
| `sound`                | boolean               |  true  | Toca som junto da notificação.                        |
| `debug`                | boolean               | false  | Escreve logs detalhados.                              |
| `check_updates`        | boolean               |  true  | Checa o npm 1x/dia no SessionStart e avisa via toast quando tem versão nova. |

> **Eventos verbosos** (subagent start, tarefas, compactação) vêm **desligados por padrão** e são
> **throttled/deduplicados**: numa sessão movimentada, o Ringly agrupa disparos repetidos (mesmo
> evento + projeto + subagent dentro de uma janela curta) pra não inundar a Central de Notificações.
> Ligue os que quiser pelo `ringly config`. **Adicionar uma notificação nova ao Ringly hoje é mudar
> 1 lugar** (o registro de eventos em `src/core/events.ts`) + as traduções — o resto é derivado.

### Comandos da CLI

```bash
ringly help                    # lista os comandos no idioma configurado
ringly init                    # instalador interativo (TUI)
ringly init --non-interactive  # aplica defaults, sem TUI
ringly config                  # reconfigura interativamente
ringly doctor                  # diagnóstico do ambiente local
ringly test --event Stop --lang pt-BR
ringly update                  # checa o npm e roda a atualização guiada
ringly update --check          # imprime JSON {current, latest, hasUpdate, reachable, language, notes}
ringly update --yes            # pula a confirmação e instala direto
ringly uninstall               # remove AUMID, atalho e configurações do Ringly
```

> Dentro do Claude Code, dois slash commands cobrem o dia a dia:
>
> - **`/ringly-update`** — espelha `ringly update`, com confirmação visual via
>   `AskUserQuestion`, **resumo amigável do que mudou na nova versão** (lido
>   do `CHANGELOG.md` empacotado) e instrução automática pra rodar
>   `/reload-plugins` no final. Tudo aparece no idioma configurado.
> - **`/ringly-help`** — roda `ringly help` e mostra a lista de comandos
>   direto no chat (com aviso de que esses comandos rodam no seu terminal
>   externo, não dentro do Claude Code).

### Como funciona

1. O Claude Code emite um evento de hook (`SessionStart`, `Notification`, `Stop`, `StopFailure`,
   `SubagentStop`, `SubagentStart`, `TaskCreated`, `TaskCompleted`, `PreCompact`, `PostCompact`).
2. O `hooks.json` do plugin executa `node ${CLAUDE_PLUGIN_ROOT}/hooks/dispatch.mjs <Event>`.
   Esse `hooks.json` e a tabela de eventos embutida no fallback (`dispatch.data.mjs`) são
   **gerados** a partir do registro único de eventos (`src/core/events.ts`) no `npm run build`.
3. O `dispatch.mjs` lê o `~/.claude/settings.json` e checa as opções do Ringly. Se o evento
   estiver desabilitado pelo usuário (`events_*` ou `check_updates`), o dispatcher encerra
   silenciosamente — sem disparar nada. O `SessionStart` é tratado como um caminho separado:
   em vez de virar toast direto, ele dispara uma checagem de versão (throttled a 24h) que
   só vira toast se o npm tiver versão nova.
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
   `Claude.Code.CLI`. O XML inclui **timestamp**, **agrupamento por projeto** (header da Central
   de Notificações) e, quando houver um `plugin/assets/ringly.png`, a **imagem do app**
   dentro do toast (`appLogoOverride`). O **ícone do canto/topo** vem do atalho do Menu
   Iniciar: o Ringly registra esse atalho apontando para o `plugin/assets/ringly.ico` (as
   ondas ciano da marca) em vez do ícone do Node. Eventos de compactação usam
   `scenario="reminder"` (ficam fixos na tela até você dispensar). Um beep é tocado como
   fallback se o Modo Foco ou Não Perturbe estiverem bloqueando as notificações.
6. A notificação de **tarefa concluída** (`TaskCompleted`) mostra o nome da tarefa e um
   **contador `concluídas/total`** — por exemplo `✓ Refatorar login (3/10)`. O total é
   estimado por sessão (o Claude Code não envia esse número), então o contador é omitido
   quando o total ainda é indeterminado; o número de concluídas é sempre exato.

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

**Ringly** wires up the Claude Code hook system to native operating-system notifications, with
translated, project-aware messages so you always know what Claude needs from you without staring
at your terminal.

Out of the box it covers the essential events (`Notification`, `Stop`, `StopFailure`, and
optionally `SubagentStop`). As of v0.7.0 you can also opt into finer-grained ones — subagent start
(`SubagentStart`), task created/completed (`TaskCreated`/`TaskCompleted`), and context compaction
(`PreCompact`/`PostCompact`) — all off by default and throttled so they never flood you.

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
From here, tweak language, events, sound, and debug via `ringly config` (TUI)
or by editing `~/.claude/settings.json` directly — starting with v0.5.0 the
plugin no longer exposes a Claude Code plugin-manager screen (see the
[Configuration](#configuration) section for why).

### Updating

Starting in v0.4.0, Ringly tells you when there's a new version available:

1. **Automatic notice.** Once a day, at the start of a Claude Code session, the
   plugin checks npm in the background. If a newer version is out, it fires the
   same native toast you already know — "Ringly 0.5.0 available — run
   `/ringly-update` inside Claude Code".
2. **Guided update via slash command.** Inside Claude Code, run:

   ```text
   /ringly-update
   ```

   The command queries npm, shows the diff between the installed and the latest
   version, asks for confirmation, and runs `npm install -g ringly@latest` for
   you. At the end it reminds you to run `/reload-plugins` so the active session
   picks up the new version (or close and reopen Claude Code if Windows holds
   the files locked).

#### Manual update

If you'd rather do it by hand (or you're outside Claude Code):

```bash
npm install -g ringly@latest
```

Check the installed version with `ringly --version` or `ringly update --check`
(the latter prints a JSON snapshot with `current`, `latest`, `hasUpdate`,
`reachable` — handy for scripts and CI). The Claude Code plugin updates
automatically when a new version lands in the marketplace; force a manual
refresh with `/plugin marketplace update` if you want it now.

#### Disabling the automatic check

The check is throttled to one request per day, only hits the public npm
registry, and respects opt-out. To disable it, set `check_updates: false` by
running `ringly config` or editing `~/.claude/settings.json` directly.

### Configuration

> **As of v0.5.0, Ringly is configured exclusively from the CLI.** The
> `plugin.json` **no longer declares a `userConfig` block**, so Claude Code's
> `/plugin` → Installed → Ringly → Configure screen **does not appear by
> design**. Read on for why.

#### Why we don't use Claude Code's plugin manager

Up to v0.4.x Ringly showed up in `/plugin`'s native configuration UI. In
practice the UX was full of footguns that came from the manager itself, not
from our plugin:

- **The `language` field was a free-text input.** The official `userConfig`
  schema ([documented by Anthropic at `code.claude.com`](https://code.claude.com/docs/en/plugins-reference#user-configuration))
  only supports `string` / `number` / `boolean` / `directory` / `file` — no
  enum support. Users had to type `pt-BR` or `en-US` letter-by-letter (with the
  dash) and a typo silently fell back to `auto`.
- **`Enter` on a boolean does not toggle it.** Inside the plugin manager,
  `Enter` only confirms field navigation — you had to remember to press
  `Space` to flip a boolean. Plenty of folks reported "I unchecked it and it
  was still on".
- **No visual validation, no atomic-write confirmation.** The plugin manager
  writes directly to `~/.claude/settings.json` with no explicit backup and no
  reminder to run `/reload-plugins`.

None of this is the Claude Code team's fault — `userConfig` is a deliberately
minimal schema that fits simple plugins (one URL, one token). For Ringly's
shape (enum language, seven toggles, "this fires OS notifications" context)
the bad UX outweighed the upside of a native screen.

The technical fix would be to ask Anthropic to add `enum` and `Enter`-toggle
to the schema. Until that lands, we chose to **drop `userConfig` entirely**
rather than pretend the experience is fine.

#### How to configure (the only supported flow)

| Method                                                      | When to use                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| **`ringly config`** — slick TUI in your terminal (✨ recommended) | Best experience: arrow keys to navigate, space to toggle, visual language picker. Writes into `settings.json` for you (atomic + timestamped backup) and reminds you to run `/reload-plugins` at the end. |
| **Edit `settings.json` directly**                           | Best for automation/CI. Keys live under `pluginConfigs.ringly.options` (see [Available settings](#available-settings)). Always run `/reload-plugins` after. |
| **`ringly init`**                                           | Re-run the interactive installer (banner, AUMID register, full setup). Use it when reinstalling or if `settings.json` was wiped. |

> If you search for Ringly under `/plugin → Installed`, the plugin shows up
> there (it **is** installed — hooks are registered), but the **Configure**
> entry simply does not exist for Ringly. That's intentional, not a bug.

#### How Ringly resolves the config at runtime

The hook dispatcher reads, **in this priority order**:

1. **`~/.claude/settings.json` → `pluginConfigs.ringly.options`** — the only persistent source. Ringly reads this file directly at the start of every hook, so changes made by `ringly config` apply immediately, with no restart required.
2. **Environment variables `RINGLY_DEBUG=1` and `CLAUDE_PLUGIN_OPTION_*`** — volatile overrides. `CLAUDE_PLUGIN_OPTION_*` is still honoured as an optional override (useful to force `debug=true` for a single shell without persisting anything), but Claude Code **no longer exports anything on its own** now that `userConfig` is gone. You have to set these env vars yourself if you want them.
3. **Built-in defaults** — final fallback.

#### Available settings

The keys below live in `pluginConfigs.ringly.options` inside `~/.claude/settings.json`. `ringly config` creates/edits all of them for you.

| Key                    | Type                   | Default | Description                                              |
| ---------------------- | ---------------------- | :-----: | -------------------------------------------------------- |
| `language`             | `auto / pt-BR / en-US` | `auto`  | Auto-detects from system locale when set to `auto`.      |
| `events_notification`  | boolean                |  true   | Notify when Claude requests permission or input.         |
| `events_stop`          | boolean                |  true   | Notify when Claude finishes a response.                  |
| `events_stopFailure`   | boolean                |  true   | Notify when an API error ends the session.               |
| `events_subagentStop`  | boolean                |  false  | Notify when a subagent finishes.                         |
| `events_subagentStart` | boolean                |  false  | Notify when a subagent **starts**. Verbose (throttled).  |
| `events_taskCreated`   | boolean                |  false  | Notify when a task is created. Verbose (throttled).      |
| `events_taskCompleted` | boolean                |  false  | Notify when a task is completed. Verbose (throttled).    |
| `events_preCompact`    | boolean                |  false  | Notify **before** the context is compacted. Verbose (throttled). |
| `events_postCompact`   | boolean                |  false  | Notify **after** the context is compacted. Verbose (throttled). |
| `sound`                | boolean                |  true   | Play a sound with each notification.                     |
| `debug`                | boolean                |  false  | Write detailed logs.                                     |
| `check_updates`        | boolean                |  true   | Check npm once a day at session start and notify via toast when a new version ships. |

> **Verbose events** (subagent start, tasks, compaction) ship **off by default** and are
> **throttled/deduped**: in a busy session Ringly collapses repeated fires (same event + project +
> subagent within a short window) so they can't flood the Action Center. Turn on the ones you want
> via `ringly config`. **Adding a new notification to Ringly is now a one-place change** (the event
> registry in `src/core/events.ts`) plus its translations — everything else is derived.

### CLI commands

```bash
ringly help                    # list the commands in the configured language
ringly init                    # interactive installer (TUI)
ringly init --non-interactive  # apply defaults, skip the TUI
ringly config                  # reconfigure interactively
ringly doctor                  # run a diagnostic of the local setup
ringly test --event Stop --lang pt-BR
ringly update                  # check npm and run the guided update
ringly update --check          # print {current, latest, hasUpdate, reachable, language, notes} JSON
ringly update --yes            # skip the prompt and install directly
ringly uninstall               # remove AUMID, shortcut, and Ringly settings
```

> Inside Claude Code, two slash commands cover the everyday flow:
>
> - **`/ringly-update`** — mirrors `ringly update`, with visual confirmation via
>   `AskUserQuestion`, **a friendly summary of what changed in the new version**
>   (read from the packaged `CHANGELOG.md`), and an automatic prompt to run
>   `/reload-plugins` at the end. Everything shows up in the configured language.
> - **`/ringly-help`** — runs `ringly help` and shows the command list straight
>   in the chat (with a warning that these commands must run in your external
>   terminal, not inside Claude Code).

### How it works

1. Claude Code emits a hook event (`SessionStart`, `Notification`, `Stop`, `StopFailure`,
   `SubagentStop`, `SubagentStart`, `TaskCreated`, `TaskCompleted`, `PreCompact`, `PostCompact`).
2. The plugin's `hooks.json` runs `node ${CLAUDE_PLUGIN_ROOT}/hooks/dispatch.mjs <Event>`. That
   `hooks.json` and the fallback's embedded event table (`dispatch.data.mjs`) are **generated**
   from the single event registry (`src/core/events.ts`) at `npm run build`.
3. `dispatch.mjs` reads `~/.claude/settings.json` and checks your Ringly options. If the event
   is disabled (`events_*` or `check_updates`), the dispatcher exits silently — nothing is
   fired. `SessionStart` follows its own path: instead of becoming a toast directly, it
   triggers an npm version check (throttled to 24h) that only turns into a toast when a
   newer release is found.
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
   AUMID `Claude.Code.CLI`. The XML carries a **timestamp**, **per-project grouping** (an Action
   Center header) and, when a `plugin/assets/ringly.png` exists, the **in-toast app image**
   (`appLogoOverride`). The **corner icon** comes from the Start Menu shortcut: Ringly registers
   it pointing at `plugin/assets/ringly.ico` (the brand's cyan rings) instead of the Node.js
   icon. Compaction events use `scenario="reminder"` (they stay on screen until dismissed). A
   beep is played as a fallback if Focus Assist or Do Not Disturb is blocking notifications.
6. The **task-completed** notification (`TaskCompleted`) shows the task name plus a
   **`completed/total` counter** — e.g. `✓ Refactor login (3/10)`. The total is estimated
   per session (Claude Code doesn't send it), so the counter is omitted while the total is
   still undetermined; the completed count is always exact.

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
