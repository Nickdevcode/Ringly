---
description: Check for and install the latest Ringly release from npm
allowed-tools: Bash(ringly:*), Bash(ringly --version), Bash(npm install -g ringly:*)
disable-model-invocation: false
---

# /ringly-update

Guided update workflow for the Ringly plugin. This command checks the npm registry for a newer Ringly release and, if one is available, runs the install for the user.

## Steps to follow precisely

Follow these steps in order. Do not skip any.

### 1. Detect whether the `ringly` CLI is installed

Run this command via Bash (capture stdout and exit code):

```
ringly --version
```

- **If the command fails** (non-zero exit code, "command not found", or empty output): the user has the Claude Code plugin but never installed the npm CLI. Print this exact recovery message and stop — do not continue:

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

Run this command via Bash. It returns a single JSON line with no extra output, which keeps parsing trivial:

```
ringly update --check
```

The output looks like one of:

```json
{"current":"0.3.0","latest":"0.4.0","hasUpdate":true,"reachable":true}
{"current":"0.3.0","latest":"0.3.0","hasUpdate":false,"reachable":true}
{"current":"0.3.0","latest":null,"hasUpdate":false,"reachable":false}
```

Parse the JSON yourself (it is one line). Then branch on the result:

- **`reachable: false`** — npm is unreachable (offline, registry down, firewall, etc.). Print:

  > Couldn't reach the npm registry. Check your internet connection and try `/ringly-update` again later.

  Then stop.

- **`hasUpdate: false`** — already on the latest. Print:

  > You're already on the latest Ringly — `<current>`. Nothing to do.

  Replace `<current>` with the value from the JSON. Then stop.

- **`hasUpdate: true`** — continue to step 3.

### 3. Ask the user to confirm

Use the `AskUserQuestion` tool with a single question:

- **question**: `Update Ringly from <current> to <latest>?` — substituting the values from the JSON.
- **header**: `Update Ringly`
- **multiSelect**: `false`
- **options**:
  - `Update now` — description: `Run npm install -g ringly@latest, then prompt for /reload-plugins.`
  - `Cancel` — description: `Don't change anything. You can run /ringly-update again later.`

If the user picks **Cancel** (or any answer that isn't "Update now"), print:

> Update cancelled. You can run `/ringly-update` whenever you want.

Then stop.

If the user picks **Update now**, continue to step 4.

### 4. Run the install

Run this command via Bash:

```
ringly update --yes
```

That subcommand re-checks the registry, runs `npm install -g ringly@latest` with a 120-second timeout, and prints its own success/failure message in the user's configured language (pt-BR or en-US).

- **Exit code 0** — installation succeeded. Show the user the relevant tail of the stdout (which contains the localized "update complete" message), then add this final instruction:

  > To activate the new version inside this session, run:
  >
  > ```
  > /reload-plugins
  > ```
  >
  > If `/reload-plugins` reports errors about locked files (mostly on Windows), close and reopen Claude Code instead.

- **Non-zero exit code** — installation failed. Show the user the stderr from the command. The CLI already detects the Windows-lock case and prints a localized hint; just pass the output through. Do not retry automatically.

## Hard rules

- Do **not** modify `~/.claude/settings.json` or any other user file directly. All side effects must go through the `ringly` CLI.
- Do **not** rerun `npm install` yourself if `ringly update --yes` fails. The user may have permission issues or a Claude Code instance is holding files open — both require human intervention.
- Do **not** call any external network endpoint other than via the `ringly` CLI.
- Keep your output short. The CLI's own output is already user-facing and localized; do not paraphrase or translate it.
