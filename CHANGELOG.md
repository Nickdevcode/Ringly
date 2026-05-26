# Changelog

> Notas de versão / Release notes — formato baseado em [Keep a Changelog](https://keepachangelog.com/).
> Este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/) ([SemVer](https://semver.org/)).

---

## [0.5.1] — 2026-05-26

### 🇧🇷 Português

**Corrigido**

- **`ringly update --yes` quebrava no Windows com `spawn EINVAL` antes de tocar no npm** (`src/commands/update.ts`). A causa: desde o Node 20.12 / 21.7 / 22+ ([CVE-2024-27980](https://github.com/nodejs/node/security/advisories/GHSA-jrjf-7c8f-mr95)), o Node passou a recusar `spawn` direto de arquivos `.bat` / `.cmd` no Windows por design — exatamente o que a gente fazia com `spawn("npm.cmd", [...], { shell: false })`. O erro acontecia antes de qualquer mensagem localizada do CLI aparecer, então o usuário via só `spawn EINVAL` cru e ficava sem saber o que tinha quebrado. Agora, no Windows, o spawn usa `shell: true` (deixa o `cmd.exe` resolver o shim do npm); macOS e Linux seguem com `shell: false`, comportamento idêntico ao anterior. Como os argumentos são literais hardcoded (`install -g ringly@latest`), não há superfície de injeção. Quem rodava `ringly update` ou `/ringly-update` no Windows e batia nesse erro agora consegue atualizar normalmente.

**Mudado**

- **`src/commands/update.ts`** ganhou uma função pura exportada `buildNpmInstallSpec(platform)` que devolve `{ command, args, options }` decidindo o shell por plataforma. Isso isola a decisão de spawn e deixa o caminho testável sem precisar mockar `node:child_process`. O `runNpmInstallLatest` continua privado e segue usando essa spec.

**Testes**

- **Novo arquivo `test/update.test.ts`** (4 casos) cobrindo a regressão: comando/args iguais em todas as plataformas, `shell: true` no Windows, `shell: false` no macOS/Linux, e `stdio` / `windowsHide` preservados. Reproduzimos o `EINVAL` direto em Node v22.14.0 antes do fix e validamos que o caminho novo executa o npm corretamente.

**Notas pra quem tá vindo da v0.5.0**

- Nada quebra. A correção é puramente interna ao subcomando `ringly update` / hook `SessionStart` / slash `/ringly-update`. Quem estava no macOS ou Linux nem percebe diferença; quem estava no Windows com Node moderno e batia no `spawn EINVAL` agora consegue rodar `/ringly-update` direto do Claude Code, ou `ringly update` no terminal, sem precisar copiar o `npm install -g ringly@latest` manualmente.

### 🇺🇸 English

**Fixed**

- **`ringly update --yes` was failing on Windows with `spawn EINVAL` before npm even started** (`src/commands/update.ts`). Root cause: since Node 20.12 / 21.7 / 22+ ([CVE-2024-27980](https://github.com/nodejs/node/security/advisories/GHSA-jrjf-7c8f-mr95)), Node refuses by design to spawn `.bat` / `.cmd` files directly on Windows — exactly what we were doing with `spawn("npm.cmd", [...], { shell: false })`. The error fired before any localized CLI message could appear, so users only saw the raw `spawn EINVAL` and had no idea what broke. We now pass `shell: true` on Windows (letting `cmd.exe` resolve the npm shim); macOS and Linux still use `shell: false`, behavior unchanged. Since the arguments are hardcoded literals (`install -g ringly@latest`), there is no command-injection surface. Anyone hitting this on Windows via `ringly update` or `/ringly-update` can now update normally.

**Changed**

- **`src/commands/update.ts`** now exports a pure `buildNpmInstallSpec(platform)` helper that returns `{ command, args, options }`, deciding the shell per platform. This isolates the spawn decision and makes it unit-testable without mocking `node:child_process`. `runNpmInstallLatest` stays private and uses the spec.

**Tests**

- **New `test/update.test.ts`** (4 cases) covering the regression: same command/args across platforms, `shell: true` on Windows, `shell: false` on macOS/Linux, and `stdio` / `windowsHide` preserved. We reproduced the `EINVAL` directly on Node v22.14.0 before the fix and validated that the new path runs npm successfully.

**Notes for v0.5.0 users**

- Nothing breaks. The fix is internal to the `ringly update` subcommand / `SessionStart` hook / `/ringly-update` slash command. macOS and Linux users notice no difference; Windows users on modern Node who were hitting `spawn EINVAL` can now run `/ringly-update` straight from Claude Code, or `ringly update` from the terminal, without having to copy-paste `npm install -g ringly@latest` themselves.

---

## [0.5.0] — 2026-05-26

### 🇧🇷 Português

**Mudança incompatível**

- **Removido o `userConfig` do `plugin/.claude-plugin/plugin.json`.** Antes, o Claude Code expunha o Ringly em `/plugin` → Installed → Ringly → **Configure** com uma tela de configuração nativa. Essa tela vinha com três problemas conhecidos que não dependiam do nosso plugin e sim do schema oficial do Claude Code:
  - O campo `language` era renderizado como input de texto livre — o schema [oficial do `userConfig`](https://code.claude.com/docs/en/plugins-reference#user-configuration) não suporta `enum`. Um typo no `pt-BR`/`en-US` virava `auto` silenciosamente.
  - Em booleanos, `Enter` apenas navegava entre campos; só `Space` toggla. Vários usuários relataram "desliguei e continuou ligado".
  - Sem atomic write nem aviso de `/reload-plugins`.
  Como o time da Anthropic ainda não adicionou enum ao schema nem mudou o comportamento de `Enter`, removemos o `userConfig` por completo em vez de fingir que a UX estava boa. **A partir de agora, a configuração do Ringly é exclusivamente via CLI** — `ringly config` (TUI recomendada), edição manual do `~/.claude/settings.json` ou re-rodar `ringly init`. O plugin continua aparecendo em `/plugin → Installed` (os hooks seguem registrados), mas o item **Configure** simplesmente não existe pro Ringly. Quem já tinha valores em `pluginConfigs.ringly.options` **não perde nada**: o dispatcher e o `ringly config` continuam lendo e gravando exatamente as mesmas chaves. Só a UI nativa do plugin manager some.

**Mudado**

- **`displayName` e `description` do `plugin.json`** atualizados deixando claro que a configuração é via `ringly config` e não via plugin manager. Quem abrir o Ringly no marketplace já vê isso na descrição.
- **Tela final do `ringly config` (TUI `ConfigDone`)** reescrita: a caixa "Você também pode configurar via `/plugin` → Installed → Ringly → Configure" foi substituída por uma nota "Configuração só pela CLI — o Ringly não usa a tela do plugin manager. Pra mudar de novo, rode `ringly config`." A caixa amarela de "rode `/reload-plugins`" continua igual.
- **Hints do `ringly doctor`** que apontavam pra "abra `/plugin` no Claude Code → Installed → Ringly → Configure" agora apontam só pra `ringly config`. O check em si continua se chamando "Configuração do Ringly em `~/.claude/settings.json`" e segue validando a mesma chave `pluginConfigs.ringly.options` — só os textos de hint mudaram.
- **Locales `pt-BR.json` e `en-US.json`** ganharam `tui.config.cli_only_title` e `tui.config.cli_only_body`; `tui.config.also_available` e `tui.config.plugin_path` foram **removidas** (não havia consumidor fora do ConfigDone reescrito). Os hints do doctor (`cli.doctor.check.plugin.notfound_hint` e `nooptions_hint`) foram reescritos pra não mencionar mais o plugin manager.

**Docs**

- **`README.md`** ganhou uma seção "Por que não usar o gerenciador de plugins do Claude Code" (pt-BR e en-US) explicando os três problemas acima, linkando direto pro [plugin reference oficial](https://code.claude.com/docs/en/plugins-reference#user-configuration) e deixando documentado que a remoção é intencional, não bug. A tabela "Três formas de configurar" virou "Como configurar (única forma oficial)" com três entradas (`ringly config`, edição manual, `ringly init` pra reinstalação). A seção "Como o Ringly resolve a config em runtime" foi simplificada: só duas camadas (settings.json + env vars de override) em vez de quatro.
- **`plugin/README.md`** explica o mesmo, mais curto, com link pro repo principal.
- **`CONTRIBUTING.md`** ganhou uma seção "Sobre o `plugin.json` sem `userConfig`" (pt-BR e en-US) pra que contribuidores não tentem reintroduzir o `userConfig` sem entender o contexto. A nota pede pra confirmar primeiro se a Anthropic já adicionou enum ao schema antes de propor a mudança.

**Notas pra quem tá vindo da v0.4.0**

- Nada quebra. `ringly config` continua funcionando idêntico, `ringly init` continua funcionando idêntico, `~/.claude/settings.json` continua sendo lido idêntico. A única coisa que muda é que a tela `/plugin → Installed → Ringly → Configure` deixa de existir.
- Se você configurou alguma coisa pelo plugin manager na v0.4.x, esses valores estão em `pluginConfigs.ringly.options` no `settings.json` e seguem sendo respeitados — sem migração necessária.
- Se quiser **reabrir** as configurações pra mudar agora que a tela sumiu, rode `ringly config` no terminal. Tem a TUI completa com setas, espaço pra toggle e seletor de idioma.

### 🇺🇸 English

**Breaking change**

- **Removed `userConfig` from `plugin/.claude-plugin/plugin.json`.** Up to v0.4.x Claude Code exposed Ringly under `/plugin` → Installed → Ringly → **Configure** with a native settings screen. That screen shipped three known issues that came from Claude Code's official schema, not our plugin:
  - The `language` field was rendered as a free-text input — the [official `userConfig` schema](https://code.claude.com/docs/en/plugins-reference#user-configuration) has no `enum` support. A typo on `pt-BR`/`en-US` silently fell back to `auto`.
  - On booleans, `Enter` only navigated between fields; only `Space` actually toggled them. Several users reported "I unchecked it and it stayed on".
  - No atomic write, no `/reload-plugins` reminder.
  Until Anthropic adds enum support to the schema and fixes the `Enter` behaviour, we'd rather drop `userConfig` than pretend the UX was fine. **Configuration is now CLI-only** — `ringly config` (the recommended TUI), hand-editing `~/.claude/settings.json`, or re-running `ringly init`. The plugin still shows up under `/plugin → Installed` (hooks are still registered), but the **Configure** entry simply does not exist for Ringly anymore. Anyone with values already saved under `pluginConfigs.ringly.options` **loses nothing**: the dispatcher and `ringly config` keep reading and writing the exact same keys. Only the native plugin-manager UI is gone.

**Changed**

- **`displayName` and `description` in `plugin.json`** updated to make it explicit that configuration goes through `ringly config`, not the plugin manager. Anyone browsing the marketplace sees it right in the description.
- **Final screen of `ringly config` (TUI `ConfigDone`)** rewritten: the "You can also configure via `/plugin` → Installed → Ringly → Configure" box was replaced with a "CLI-only configuration — Ringly does not use the plugin-manager screen. To change these settings later, run `ringly config` again." note. The yellow `/reload-plugins` reminder is unchanged.
- **`ringly doctor` hints** that pointed at "open `/plugin` in Claude Code → Installed → Ringly → Configure" now point at `ringly config` only. The check itself is still called "Ringly settings in `~/.claude/settings.json`" and still validates the same `pluginConfigs.ringly.options` key — only the hint copy changed.
- **`pt-BR.json` and `en-US.json` locales** gained `tui.config.cli_only_title` and `tui.config.cli_only_body`; `tui.config.also_available` and `tui.config.plugin_path` were **removed** (no consumer remained after the ConfigDone rewrite). Doctor hints (`cli.doctor.check.plugin.notfound_hint` and `nooptions_hint`) were rewritten to drop any mention of the plugin manager.

**Docs**

- **`README.md`** gained a "Why we don't use Claude Code's plugin manager" section (in both pt-BR and en-US) that explains the three problems above, links directly to the [official plugin reference](https://code.claude.com/docs/en/plugins-reference#user-configuration), and documents that the removal is intentional, not a bug. The "Three ways to configure" table became "How to configure (the only supported flow)" with three entries (`ringly config`, hand-edit, `ringly init` for reinstall). The "How Ringly resolves the config at runtime" section was simplified from four layers to two (settings.json + env-var overrides).
- **`plugin/README.md`** says the same thing, shorter, linking back to the main repo.
- **`CONTRIBUTING.md`** gained a "About `plugin.json` with no `userConfig`" section (pt-BR and en-US) so contributors don't try to reintroduce `userConfig` without context. The note asks them to first confirm Anthropic has added enum support before proposing the change.

**Notes for v0.4.0 users**

- Nothing breaks. `ringly config` keeps working identically, `ringly init` keeps working identically, `~/.claude/settings.json` keeps being read identically. The only thing that changes is that the `/plugin → Installed → Ringly → Configure` screen no longer exists.
- If you configured anything via the plugin manager on v0.4.x, those values live in `pluginConfigs.ringly.options` in `settings.json` and are still honoured — no migration needed.
- If you want to **reopen** the configurator now that the screen is gone, run `ringly config` in your terminal. You get the full TUI with arrow keys, space to toggle and a visual language picker.

---

## [0.4.0] — 2026-05-26

### 🇧🇷 Português

**Adicionado**

- **Slash command `/ringly-update` dentro do Claude Code** (`plugin/commands/ringly-update.md`). Detecta se a CLI npm está instalada, consulta o npm registry, mostra a diferença de versão, pede confirmação via `AskUserQuestion` e roda `npm install -g ringly@latest` por você. No final, lembra de rodar `/reload-plugins` (ou fechar/reabrir o Claude Code se houver lock de arquivos no Windows). Todo o passo a passo está no `.md` com `allowed-tools` restrito a `ringly:*` e `npm install -g ringly:*` — o comando não toca em nenhum arquivo do usuário diretamente, só delega pra CLI.
- **Hook `SessionStart` com checagem de update em background** (`plugin/hooks/hooks.json` + `src/commands/updateCheckHook.ts`). Uma vez por dia, no início de cada sessão do Claude Code, o plugin checa o npm em background. Se tiver versão nova, dispara uma toast nativa idêntica às outras notificações — "Ringly 0.5.0 disponível, rode /ringly-update". O timestamp é persistido em `${CLAUDE_PLUGIN_DATA}/last-update-check.json`, então a próxima sessão dentro de 24h pula a checagem sem nem tocar na rede. Throttle, opt-out (`check_updates: false`) e fail-silent garantidos: a checagem nunca atrasa nem bloqueia o início da sessão.
- **Subcomando `ringly update`** (`src/commands/update.ts`). Roda fora do Claude Code também. Três modos:
  - `ringly update` — interativo, com caixa visual, confirmação `s/N` e mensagens localizadas;
  - `ringly update --check` — só imprime um JSON `{current, latest, hasUpdate, reachable}` (esse é o modo que o `/ringly-update` consome);
  - `ringly update --yes` — pula a confirmação e instala direto (esse é o modo que o `/ringly-update` usa quando o usuário confirma).
  Detecta `EBUSY`/`EPERM`/`access is denied` no stderr do `npm install` e troca pra uma mensagem de "feche o Claude Code e tente de novo" em vez de só vomitar o erro.
- **Opção `check_updates: boolean`** no `userConfig` do plugin (`plugin/.claude-plugin/plugin.json`). Padrão `true`. Quando `false`, a checagem do `SessionStart` sai antes de qualquer I/O — nem o `last-update-check.json` é lido. Aparece automaticamente no plugin manager nativo, no `ringly config` e na resolução por env var (`CLAUDE_PLUGIN_OPTION_CHECK_UPDATES`).
- **`src/core/updateCheck.ts`** — módulo isolado e testado com `checkForUpdate` (fetch nativo do Node 20+ com timeout de 3s via `AbortController`), `compareSemver` (suporta prerelease), `shouldCheckUpdate`/`recordCheck`/`readLastCheckRecord` (throttle de 24h via arquivo). Sem nova dependência runtime — só `fetch` nativo, já garantido pelo `engines.node: ">=20.0.0"`.
- **`src/core/ownVersion.ts`** — helper compartilhado que sobe o filesystem buscando o `package.json` com `name: "ringly"`. Funciona em qualquer layout: rodando do source, do `dist/` bundle ou de uma instalação global no npm prefix.

**Mudado**

- **`plugin/hooks/dispatch.mjs`** reconhece `SessionStart` na whitelist e trata como um caminho separado: tenta delegar via `ringly/hook` ou via CLI binary, mas **não cai no fallback de embedded toast** (o evento é uma checagem, não uma notificação direta — sem CLI, não tem como checar).
- **`src/cli.ts hook`** aceita `SessionStart` como evento posicional pro fallback de CLI binário do dispatcher.
- **`RinglyConfig` ganhou `checkUpdates: boolean`** propagado por `src/core/types.ts`, `src/core/config.ts` (default + env override), `src/core/claudeSettings.ts` (read/write em `pluginConfigs.ringly.options.check_updates`).

**Testes**

- **+35 testes novos** (de 94 para 129). `test/updateCheck.test.ts` cobre 30 cenários: comparação semver (igual/maior/menor/prerelease), validação de input (package name e semver mal-formados), `shouldCheckUpdate` em todos os boundaries, `recordCheck`/`readLastCheckRecord` com round-trip e JSON corrompido, `checkForUpdate` com 200/404/network throw/JSON inválido/timeout via `AbortController`/custom registry. `test/updateCheckHook.test.ts` cobre 5 cenários do hook em si: opt-out, throttle, sem update, network down, registro de timestamp malformado.

**Docs**

- Seção "Atualizando" do README reescrita em pt-BR e en-US descrevendo `/ringly-update`, o auto-check, a atualização manual e como desligar a checagem.
- `plugin/README.md` lista os 5 hooks agora (incluindo `SessionStart`) e o novo slash command.
- `CONTRIBUTING.md` atualizado: contagem de testes (129), whitelist de eventos com `SessionStart`, e o layout do projeto inclui os arquivos novos (`commands/ringly-update.md`, `core/ownVersion.ts`, `core/updateCheck.ts`, `commands/update.ts`, `commands/updateCheckHook.ts`).

### 🇺🇸 English

**Added**

- **`/ringly-update` slash command inside Claude Code** (`plugin/commands/ringly-update.md`). Detects whether the npm CLI is installed, queries the npm registry, shows the version diff, asks for confirmation via `AskUserQuestion`, and runs `npm install -g ringly@latest` for you. At the end, it reminds you to run `/reload-plugins` (or close and reopen Claude Code if Windows holds files locked). The entire flow lives in the `.md` with `allowed-tools` restricted to `ringly:*` and `npm install -g ringly:*` — the command never touches user files directly; everything goes through the CLI.
- **`SessionStart` hook with background update check** (`plugin/hooks/hooks.json` + `src/commands/updateCheckHook.ts`). Once a day, at the start of each Claude Code session, the plugin checks npm in the background. If a newer version exists, it fires a native toast identical to the other notifications — "Ringly 0.5.0 available, run /ringly-update". The timestamp is persisted at `${CLAUDE_PLUGIN_DATA}/last-update-check.json`, so the next session within 24h skips the check without touching the network. Throttle, opt-out (`check_updates: false`) and fail-silent guarantees in place: the check never delays or blocks session start.
- **`ringly update` subcommand** (`src/commands/update.ts`). Works outside of Claude Code too. Three modes:
  - `ringly update` — interactive, with a visual box, `s/y/N` confirmation and localized messages;
  - `ringly update --check` — just prints `{current, latest, hasUpdate, reachable}` JSON (this is what `/ringly-update` consumes);
  - `ringly update --yes` — skip confirmation and install directly (this is what `/ringly-update` runs after the user confirms).
  Detects `EBUSY`/`EPERM`/`access is denied` in the `npm install` stderr and swaps the message for a "close Claude Code and retry" hint instead of dumping the raw error.
- **`check_updates: boolean` option** in the plugin's `userConfig` (`plugin/.claude-plugin/plugin.json`). Default `true`. When `false`, the `SessionStart` check exits before any I/O — `last-update-check.json` isn't even read. Shows up automatically in the native plugin manager, in `ringly config` and via env var (`CLAUDE_PLUGIN_OPTION_CHECK_UPDATES`).
- **`src/core/updateCheck.ts`** — isolated and tested module with `checkForUpdate` (Node 20+ native `fetch` with 3s timeout via `AbortController`), `compareSemver` (prerelease-aware), `shouldCheckUpdate`/`recordCheck`/`readLastCheckRecord` (24h throttle via file). No new runtime dependency — just native `fetch`, already guaranteed by `engines.node: ">=20.0.0"`.
- **`src/core/ownVersion.ts`** — shared helper that walks up the filesystem looking for the `package.json` with `name: "ringly"`. Works in any layout: running from source, from the `dist/` bundle, or from a global npm prefix install.

**Changed**

- **`plugin/hooks/dispatch.mjs`** recognizes `SessionStart` in the whitelist and treats it as a separate path: delegates via `ringly/hook` or the CLI binary, but **does not fall back to the embedded toast** (the event is a check, not a direct notification — no CLI, no check).
- **`src/cli.ts hook`** accepts `SessionStart` as a positional event for the dispatcher's CLI-binary fallback.
- **`RinglyConfig` gained `checkUpdates: boolean`** propagated through `src/core/types.ts`, `src/core/config.ts` (default + env override) and `src/core/claudeSettings.ts` (read/write under `pluginConfigs.ringly.options.check_updates`).

**Tests**

- **+35 new tests** (from 94 to 129). `test/updateCheck.test.ts` covers 30 scenarios: semver comparison (equal/greater/lower/prerelease), input validation (bad package names and bad semver), `shouldCheckUpdate` at every boundary, `recordCheck`/`readLastCheckRecord` with round-trip and corrupt JSON, `checkForUpdate` with 200/404/network throw/invalid JSON/`AbortController` timeout/custom registry. `test/updateCheckHook.test.ts` covers 5 scenarios on the hook itself: opt-out, throttle, no update, network down, malformed timestamp file.

**Docs**

- "Updating" section of the README rewritten in pt-BR and en-US describing `/ringly-update`, the auto-check, the manual update and how to disable the check.
- `plugin/README.md` now lists the 5 hooks (including `SessionStart`) and the new slash command.
- `CONTRIBUTING.md` updated: test count (129), event whitelist with `SessionStart`, and the project layout lists the new files (`commands/ringly-update.md`, `core/ownVersion.ts`, `core/updateCheck.ts`, `commands/update.ts`, `commands/updateCheckHook.ts`).

---

## [0.3.0] — 2026-05-25

### 🇧🇷 Português

**Mudança incompatível**

- **Removido o sistema legacy completo.** O módulo `src/core/legacy.ts`, as flags `ringly init --migrate-legacy` e `ringly uninstall --legacy`, o check `legacy` do `doctor` e a seção de migração no README foram **deletados**. Esse sistema existia para detectar e desativar hooks PowerShell pré-Ringly (`~/.claude/hooks/notify-toast.ps1`) que poderiam disparar notificações em paralelo. Como o Ringly já está estabelecido há várias versões e o público-alvo agora é quem instala via marketplace direto, essa ponte de compatibilidade virou peso morto. **Migração:** se você ainda tem hooks PowerShell antigos rodando em `~/.claude/hooks/`, remova manualmente antes de instalar o Ringly 0.3.0 (ou rode `ringly uninstall --legacy` na 0.2.x antes de atualizar).
- **Removido o fallback de `~/.config/ringly/config.json`** (env-paths). A config do Ringly agora vive **apenas** em `~/.claude/settings.json` na chave `pluginConfigs.ringly.options`. Instalações pré-0.2.x precisam rodar `ringly init` uma vez para migrar; instalações 0.2.x+ já usam `settings.json` como fonte primária e não precisam fazer nada. Bundle ficou ~14KB menor no `cli.js` e ~3KB menor no `hook.js` por causa disso.
- **`ringly uninstall`** agora limpa a chave `pluginConfigs.ringly` do `settings.json` (com write atômico + backup) em vez de apagar o `config.json` antigo. A flag `--keep-config` continua disponível para preservar a configuração.

**Segurança & robustez**

- **Escrita atômica de `~/.claude/settings.json`** (`src/core/atomicWrite.ts`). Antes, `writeFileSync` escrevia direto no arquivo final, e uma race entre `ringly config` (TUI) e um hook disparado pelo Claude Code podia corromper o settings ou perder mudanças. Agora a escrita vai para um arquivo temporário (`settings.json.tmp.<pid>.<rand>`) e só renomeia para o arquivo final em uma operação atômica (atomic rename no NTFS desde Windows Vista; garantido pelo POSIX). Em caso de falha, o tmp é removido — nada de arquivo parcial.
- **Validação leve de payload do hook** (`src/core/payloadGuards.ts`). O JSON vindo de stdin do Claude Code agora passa por `coerceClaudeHookPayload`, que: aceita só `hook_event_name` da whitelist, trunca strings (`message`, `agent_type`, `error_type`, `error`) em 500 caracteres, trunca paths (`cwd`, `transcript_path`) em 1024 caracteres, e descarta campos desconhecidos. Sem nova dependência; resolve risco de DoS por payload gigante e blindagem em profundidade contra entradas inesperadas.
- **Limite de stdin reduzido de 10 MB para 256 KB** no CLI (`src/core/stdin.ts`) e no dispatcher do plugin (`plugin/hooks/dispatch.mjs`). Payloads do Claude Code são tipicamente <2 KB; 256 KB já é uma defesa generosa.
- **Validação do `appId` carregado da config** (`src/core/config.ts`). Apenas `[A-Za-z0-9._-]{1,128}` é aceito. Valores inválidos no `settings.json` caem no default `Claude.Code.CLI` com aviso no log. Defesa em profundidade — o PowerShell escape já era seguro, mas validação explícita evita surpresas se um plugin terceiro escrever lixo no campo.
- **Permissão 0600 do `settings.json`** em Linux/macOS após cada escrita. Como o arquivo pode conter tokens de outros plugins, restringir leitura a só o usuário dono é a postura correta. Windows continua respeitando ACLs herdadas do `~/.claude`.
- **GC automático de backups antigos**. Antes, cada `ringly config` deixava um `settings.json.ringly-bak.<timestamp>` permanente. Agora, backups com mais de 7 dias são removidos automaticamente antes de criar um novo.
- **Rotação de log a 5 MB** (`src/core/logger.ts`). Antes, o `ringly.log` crescia indefinidamente em debug mode. Agora, quando passa de 5 MB, é rotacionado para `ringly.log.1` (sobrescrevendo a rotação anterior). Check é throttled a uma vez por minuto para não impactar o caminho quente.

**Comportamento**

- **Detecção de idioma reordenada**: prioridade agora é `CLAUDE_PLUGIN_OPTION_LANGUAGE` → `Intl.DateTimeFormat` → `LANG`/`LC_*` → fallback `en-US`. Antes, `LANG` vinha antes do Intl, o que dava resultado errado para usuários BR rodando Claude Code a partir de WSL/Git Bash com `LANG=C.UTF-8`.
- **Toast em macOS/Linux agora avisa explicitamente que não está implementado** em vez de falhar silenciosamente. O `isAvailable()` do canal toast retorna `true` para windows/macos/linux, e os stubs de macOS/Linux imprimem uma mensagem clara em stderr (uma única vez por processo) apontando para o tracker do GitHub. Antes, o `ringly test` em macOS virava no-op silencioso e o usuário não entendia o porquê.

**Build & empacotamento**

- **Tarball npm reduzido**. `package.json#files` agora inclui apenas `bin/`, `dist/`, `plugin/`, `scripts/`, `README.md`, `LICENSE`, `CHANGELOG.md`. `src/`, `tsup.config.ts`, `tsconfig.json` saíram — usuários finais não precisam do código-fonte nem da config de build (que só é usada via `npm install -g <github-shorthand>` e isso já está coberto por `scripts/prepare.js`).
- **`sideEffects: false`** habilitado no `package.json` para que consumidores que importem `ringly/hook` ganhem tree-shaking real.
- **Versões sincronizadas**: `package.json`, `plugin/.claude-plugin/plugin.json` agora ambos em `0.3.0`. Antes havia divergência (`package.json@0.2.4` vs `plugin.json@0.2.1`).

**CI / Release**

- **`npm run lint`** agora cobre também `plugin/hooks/` (o `dispatch.mjs`), que estava lintado em dev (via `biome.json#includes`) mas não no CI.
- **Smoke run do bundle no CI**: cada build agora roda `node dist/cli.js --version`, `--help`, e (no Ubuntu) executa o `dist/hook.js` com payload de exemplo. Pega erros de import circular / runtime de top-level antes do publish.
- **Verificação de versão no release**: o workflow `release.yml` agora valida que a tag git, `package.json#version` e `plugin.json#version` batem antes de publicar. Bloqueia inconsistências silenciosas.
- **Timeout do dispatcher** padronizado para 12s (era 10s), dando folga sobre os 8s do PowerShell para evitar matar o child node antes do toast terminar.

**Testes**

- **+12 testes novos**: `test/payloadGuards.test.ts` (sanitização), `test/stdin.test.ts` (BOM, maxBytes, timeout, TTY), `test/notifier.test.ts` (isEventEnabled + buildIntent), `test/channels.test.ts` (dispatch isolation, isAvailable rejection), `test/runHook.test.ts` (end-to-end mockado do hook). O caminho crítico do plugin antes era exercitado só por unit tests fragmentados; agora tem cobertura direta.
- **Testes adicionais para `claudeSettings`**: garantem que não fica `.tmp.*` órfão após write, e que o GC de backups respeita a janela de 7 dias.
- **Testes para `detectSystemLanguage`** com mocks de `Intl.DateTimeFormat` validando a nova ordem de fallback.

### 🇺🇸 English

**Breaking change**

- **Removed the entire legacy system.** The `src/core/legacy.ts` module, the `ringly init --migrate-legacy` and `ringly uninstall --legacy` flags, the `doctor` legacy check, and the migration section in the README were **deleted**. This system existed to detect and disable pre-Ringly PowerShell hooks (`~/.claude/hooks/notify-toast.ps1`) that could fire duplicate notifications alongside Ringly. Since Ringly has been stable across several versions and the target audience now installs directly via marketplace, this compatibility bridge became dead weight. **Migration:** if you still have legacy PowerShell hooks in `~/.claude/hooks/`, remove them manually before installing Ringly 0.3.0 (or run `ringly uninstall --legacy` on 0.2.x before upgrading).
- **Removed the `~/.config/ringly/config.json` (env-paths) fallback.** Ringly config now lives **only** in `~/.claude/settings.json` under `pluginConfigs.ringly.options`. Pre-0.2.x installs need to run `ringly init` once to migrate; 0.2.x+ installs already use `settings.json` as the primary source and don't need to do anything. Bundle shrunk ~14KB on `cli.js` and ~3KB on `hook.js` as a result.
- **`ringly uninstall`** now removes the `pluginConfigs.ringly` key from `settings.json` (with atomic write + backup) instead of deleting the old `config.json`. The `--keep-config` flag still exists to preserve your settings.

**Security & robustness**

- **Atomic write of `~/.claude/settings.json`** (`src/core/atomicWrite.ts`). Previously, `writeFileSync` wrote directly to the final file; a race between `ringly config` (TUI) and a hook fired by Claude Code could corrupt settings or lose changes. Writes now go to a temp file (`settings.json.tmp.<pid>.<rand>`) and only get renamed to the final file via an atomic rename (atomic on NTFS since Windows Vista; guaranteed by POSIX). On failure the tmp is removed — no partial files.
- **Lightweight payload validation** (`src/core/payloadGuards.ts`). JSON from Claude Code's stdin now passes through `coerceClaudeHookPayload`: accepts only whitelisted `hook_event_name` values, truncates strings (`message`, `agent_type`, `error_type`, `error`) at 500 chars, truncates paths (`cwd`, `transcript_path`) at 1024 chars, and drops unknown fields. No new dependency; addresses DoS-via-large-payload risk and adds defense in depth.
- **Stdin limit reduced from 10 MB to 256 KB** in both the CLI (`src/core/stdin.ts`) and the plugin dispatcher (`plugin/hooks/dispatch.mjs`). Real Claude Code payloads are typically <2 KB; 256 KB is already a generous defense.
- **Validation of `appId`** loaded from config (`src/core/config.ts`). Only `[A-Za-z0-9._-]{1,128}` accepted; invalid values fall back to the default `Claude.Code.CLI` with a warning. Defense in depth — PowerShell escaping was already safe, but explicit validation prevents surprises if a third-party plugin writes garbage to the field.
- **`settings.json` set to mode 0600** on Linux/macOS after each write. Since the file may contain tokens from other plugins, restricting reads to the owner is the correct posture. Windows still inherits `~/.claude` ACLs.
- **Automatic GC of old backups**. Previously, each `ringly config` left a permanent `settings.json.ringly-bak.<timestamp>`. Backups older than 7 days are now removed automatically before creating a new one.
- **Log rotation at 5 MB** (`src/core/logger.ts`). Previously, `ringly.log` grew unbounded in debug mode. Files over 5 MB are now rotated to `ringly.log.1` (overwriting the previous rotation). The size check is throttled to once per minute to keep the hot path cheap.

**Behavior**

- **Locale detection reordered**: precedence is now `CLAUDE_PLUGIN_OPTION_LANGUAGE` → `Intl.DateTimeFormat` → `LANG`/`LC_*` → fallback `en-US`. Previously `LANG` came before Intl, which gave wrong results for BR users running Claude Code from WSL/Git Bash with `LANG=C.UTF-8`.
- **macOS/Linux toast now warns explicitly that it is not implemented** instead of failing silently. The toast channel's `isAvailable()` returns `true` for windows/macos/linux, and the macOS/Linux stubs print a clear stderr message (once per process) pointing to the GitHub tracker. Previously, `ringly test` on macOS was a silent no-op.

**Build & packaging**

- **Smaller npm tarball**. `package.json#files` now only includes `bin/`, `dist/`, `plugin/`, `scripts/`, `README.md`, `LICENSE`, `CHANGELOG.md`. `src/`, `tsup.config.ts`, `tsconfig.json` removed — end users don't need the source nor the build config (which is only used when installing via `npm install -g <github-shorthand>`, already covered by `scripts/prepare.js`).
- **`sideEffects: false`** enabled in `package.json` so consumers importing `ringly/hook` get real tree-shaking.
- **Versions synced**: `package.json` and `plugin/.claude-plugin/plugin.json` are both at `0.3.0` now. Previously there was a mismatch (`package.json@0.2.4` vs `plugin.json@0.2.1`).

**CI / Release**

- **`npm run lint`** now also covers `plugin/hooks/` (the `dispatch.mjs`), which was being linted in dev (via `biome.json#includes`) but not in CI.
- **Bundle smoke run in CI**: each build now runs `node dist/cli.js --version`, `--help`, and (on Ubuntu) executes `dist/hook.js` with a sample payload. Catches top-level runtime / circular import errors before publish.
- **Version-check on release**: the `release.yml` workflow now validates that the git tag, `package.json#version`, and `plugin.json#version` all match before publishing. Blocks silent inconsistencies.
- **Dispatcher timeout** standardized to 12s (was 10s), giving margin over the 8s PowerShell timeout to avoid killing the child node before the toast finishes.

**Tests**

- **+12 new tests**: `test/payloadGuards.test.ts` (sanitization), `test/stdin.test.ts` (BOM, maxBytes, timeout, TTY), `test/notifier.test.ts` (isEventEnabled + buildIntent), `test/channels.test.ts` (dispatch isolation, isAvailable rejection), `test/runHook.test.ts` (mocked end-to-end hook). The plugin's critical path was previously exercised only through fragmented unit tests; now it has direct coverage.
- **Additional `claudeSettings` tests**: ensure no `.tmp.*` orphan remains after a write, and that backup GC respects the 7-day window.
- **`detectSystemLanguage` tests** with `Intl.DateTimeFormat` mocks validating the new fallback order.

---

## [0.2.4] — 2026-05-26

### 🇧🇷 Português

**Corrigido**

- **Notificações silenciosamente bloqueadas no Windows 11 / PowerShell 5.1.** Em vários setups (especialmente Claude Code instalado via npm global e AUMID registrado por shortcut), o toast nunca aparecia visualmente — só tocava um `beep` curto. A causa raiz é um bug conhecido do PowerShell ([PowerShell#9816](https://github.com/PowerShell/PowerShell/issues/9816)): objetos WinRT implementam `IInspectable` mas não `IDispatch`, fazendo com que `$notifier.Setting` retorne um enum mal-tipado quando comparado com `[NotificationSetting]::Enabled` ou concatenado em string. O resultado era um falso positivo de `BLOCKED:` (com valor vazio nos logs) que abortava o `Show()` antes mesmo da notificação ser disparada. Agora a checagem usa `$notifier.Setting.value__` (campo intrínseco de qualquer enum .NET, acessado diretamente sem passar pelo COM adapter quebrado) e compara com o inteiro `0`. Se a leitura falhar por qualquer motivo, o código segue em frente e tenta o `Show()` — qualquer erro real cai no `catch` com mensagem útil em vez de um bloqueio fantasma.
- **Fallback `[Console]::Beep(800, 200)` removido do caminho de bloqueio.** Esse beep curto estava sendo emitido quando a checagem dava falso positivo e confundia o usuário (parecia que a notificação tinha chegado, mas era só o beep). Quando o toast é realmente bloqueado por configuração do sistema, agora o CLI retorna `BLOCKED:` com o motivo legível (`DisabledForApplication`, `DisabledForUser`, `DisabledByGroupPolicy`, `DisabledByManifest`) sem emitir nenhum som.

**Adicionado**

- **Testes para `ps-templates.ts`** garantindo que a nova checagem robusta está presente no script gerado, que o beep enganoso foi removido, e que o escape de aspas simples funciona em AUMID, XML e shortcut path.

### 🇺🇸 English

**Fixed**

- **Silently blocked notifications on Windows 11 / PowerShell 5.1.** On several setups (especially Claude Code installed via npm global with AUMID registered through a shortcut), the toast never appeared visually — only a short `beep` played. The root cause is a known PowerShell bug ([PowerShell#9816](https://github.com/PowerShell/PowerShell/issues/9816)): WinRT objects implement `IInspectable` but not `IDispatch`, which makes `$notifier.Setting` return a mis-typed enum when compared with `[NotificationSetting]::Enabled` or concatenated into a string. The result was a false-positive `BLOCKED:` (with empty value in the logs) that aborted `Show()` before the notification was even dispatched. The check now reads `$notifier.Setting.value__` (the intrinsic backing field of any .NET enum, accessed directly without going through the broken COM adapter) and compares against integer `0`. If the read fails for any reason, the code proceeds and calls `Show()` anyway — any real error falls into the `catch` with a meaningful message rather than a phantom block.
- **Removed the `[Console]::Beep(800, 200)` fallback on the blocked path.** That short beep was being emitted whenever the check false-positived and misled the user (it sounded like the notification had arrived, but it was just the beep). When the toast is genuinely blocked by system configuration, the CLI now returns `BLOCKED:` with a readable reason (`DisabledForApplication`, `DisabledForUser`, `DisabledByGroupPolicy`, `DisabledByManifest`) without emitting any sound.

**Added**

- **Tests for `ps-templates.ts`** ensuring the new robust check is present in the generated script, that the misleading beep was removed, and that single-quote escaping works for AUMID, XML, and shortcut path.

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

[Unreleased]: https://github.com/nickdevcode/Ringly/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/nickdevcode/Ringly/releases/tag/v0.5.0
[0.4.0]: https://github.com/nickdevcode/Ringly/releases/tag/v0.4.0
[0.3.0]: https://github.com/nickdevcode/Ringly/releases/tag/v0.3.0
[0.2.4]: https://github.com/nickdevcode/Ringly/releases/tag/v0.2.4
[0.2.1]: https://github.com/nickdevcode/Ringly/releases/tag/v0.2.1
[0.2.0]: https://github.com/nickdevcode/Ringly/releases/tag/v0.2.0
[0.1.1]: https://github.com/nickdevcode/Ringly/releases/tag/v0.1.1
[0.1.0]: https://github.com/nickdevcode/Ringly/releases/tag/v0.1.0
