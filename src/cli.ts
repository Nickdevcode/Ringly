import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { logger } from "./core/logger.js";

async function main(): Promise<void> {
  await yargs(hideBin(process.argv))
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
          })
          .option("migrate-legacy", {
            type: "boolean",
            default: false,
            describe: "Disable pre-Ringly PowerShell hooks before setup",
          }),
      async (argv) => {
        const mod = await import("./commands/init.js");
        await mod.runInit({
          force: argv.force,
          nonInteractive: argv["non-interactive"],
          migrateLegacy: argv["migrate-legacy"],
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
      "uninstall",
      "Remove the AUMID shortcut and local configuration",
      (b) =>
        b
          .option("keep-config", {
            type: "boolean",
            default: false,
            describe: "Preserve %APPDATA%\\ringly\\config.json",
          })
          .option("legacy", {
            type: "boolean",
            default: false,
            describe: "Also remove pre-Ringly PowerShell hooks from ~/.claude/",
          }),
      async (argv) => {
        const mod = await import("./commands/uninstall.js");
        await mod.runUninstall({
          keepConfig: argv["keep-config"],
          legacy: argv.legacy,
        });
      },
    )
    .command(
      "hook",
      "Internal: dispatch a Claude Code hook payload from stdin",
      (b) =>
        b.positional("event", {
          type: "string",
          choices: ["Notification", "Stop", "StopFailure", "SubagentStop"] as const,
        }),
      async (argv) => {
        const mod = await import("./commands/hook.js");
        const evt = argv["_"][1] as
          | "Notification"
          | "Stop"
          | "StopFailure"
          | "SubagentStop"
          | undefined;
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
