import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { logger } from "./core/logger.js";

/**
 * Returns true when the top-level argv requests help WITHOUT naming a
 * subcommand (e.g. `ringly`, `ringly --help`, `ringly -h`). When a subcommand
 * is present (e.g. `ringly update --help`), yargs's per-command help is more
 * useful, so we let it through untouched.
 */
function isTopLevelHelpRequest(argv: readonly string[]): boolean {
  const args = argv.filter((a) => a.length > 0);
  if (args.length === 0) return true;
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  const argv = hideBin(process.argv);

  if (isTopLevelHelpRequest(argv)) {
    const mod = await import("./commands/help.js");
    await mod.runHelp();
    return;
  }

  await yargs(argv)
    .scriptName("ringly")
    .usage("$0 <command> [options]")
    .command(
      "test",
      "Send a sample notification to verify the setup",
      (b) =>
        b
          .option("event", {
            type: "string",
            choices: ["Notification", "Stop", "StopFailure", "SubagentStop"] as const,
            default: "Stop" as const,
            describe: "Event type to simulate",
          })
          .option("lang", {
            type: "string",
            choices: ["pt-BR", "en-US", "auto"] as const,
            default: "auto" as const,
            describe: "Force a specific language",
          })
          .option("title", { type: "string", describe: "Custom title (overrides translation)" })
          .option("body", { type: "string", describe: "Custom body (overrides translation)" })
          .option("silent", { type: "boolean", default: false, describe: "Suppress sound" }),
      async (argv) => {
        const mod = await import("./commands/test.js");
        await mod.runTest({
          event: argv.event,
          lang: argv.lang,
          title: argv.title,
          body: argv.body,
          silent: argv.silent,
        });
      },
    )
    .command(
      "init",
      "Run the interactive installer (register AUMID, choose options, link plugin)",
      (b) =>
        b
          .option("force", {
            type: "boolean",
            default: false,
            describe: "Reset config to defaults",
          })
          .option("non-interactive", {
            type: "boolean",
            default: false,
            describe: "Skip the TUI and apply defaults",
          }),
      async (argv) => {
        const mod = await import("./commands/init.js");
        await mod.runInit({
          force: argv.force,
          nonInteractive: argv["non-interactive"],
        });
      },
    )
    .command(
      "config",
      "Open the interactive configuration UI",
      () => {},
      async () => {
        const mod = await import("./commands/config.js");
        await mod.runConfig();
      },
    )
    .command(
      "doctor",
      "Run a diagnostic of the current environment",
      (b) => b.option("json", { type: "boolean", default: false, describe: "Output JSON only" }),
      async (argv) => {
        const mod = await import("./commands/doctor.js");
        await mod.runDoctor({ json: argv.json });
      },
    )
    .command(
      "update",
      "Check npm for a newer Ringly release and optionally install it",
      (b) =>
        b
          .option("check", {
            type: "boolean",
            default: false,
            describe: "Only check; print a JSON snapshot and exit",
          })
          .option("yes", {
            type: "boolean",
            default: false,
            describe: "Skip the confirmation prompt and install immediately",
          }),
      async (argv) => {
        const mod = await import("./commands/update.js");
        await mod.runUpdate({
          check: argv.check,
          yes: argv.yes,
        });
      },
    )
    .command(
      "uninstall",
      "Remove the AUMID shortcut and local configuration",
      (b) =>
        b.option("keep-config", {
          type: "boolean",
          default: false,
          describe: "Preserve local Ringly configuration",
        }),
      async (argv) => {
        const mod = await import("./commands/uninstall.js");
        await mod.runUninstall({
          keepConfig: argv["keep-config"],
        });
      },
    )
    .command(
      "help",
      "Show the localized list of Ringly commands",
      () => {},
      async () => {
        const mod = await import("./commands/help.js");
        await mod.runHelp();
      },
    )
    .command(
      "hook",
      "Internal: dispatch a Claude Code hook payload from stdin",
      (b) =>
        b.positional("event", {
          type: "string",
          choices: ["Notification", "Stop", "StopFailure", "SubagentStop", "SessionStart"] as const,
        }),
      async (argv) => {
        const evt = argv["_"][1] as
          | "Notification"
          | "Stop"
          | "StopFailure"
          | "SubagentStop"
          | "SessionStart"
          | undefined;
        if (evt === "SessionStart") {
          const mod = await import("./commands/updateCheckHook.js");
          await mod.runUpdateCheckHook();
          return;
        }
        const mod = await import("./commands/hook.js");
        await mod.runHook(evt ? { forcedEvent: evt } : {});
      },
    )
    .demandCommand(1, "You need to specify a command. Try `ringly --help`.")
    .strict()
    .help()
    .alias("h", "help")
    .version()
    .alias("v", "version")
    .fail((msg, err, parser) => {
      if (err) {
        logger.error("CLI failure", { message: err.message });
        console.error(err.message);
      } else if (msg) {
        console.error(msg);
        console.error("");
        console.error(parser.help());
      }
      process.exit(1);
    })
    .parse();
}

main().catch((err) => {
  logger.error("Unhandled CLI error", { message: (err as Error).message });
  console.error((err as Error).message);
  process.exit(1);
});
