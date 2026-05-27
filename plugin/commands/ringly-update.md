---
description: Check for and install the latest Ringly release from npm
allowed-tools: Bash(ringly:*), Bash(ringly --version), Bash(npm install -g ringly:*)
disable-model-invocation: false
---

# /ringly-update

Guided update workflow for the Ringly plugin. Checks the npm registry for a
newer Ringly release and, when one is available, shows the user a friendly
summary of what changed and runs the install for them.

## Language rule (applies to every step below)

After step 2 you will have a JSON snapshot with a `language` field. **Use that
field to decide the language for every line you write yourself in this
command** — step headings, the recovery message in step 1 (which is the only
text you must write before the snapshot exists; keep it in English), the
release-notes summary in step 2.5, the `AskUserQuestion` text in step 3, and
any "cancelled" / "complete" / "failed" line in step 4.

- `language === "pt-BR"` → write everything in Brazilian Portuguese.
- `language === "en-US"` → write everything in English.

The lines that come from the CLI binary itself (`ringly update --yes` stdout,
the post-install instructions printed by the CLI) are **already localized**;
pass them through unchanged. Do not paraphrase or translate them.

## Steps to follow precisely

Follow these steps in order. Do not skip any.

### 1. Detect whether the `ringly` CLI is installed

Run this command via Bash (capture stdout and exit code):

```
ringly --version
```

- **If the command fails** (non-zero exit code, "command not found", or empty
  output): the user has the Claude Code plugin but never installed the npm CLI.
  Print this exact recovery message and stop — do not continue:

  > The Ringly CLI is not installed. Run this in your terminal (outside Claude Code), then come back:
  >
  > ```
  > npm install -g ringly
  > ringly init
  > ```
  >
  > After that, run `/ringly-update` again.

- **If the command succeeds**: continue to step 2.

### 2. Query the npm registry

Run this command via Bash. It returns a single JSON line with no extra output:

```
ringly update --check
```

The output looks like:

```json
{"current":"0.5.2","latest":"0.6.0","hasUpdate":true,"reachable":true,"language":"pt-BR","notes":{"version":"0.6.0","heading":"O que mudou na versão 0.6.0","groups":[{"title":"Novidades","items":["..."]},{"title":"Correções","items":["..."]}]}}
```

Parse the JSON yourself. Capture `language` immediately — that is the language
you will write in from this point on. Then branch on the snapshot:

- **`reachable: false`** — npm is unreachable (offline, registry down, firewall).
  In the user's language, print one short line:
  - pt-BR: `Não consegui falar com o npm. Cheque sua internet e tente /ringly-update de novo.`
  - en-US: `Couldn't reach the npm registry. Check your connection and try /ringly-update again.`

  Then stop.

- **`hasUpdate: false`** — already on the latest. Print, in the user's language:
  - pt-BR: `Você já está na versão mais recente do Ringly — <current>. Nada a fazer.`
  - en-US: `You're already on the latest Ringly — <current>. Nothing to do.`

  Substituting `<current>` from the JSON. Then stop.

- **`hasUpdate: true`** — continue to step 2.5.

### 2.5. Show a friendly summary of what changed

Before asking the user to confirm, present a short, easy-to-read summary of
what changed in the new version. Use `snapshot.notes`:

- **If `notes` is `null`** (the local CHANGELOG didn't carry an entry for the
  new version), write one short line and skip ahead to step 3:
  - pt-BR: `Notas dessa versão não estão disponíveis, mas a atualização segue válida.`
  - en-US: `Release notes for this version aren't available, but the update is still valid.`

- **Otherwise**, build the summary like this:
  - Print `notes.heading` as a small markdown header (`### `).
  - For each `group` in `notes.groups`, print `group.title` as a bold line,
    then up to **4 bullets** taken from `group.items` — **rewrite each bullet
    in plain, friendly language for someone who is not a developer**. That
    means:
    - Drop file paths (`src/core/...`), module names, function names, CVE
      numbers, git/build jargon.
    - Replace "spawn EINVAL on Node 20.12+" with something like "the update
      command was failing on Windows; now it works again".
    - Keep each bullet to one short sentence.
  - Skip empty groups.
  - **Total length must stay under ~10 lines.** If the version has more
    content than that, pick the highlights (Adicionado/What's new and
    Mudança incompatível/Breaking first, then Mudado/Changes, then
    Corrigido/Fixes).

Then add one blank line and move to step 3.

### 3. Ask the user to confirm

Use the `AskUserQuestion` tool with a single question, **all text in the
language from `snapshot.language`**:

For pt-BR:

- **question**: `Atualizar o Ringly da versão <current> para a <latest>?`
- **header**: `Atualizar Ringly`
- **multiSelect**: `false`
- **options**:
  - `Atualizar agora` — description: `Roda npm install -g ringly@latest e te lembra do /reload-plugins.`
  - `Cancelar` — description: `Não muda nada. Você pode rodar /ringly-update de novo quando quiser.`

For en-US:

- **question**: `Update Ringly from <current> to <latest>?`
- **header**: `Update Ringly`
- **multiSelect**: `false`
- **options**:
  - `Update now` — description: `Run npm install -g ringly@latest, then prompt for /reload-plugins.`
  - `Cancel` — description: `Don't change anything. You can run /ringly-update again later.`

Substitute `<current>` and `<latest>` from the JSON.

If the user picks the cancel option (or any answer that isn't the update one),
print, in the user's language:

- pt-BR: `Atualização cancelada. Você pode rodar /ringly-update quando quiser.`
- en-US: `Update cancelled. You can run /ringly-update whenever you want.`

Then stop.

If the user picks the update option, continue to step 4.

### 4. Run the install

Run this command via Bash:

```
ringly update --yes
```

That subcommand re-checks the registry, runs `npm install -g ringly@latest`
with a 120-second timeout, and prints its own success/failure message in the
user's configured language.

- **Exit code 0** — installation succeeded. Show the user the relevant tail of
  the stdout (which already contains the localized "update complete" message),
  then add this final instruction in the user's language:

  For pt-BR:
  > Pra ativar a nova versão nessa sessão, rode:
  >
  > ```
  > /reload-plugins
  > ```
  >
  > Se o `/reload-plugins` reclamar de arquivos travados (no Windows costuma rolar), feche e reabra o Claude Code.

  For en-US:
  > To activate the new version inside this session, run:
  >
  > ```
  > /reload-plugins
  > ```
  >
  > If `/reload-plugins` reports errors about locked files (mostly on Windows), close and reopen Claude Code instead.

- **Non-zero exit code** — installation failed. Show the user the stderr from
  the command. The CLI already detects the Windows-lock case and prints a
  localized hint; just pass the output through. Do not retry automatically.

## Hard rules

- Do **not** modify `~/.claude/settings.json` or any other user file directly.
  All side effects must go through the `ringly` CLI.
- Do **not** rerun `npm install` yourself if `ringly update --yes` fails. The
  user may have permission issues or a Claude Code instance is holding files
  open — both require human intervention.
- Do **not** call any external network endpoint other than via the `ringly`
  CLI.
- Keep your output short. The CLI's own output is already user-facing and
  localized; do not paraphrase or translate it.
- The `snapshot.language` field is the source of truth for which language to
  write in. Do not fall back to English just because this `.md` file is in
  English.
