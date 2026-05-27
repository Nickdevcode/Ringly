import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { printHelp } from "../src/commands/help.js";
import { createTranslator } from "../src/core/translator.js";

// Matches ANSI color escape sequences (ESC + `[…m`) so assertions can compare
// the plain text emitted by `printHelp` without depending on chalk's exact
// escape bytes. ESC is ``; the literal `[` is escaped for regex.
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ANSI strip
const ANSI_PATTERN = /\[[0-9;]*m/g;
function stripAnsi(s: string): string {
  return s.replace(ANSI_PATTERN, "");
}

describe("printHelp", () => {
  let output: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    output = [];
    logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      output.push(args.map((a) => String(a)).join(" "));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("prints the header, warning, and every subcommand in pt-BR", () => {
    printHelp(createTranslator("pt-BR"));

    const text = stripAnsi(output.join("\n"));

    expect(text).toContain("Comandos do Ringly");
    expect(text).toContain("Rode estes comandos no seu terminal");
    expect(text).toContain("ringly test");
    expect(text).toContain("Dispara uma notificação de exemplo");
    expect(text).toContain("ringly init");
    expect(text).toContain("ringly config");
    expect(text).toContain("ringly doctor");
    expect(text).toContain("ringly update");
    expect(text).toContain("ringly uninstall");
    expect(text).toContain("ringly help");
    expect(text).toContain("ringly <comando> --help");
  });

  it("prints the header, warning, and every subcommand in en-US", () => {
    printHelp(createTranslator("en-US"));

    const text = stripAnsi(output.join("\n"));

    expect(text).toContain("Ringly commands");
    expect(text).toContain("Run these commands in your terminal");
    expect(text).toContain("Send a sample notification");
    expect(text).toContain("ringly <command> --help");
  });

  it("does not leak any pt-BR keys when rendering en-US", () => {
    printHelp(createTranslator("en-US"));
    const text = stripAnsi(output.join("\n"));
    expect(text).not.toContain("Comandos do Ringly");
    expect(text).not.toContain("Dispara uma notificação");
  });

  it("does not leak any en-US keys when rendering pt-BR", () => {
    printHelp(createTranslator("pt-BR"));
    const text = stripAnsi(output.join("\n"));
    expect(text).not.toContain("Ringly commands");
    expect(text).not.toContain("Send a sample notification");
  });

  it("lists exactly the 7 user-facing subcommands (and does not expose `hook`)", () => {
    printHelp(createTranslator("en-US"));
    const text = stripAnsi(output.join("\n"));
    const matches = text.match(/ringly (test|init|config|doctor|update|uninstall|help)\b/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(7);
    expect(text).not.toMatch(/ringly hook\b/);
  });
});
