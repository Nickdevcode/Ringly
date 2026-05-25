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
- **Windows 11** se quiser testar o toast nativo (macOS/Linux ainda estão como stubs)
- **PowerShell 5.1+** (já vem com o Windows)
- **Git**

### Setup local

```bash
git clone https://github.com/nickdevcode/Ringly.git
cd Ringly
npm install
npm run build
node dist/cli.js doctor
```

Se o `doctor` reportar tudo verde, você está pronto. Se o AUMID falhar, rode
`node dist/cli.js init --non-interactive` para registrar.

### Comandos de desenvolvimento

| Comando             | O que faz                                            |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Build em modo watch (recompila ao salvar)            |
| `npm run typecheck` | `tsc --noEmit` — checa tipos                         |
| `npm run lint`      | Biome (lint + format check)                          |
| `npm run lint:fix`  | Biome com auto-correção                              |
| `npm test`          | Vitest (29 testes, ~330 ms)                          |
| `npm run test:watch`| Vitest em watch                                      |
| `npm run build`     | Build de produção (ESM + CJS + DTS)                  |

### Padrões do código

- **TypeScript estrito** (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Sem comentários** desnecessários — o código deve se explicar pelos nomes
- **Sem `any`** sem motivo (Biome avisa)
- **Falha silenciosa** no caminho do hook — qualquer exceção vira `logger.error()`,
  o processo sempre retorna `exit 0` pra não quebrar o Claude Code do usuário
- **Falha verbosa** no caminho da CLI — erros vão pra `stderr` e exit code != 0
- **i18n via locales/** — toda string visível ao usuário entra em `pt-BR.json` e
  `en-US.json`; não hardcode texto em código

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
6. O CI roda automático em Windows / macOS / Linux × Node 20/22. Se quebrar, ajusta.
7. Eu reviso e mergeio. Para mudanças grandes, vou pedir issue prévia.

### Estrutura do projeto

```
Ringly/
├── .claude-plugin/marketplace.json   # entry do marketplace pro Claude Code
├── plugin/                            # camada do plugin (hooks + dispatch.mjs)
├── src/
│   ├── cli.ts + hook.ts              # dois entries (CLI vs hook)
│   ├── core/                         # config, i18n, eventMapper, logger, types
│   ├── channels/                     # canais de notificação (toast hoje, webhook depois)
│   ├── platform/{windows,macos,linux}/  # backends por SO
│   ├── commands/                     # init, config, doctor, test, hook, uninstall
│   ├── locales/                      # pt-BR.json, en-US.json
│   └── tui/                          # telas Ink
└── test/                             # 29 testes Vitest
```

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
- **Windows 11** to test the native toast (macOS/Linux are still stubs)
- **PowerShell 5.1+** (ships with Windows)
- **Git**

### Local setup

```bash
git clone https://github.com/nickdevcode/Ringly.git
cd Ringly
npm install
npm run build
node dist/cli.js doctor
```

If `doctor` reports everything green, you're ready. If AUMID fails, run
`node dist/cli.js init --non-interactive` to register it.

### Development commands

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Watch-mode build (recompiles on save)                 |
| `npm run typecheck` | `tsc --noEmit` — type-checks the project              |
| `npm run lint`      | Biome (lint + format check)                           |
| `npm run lint:fix`  | Biome with auto-fix                                   |
| `npm test`          | Vitest (29 tests, ~330 ms)                            |
| `npm run test:watch`| Vitest in watch mode                                  |
| `npm run build`     | Production build (ESM + CJS + DTS)                    |

### Code standards

- **Strict TypeScript** (`strict: true`, `noUncheckedIndexedAccess: true`)
- **No unnecessary comments** — code should be self-explanatory by names
- **No `any`** without justification (Biome warns)
- **Silent failure** on the hook path — every exception becomes `logger.error()`,
  the process always exits `0` so it never breaks the user's Claude Code
- **Verbose failure** on the CLI path — errors go to `stderr` with a non-zero exit
- **i18n via locales/** — every user-facing string lives in `pt-BR.json` and
  `en-US.json`; never hardcode text in source

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
6. CI runs automatically on Windows / macOS / Linux × Node 20/22. Fix any failures.
7. I review and merge. For big changes, I'll ask for a prior issue.

### Project layout

```
Ringly/
├── .claude-plugin/marketplace.json   # marketplace entry for Claude Code
├── plugin/                            # plugin layer (hooks + dispatch.mjs)
├── src/
│   ├── cli.ts + hook.ts              # two entries (CLI vs hook)
│   ├── core/                         # config, i18n, eventMapper, logger, types
│   ├── channels/                     # notification channels (toast now, webhook later)
│   ├── platform/{windows,macos,linux}/  # OS back-ends
│   ├── commands/                     # init, config, doctor, test, hook, uninstall
│   ├── locales/                      # pt-BR.json, en-US.json
│   └── tui/                          # Ink screens
└── test/                             # 29 Vitest tests
```

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
