# Contribuindo / Contributing

> Como contribuir com o Ringly. / How to contribute to Ringly.

---

## 🇧🇷 Português

Valeu por querer ajudar a melhorar o Ringly! Esse guia é direto pra você começar
rápido — sem firula. Se algo aqui estiver desatualizado, abre um PR consertando, é
a melhor primeira contribuição possível.

### Como conversar antes de codar

- **Bug?** Abre uma *issue* usando o template **Bug report**. Roda `ringly doctor` e
  cola a saída — sem isso fica difícil ajudar.
- **Ideia de feature?** Abre uma *issue* com o template **Feature request** antes de
  começar a codar. Evita você gastar tempo numa PR que precisa redesenhar.
- **Dúvida?** Template **Question / Support**. Sem julgamento, pode perguntar.

### Pré-requisitos

- **Node.js 20+** (recomendado: 22 LTS)
- **npm 10+**
- **Windows 10 ou 11** se quiser testar o toast nativo (macOS/Linux ainda estão como stubs)
- **PowerShell 5.1+** (já vem com o Windows)
- **Git**

### Setup local

```bash
git clone https://github.com/nickdevcode/Ringly.git
cd Ringly
npm install         # roda scripts/prepare.js, que faz build se dist/ não existir
npm run build       # build explícito (idempotente)
node dist/cli.js doctor
```

> O `scripts/prepare.js` roda automaticamente no `npm install` e compila o
> `dist/` se ele não estiver presente. Em CI, ele pula via `RINGLY_SKIP_PREPARE=1`
> ou `CI=true` para não duplicar build. Você raramente precisa pensar nele.

Se o `doctor` reportar tudo verde, você está pronto. Se o AUMID falhar, rode
`node dist/cli.js init --non-interactive` para registrar.

### Comandos de desenvolvimento

| Comando                | O que faz                                              |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Build em modo watch (recompila ao salvar)              |
| `npm run typecheck`    | `tsc --noEmit` — checa tipos                           |
| `npm run lint`         | Biome (lint + format check, inclui `plugin/hooks/`)    |
| `npm run lint:fix`     | Biome com auto-correção                                |
| `npm test`             | Vitest (129 testes, ~600 ms)                            |
| `npm run test:watch`   | Vitest em watch                                        |
| `npm run test:coverage`| Vitest com cobertura v8 (thresholds: 70% / 65% branch) |
| `npm run build`        | Build de produção (ESM + CJS + DTS)                    |

Antes de abrir PR, smoke-teste o bundle:

```bash
node dist/cli.js --version
node dist/cli.js --help
echo '{"hook_event_name":"Stop","cwd":"/tmp"}' | node dist/hook.js Stop
```

### Padrões do código

- **TypeScript estrito** (`strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`)
- **Sem comentários** desnecessários — o código deve se explicar pelos nomes
- **Sem `any`** sem motivo (Biome avisa)
- **Falha silenciosa** no caminho do hook — qualquer exceção vira `logger.error()`,
  o processo sempre retorna `exit 0` pra não quebrar o Claude Code do usuário.
  Exemplo: `src/commands/hook.ts:39-44` (catch grande engloba tudo).
- **Falha verbosa** no caminho da CLI — erros vão pra `stderr` e exit code != 0.
  Exemplo: `src/cli.ts:135-145` (yargs `.fail()` + `process.exit(1)`).
- **i18n via locales/** — toda string visível ao usuário entra em `pt-BR.json` e
  `en-US.json`; não hardcode texto em código.
- **Atomic writes** em arquivos de config (`~/.claude/settings.json`) — use
  `atomicWriteFileSync` de `src/core/atomicWrite.ts`, nunca `fs.writeFileSync`
  direto, pra evitar corrupção em writes concorrentes.

### Limites e validação (segurança)

Se você está adicionando código que toca payload de hook ou config externa,
respeite estes limites já estabelecidos:

- **Stdin do hook**: máximo **256 KB** (`src/core/stdin.ts`). Payloads reais do
  Claude Code são <2 KB.
- **Strings do payload**: truncadas em **500 caracteres** (`message`,
  `agent_type`, `error_type`, `error`). Veja `src/core/payloadGuards.ts`.
- **Paths do payload**: truncados em **1024 caracteres** (`cwd`, `transcript_path`).
- **`appId`**: validado contra `/^[A-Za-z0-9._-]{1,128}$/`
  (`src/core/config.ts::normalizeAppId`). Valores inválidos viram
  `DEFAULT_APP_ID` com warn no log.
- **Eventos**: whitelist hard-coded em `ALLOWED_EVENTS` (`Notification`, `Stop`,
  `StopFailure`, `SubagentStop`, `SessionStart`). `SessionStart` é o único que
  não vira toast direto — ele dispara a checagem de update (veja
  `src/commands/updateCheckHook.ts`). Não adicione evento novo sem atualizar a
  whitelist em `hook.ts`, `hooks.json`, `dispatch.mjs` e `plugin.json` ao mesmo tempo.

### Como abrir uma PR

1. Faz fork do repositório.
2. Cria branch a partir de `main`: `git checkout -b feat/minha-feature` (ou `fix/...`).
3. Codifica. Antes do commit, roda `npm run lint:fix && npm test && npm run typecheck`.
4. Commit usando [Conventional Commits](https://www.conventionalcommits.org/pt-br/):
   - `feat: add macOS toast back-end`
   - `fix: handle empty hook payload`
   - `docs: improve README setup steps`
   - `refactor: extract translator interface`
   - `test: cover stopFailure billing path`
   - `chore: bump deps`
5. Push e abre a PR contra `main` descrevendo:
   - **O quê** mudou
   - **Por quê** (link pra issue se houver)
   - **Como testar** (passos manuais ou comando de teste)
6. O CI roda automático em Windows / macOS / Linux × Node 20/22 com lint,
   typecheck, testes, build e smoke (`node dist/cli.js --version/--help`). Se
   quebrar, ajusta.
7. Eu reviso e mergeio. Para mudanças grandes, vou pedir issue prévia.

### Ciclo de release (manutenção, não pra contribuidores)

Só pra você entender o fluxo:

1. Bump da versão em **dois lugares**: `package.json` e
   `plugin/.claude-plugin/plugin.json` — precisam estar sincronizados.
2. Entrada no `CHANGELOG.md` em pt-BR + en-US (formato Keep a Changelog).
3. Commit `chore(release): vX.Y.Z` + tag anotada `vX.Y.Z`.
4. Push da tag dispara `.github/workflows/release.yml`, que valida (lint +
   typecheck + test + build), confere se tag bate com `package.json` e
   `plugin.json`, depois roda `npm publish --provenance --access public` e
   cria a release no GitHub.

### Estrutura do projeto

```
Ringly/
├── plugin/                            # camada do plugin do Claude Code
│   ├── .claude-plugin/plugin.json    # manifesto do plugin (sem userConfig — config é só via `ringly config`)
│   ├── commands/
│   │   └── ringly-update.md          # slash command /ringly-update
│   └── hooks/
│       ├── hooks.json                # mapeia os 5 eventos pro dispatch.mjs
│       └── dispatch.mjs              # shim Node standalone (sem deps externas)
├── src/
│   ├── cli.ts + hook.ts              # dois entries separados (CLI vs hook crítico)
│   ├── core/
│   │   ├── atomicWrite.ts            # write tmp + rename atômico
│   │   ├── claudeSettings.ts         # I/O de ~/.claude/settings.json
│   │   ├── config.ts                 # loadConfig/saveConfig + applyEnvOverrides
│   │   ├── eventMapper.ts            # payload → NotificationIntent
│   │   ├── logger.ts                 # append + rotação a 5MB
│   │   ├── notifier.ts               # orquestra notify() do hook
│   │   ├── ownVersion.ts             # helper walk-up pro package.json do ringly
│   │   ├── payloadGuards.ts          # sanitização do payload do hook
│   │   ├── stdin.ts                  # read stdin com timeout + maxBytes
│   │   ├── translator.ts             # i18n (pt-BR / en-US)
│   │   ├── types.ts                  # tipos públicos
│   │   ├── updateCheck.ts            # checagem npm + comparação semver + throttle
│   │   └── xml.ts                    # escape XML
│   ├── channels/                     # toast (Windows hoje); webhook futuro
│   ├── platform/{windows,macos,linux}/  # backends por SO (macOS/Linux são stubs)
│   ├── commands/                     # init, config, doctor, test, hook, update, updateCheckHook, uninstall
│   ├── locales/                      # pt-BR.json, en-US.json
│   └── tui/                          # telas Ink (App.tsx + screens/)
├── test/                             # 129 testes Vitest
└── scripts/prepare.js                # build sob demanda no npm install
```

### Sobre o `plugin/hooks/dispatch.mjs`

Esse arquivo é **standalone por design** — não importa nada de `src/`, não usa
TypeScript, não tem deps externas. Ele roda direto via `node dispatch.mjs` quando
o Claude Code dispara um hook, antes mesmo da CLI estar instalada.

Por isso ele **duplica** lógica que existe em `src/`:
- O `escapeXml()` duplica `src/core/xml.ts::escapeXmlText`
- O `detectLanguage()` duplica parte de `src/core/translator.ts::detectSystemLanguage`
- O `EMBEDDED_TRANSLATIONS` duplica fragmentos dos `locales/*.json`

**Se você mudar a versão em `src/`, lembre de mudar a versão correspondente em
`dispatch.mjs` também.** O CI lintificará ambos via Biome (`plugin/hooks/` está
no `biome.json#includes`), mas mudanças de comportamento não são detectadas
automaticamente.

### Sobre o `plugin.json` sem `userConfig`

A partir da v0.5.0 o `plugin/.claude-plugin/plugin.json` **propositalmente
não declara `userConfig`**. Isso esconde a tela `/plugin` → Installed →
Ringly → Configure do Claude Code. A motivação está documentada na seção
"Configuração" do `README.md`, mas em resumo:

- O schema de `userConfig` do Claude Code não tem suporte a `enum`, então o
  campo `language` virava input de texto livre — qualquer typo silenciosamente
  caía em `auto`.
- Em booleanos do plugin manager, `Enter` apenas navega entre campos; só
  `Space` toggla. Várias issues reportaram "desliguei e continuou ligado".
- Não há atomic write nem aviso de `/reload-plugins`.

**Antes de propor reintroduzir o `userConfig`**, confirme que a Anthropic
adicionou suporte a `enum` no schema (veja
[plugin reference oficial](https://code.claude.com/docs/en/plugins-reference#user-configuration))
ou descreva na issue como resolver os pontos acima sem regressão de UX.

### Áreas que aceitam contribuição agora

Procure issues marcadas com `good first issue` ou:

- 🍏 **macOS toast** — implementar `src/platform/macos/toast.ts` com `osascript` ou bindings nativos
- 🐧 **Linux toast** — implementar `src/platform/linux/toast.ts` com `notify-send` ou DBus
- 🌎 **Novos idiomas** — adicionar `src/locales/<locale>.json` (es-ES, fr-FR, etc.)
- 🔌 **Webhook channel** — `src/channels/webhook.ts` para Discord/Slack/Telegram
- 📸 **Screenshots e GIFs** no README — mostrando a TUI do `ringly init`
- 🧪 **Mais testes** — cobertura de edge cases do `eventMapper`

### Código de conduta

Seja respeitoso. Sem assédio, sem discriminação. Reviews focam em código, não em
pessoa. Se rolar algo fora disso, me chama por DM ou abre issue privada.

### Licença

Toda contribuição entra sob a [licença MIT](./LICENSE) do projeto.

---

## 🇺🇸 English

Thanks for wanting to help improve Ringly! This guide is straight to the point — no
fluff. If anything here is outdated, open a PR to fix it; that's the best possible
first contribution.

### Talk before coding

- **Bug?** File an *issue* using the **Bug report** template. Run `ringly doctor`
  and paste the output — without it, troubleshooting is hard.
- **Feature idea?** File an *issue* with the **Feature request** template *before*
  coding. Saves you from rewriting a PR.
- **Question?** Use the **Question / Support** template. No judgement — ask away.

### Prerequisites

- **Node.js 20+** (recommended: 22 LTS)
- **npm 10+**
- **Windows 10 or 11** to test the native toast (macOS/Linux are still stubs)
- **PowerShell 5.1+** (ships with Windows)
- **Git**

### Local setup

```bash
git clone https://github.com/nickdevcode/Ringly.git
cd Ringly
npm install         # runs scripts/prepare.js, which builds dist/ if missing
npm run build       # explicit build (idempotent)
node dist/cli.js doctor
```

> `scripts/prepare.js` runs automatically on `npm install` and compiles `dist/`
> only if it's missing. In CI it skips via `RINGLY_SKIP_PREPARE=1` or `CI=true`
> to avoid duplicate builds. You rarely need to think about it.

If `doctor` reports everything green, you're ready. If AUMID fails, run
`node dist/cli.js init --non-interactive` to register it.

### Development commands

| Command                 | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `npm run dev`           | Watch-mode build (recompiles on save)                   |
| `npm run typecheck`     | `tsc --noEmit` — type-checks the project                |
| `npm run lint`          | Biome (lint + format check, covers `plugin/hooks/`)     |
| `npm run lint:fix`      | Biome with auto-fix                                     |
| `npm test`              | Vitest (129 tests, ~600 ms)                              |
| `npm run test:watch`    | Vitest in watch mode                                    |
| `npm run test:coverage` | Vitest with v8 coverage (thresholds: 70% / 65% branch)  |
| `npm run build`         | Production build (ESM + CJS + DTS)                      |

Before opening a PR, smoke-test the bundle:

```bash
node dist/cli.js --version
node dist/cli.js --help
echo '{"hook_event_name":"Stop","cwd":"/tmp"}' | node dist/hook.js Stop
```

### Code standards

- **Strict TypeScript** (`strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`)
- **No unnecessary comments** — code should be self-explanatory by names
- **No `any`** without justification (Biome warns)
- **Silent failure** on the hook path — every exception becomes `logger.error()`,
  the process always exits `0` so it never breaks the user's Claude Code.
  Example: `src/commands/hook.ts:39-44` (outer catch wraps everything).
- **Verbose failure** on the CLI path — errors go to `stderr` with a non-zero exit.
  Example: `src/cli.ts:135-145` (yargs `.fail()` + `process.exit(1)`).
- **i18n via locales/** — every user-facing string lives in `pt-BR.json` and
  `en-US.json`; never hardcode text in source.
- **Atomic writes** on config files (`~/.claude/settings.json`) — use
  `atomicWriteFileSync` from `src/core/atomicWrite.ts`, never raw
  `fs.writeFileSync`, to avoid corruption from concurrent writes.

### Limits and validation (security)

If you're adding code that touches hook payloads or external config, respect
these established limits:

- **Hook stdin**: maximum **256 KB** (`src/core/stdin.ts`). Real Claude Code
  payloads are <2 KB.
- **Payload strings**: truncated to **500 characters** (`message`, `agent_type`,
  `error_type`, `error`). See `src/core/payloadGuards.ts`.
- **Payload paths**: truncated to **1024 characters** (`cwd`, `transcript_path`).
- **`appId`**: validated against `/^[A-Za-z0-9._-]{1,128}$/`
  (`src/core/config.ts::normalizeAppId`). Invalid values fall back to
  `DEFAULT_APP_ID` with a warning log.
- **Events**: hard-coded whitelist in `ALLOWED_EVENTS` (`Notification`, `Stop`,
  `StopFailure`, `SubagentStop`, `SessionStart`). `SessionStart` is the only
  event that does not turn into a toast directly — it triggers the update
  check instead (see `src/commands/updateCheckHook.ts`). Don't add a new event
  without updating the whitelist in `hook.ts`, `hooks.json`, `dispatch.mjs`,
  and `plugin.json` at the same time.

### How to open a PR

1. Fork the repo.
2. Create a branch from `main`: `git checkout -b feat/my-feature` (or `fix/...`).
3. Code. Before committing, run `npm run lint:fix && npm test && npm run typecheck`.
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add macOS toast back-end`
   - `fix: handle empty hook payload`
   - `docs: improve README setup steps`
   - `refactor: extract translator interface`
   - `test: cover stopFailure billing path`
   - `chore: bump deps`
5. Push and open the PR against `main` describing:
   - **What** changed
   - **Why** (link to the issue if any)
   - **How to test** (manual steps or test command)
6. CI runs automatically on Windows / macOS / Linux × Node 20/22 with lint,
   typecheck, tests, build, and smoke (`node dist/cli.js --version/--help`).
   Fix any failures.
7. I review and merge. For big changes, I'll ask for a prior issue.

### Release cycle (maintenance, not for contributors)

For context, here's the flow:

1. Bump the version in **two places**: `package.json` and
   `plugin/.claude-plugin/plugin.json` — they must stay in sync.
2. Add a `CHANGELOG.md` entry in pt-BR + en-US (Keep a Changelog format).
3. Commit `chore(release): vX.Y.Z` + annotated tag `vX.Y.Z`.
4. Pushing the tag triggers `.github/workflows/release.yml`, which validates
   (lint + typecheck + test + build), confirms the tag matches both
   `package.json` and `plugin.json`, then runs
   `npm publish --provenance --access public` and creates the GitHub release.

### Project layout

```
Ringly/
├── plugin/                            # Claude Code plugin layer
│   ├── .claude-plugin/plugin.json    # plugin manifest (no userConfig — config is CLI-only via `ringly config`)
│   ├── commands/
│   │   └── ringly-update.md          # /ringly-update slash command
│   └── hooks/
│       ├── hooks.json                # maps the 5 events to dispatch.mjs
│       └── dispatch.mjs              # standalone Node shim (no external deps)
├── src/
│   ├── cli.ts + hook.ts              # two separate entries (CLI vs hot-path hook)
│   ├── core/
│   │   ├── atomicWrite.ts            # tmp + atomic rename writer
│   │   ├── claudeSettings.ts         # ~/.claude/settings.json I/O
│   │   ├── config.ts                 # loadConfig/saveConfig + applyEnvOverrides
│   │   ├── eventMapper.ts            # payload → NotificationIntent
│   │   ├── logger.ts                 # append + 5 MB rotation
│   │   ├── notifier.ts               # orchestrates the hook's notify()
│   │   ├── ownVersion.ts             # walk-up helper that finds the ringly package.json
│   │   ├── payloadGuards.ts          # hook payload sanitization
│   │   ├── stdin.ts                  # read stdin with timeout + maxBytes
│   │   ├── translator.ts             # i18n (pt-BR / en-US)
│   │   ├── types.ts                  # public types
│   │   ├── updateCheck.ts            # npm check + semver compare + 24h throttle
│   │   └── xml.ts                    # XML escape
│   ├── channels/                     # toast (Windows today); webhook future
│   ├── platform/{windows,macos,linux}/  # OS back-ends (macOS/Linux are stubs)
│   ├── commands/                     # init, config, doctor, test, hook, update, updateCheckHook, uninstall
│   ├── locales/                      # pt-BR.json, en-US.json
│   └── tui/                          # Ink screens (App.tsx + screens/)
├── test/                             # 129 Vitest tests
└── scripts/prepare.js                # on-demand build during npm install
```

### About `plugin/hooks/dispatch.mjs`

This file is **standalone by design** — it imports nothing from `src/`, uses no
TypeScript, and has no external deps. It runs via `node dispatch.mjs` directly
when Claude Code fires a hook, even before the CLI is installed.

Because of that it **duplicates** logic that also lives in `src/`:
- `escapeXml()` duplicates `src/core/xml.ts::escapeXmlText`
- `detectLanguage()` duplicates part of `src/core/translator.ts::detectSystemLanguage`
- `EMBEDDED_TRANSLATIONS` duplicates fragments of `locales/*.json`

**If you change the version in `src/`, remember to change the matching version
in `dispatch.mjs` too.** CI will lint both via Biome (`plugin/hooks/` is in
`biome.json#includes`), but behavioral drift is not detected automatically.

### About `plugin.json` with no `userConfig`

Starting in v0.5.0, `plugin/.claude-plugin/plugin.json` **intentionally does
not declare `userConfig`**. That hides the Claude Code `/plugin` → Installed
→ Ringly → Configure screen. The full rationale lives in the README's
"Configuration" section, but the short version:

- Claude Code's `userConfig` schema has no `enum` support, so the `language`
  field was a free-text input — any typo silently fell back to `auto`.
- In the plugin manager UI, `Enter` on a boolean only navigates between
  fields; only `Space` toggles. Several issues reported "I unchecked it and
  it stayed on".
- No atomic write, no reminder to run `/reload-plugins`.

**Before proposing to bring `userConfig` back**, confirm Anthropic has added
`enum` support to the schema (see the
[official plugin reference](https://code.claude.com/docs/en/plugins-reference#user-configuration))
or describe in your issue how to address the points above without regressing
UX.

### Areas open for contribution right now

Look for issues labeled `good first issue`, or pick from:

- 🍏 **macOS toast** — implement `src/platform/macos/toast.ts` with `osascript` or native bindings
- 🐧 **Linux toast** — implement `src/platform/linux/toast.ts` with `notify-send` or DBus
- 🌎 **New languages** — add `src/locales/<locale>.json` (es-ES, fr-FR, etc.)
- 🔌 **Webhook channel** — `src/channels/webhook.ts` for Discord/Slack/Telegram
- 📸 **Screenshots and GIFs** for the README — showing the `ringly init` TUI
- 🧪 **More tests** — edge cases of `eventMapper`

### Code of conduct

Be respectful. No harassment, no discrimination. Reviews focus on code, not people.
If something goes off, DM me or open a private issue.

### License

All contributions are licensed under the project's [MIT license](./LICENSE).
