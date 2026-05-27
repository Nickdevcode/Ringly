---
description: Show the Ringly CLI help in your configured language
allowed-tools: Bash(ringly:*), Bash(ringly help), Bash(ringly --help)
disable-model-invocation: false
---

# /ringly-help

Show the user the list of Ringly CLI commands, in the language they configured
(`~/.claude/settings.json` → `pluginConfigs.ringly.options.language`). This
command only displays information — it never installs, modifies settings, or
runs anything on the user's behalf.

## Steps to follow precisely

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
  > After that, run `/ringly-help` again.

- **If the command succeeds**: continue to step 2.

### 2. Print the localized help

Run this command via Bash and capture stdout:

```
ringly help
```

The CLI prints a translated overview (header, warning that commands must run
in an external terminal, the list of subcommands, and a footer). It already
honours the user's `language` config, so there is nothing to translate yourself.

Show the user the full stdout from this command, **unchanged**. Wrap it in a
fenced code block so the formatting (the cyan box header and the indented
command list) renders cleanly in the Claude Code chat.

### 3. Add the language-aware reminder

After the help block, add a single short note. **Pick the language from the
warning line you just printed** — if it starts with `⚠ Rode`, the user is on
pt-BR; if it starts with `⚠ Run`, the user is on en-US.

- pt-BR:

  > Esses comandos rodam no seu terminal (PowerShell, Bash, etc.), não aqui no chat.
  > Se quiser atualizar o Ringly direto daqui, use `/ringly-update`.

- en-US:

  > These commands run in your terminal (PowerShell, Bash, etc.), not in this chat.
  > To update Ringly straight from here, use `/ringly-update`.

## Hard rules

- Do **not** execute any subcommand listed in the help. This command is read-only;
  it must only print information. If the user wants to run a specific command,
  they will paste it into their terminal themselves.
- Do **not** modify `~/.claude/settings.json` or any other user file.
- Do **not** paraphrase or translate the CLI output — `ringly help` already
  produces the correct localized text. Pass it through.
- Keep your reply tight. The help block is the main content; the reminder is
  two sentences.
