import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNotesFor, buildNpmInstallSpec, resolveNotesFor } from "../src/commands/update.js";
import { createTranslator } from "../src/core/translator.js";

/**
 * Regression coverage for the Windows `spawn EINVAL` bug.
 *
 * Background: Node 20.12+/21.7+/22+ refuses to spawn `.bat`/`.cmd` shims
 * directly (CVE-2024-27980). Calling `spawn("npm.cmd", [...], { shell: false })`
 * throws `EINVAL` before npm can run. The fix is to enable `shell: true` on
 * Windows so `cmd.exe` resolves the shim — safe here because the arguments
 * are hardcoded literals (no user input).
 */
describe("buildNpmInstallSpec", () => {
  it("targets npm with `install -g ringly@latest` on every platform", () => {
    for (const platform of ["win32", "darwin", "linux"] as const) {
      const spec = buildNpmInstallSpec(platform);
      expect(spec.command).toBe("npm");
      expect(spec.args).toEqual(["install", "-g", "ringly@latest"]);
    }
  });

  it("uses shell: true on Windows to avoid EINVAL when invoking npm.cmd", () => {
    const spec = buildNpmInstallSpec("win32");
    expect(spec.options.shell).toBe(true);
  });

  it("uses shell: false on macOS/Linux where npm is a real PATH executable", () => {
    expect(buildNpmInstallSpec("darwin").options.shell).toBe(false);
    expect(buildNpmInstallSpec("linux").options.shell).toBe(false);
  });

  it("pipes stdout/stderr and hides the spawned window on every platform", () => {
    for (const platform of ["win32", "darwin", "linux"] as const) {
      const spec = buildNpmInstallSpec(platform);
      expect(spec.options.stdio).toEqual(["ignore", "pipe", "pipe"]);
      expect(spec.options.windowsHide).toBe(true);
    }
  });
});

/**
 * `buildNotesFor` reads the actual packaged CHANGELOG.md (via
 * `readPackagedChangelog`) and produces the `notes` field embedded in the
 * `ringly update --check` JSON snapshot. The cases below pin down the
 * three outcomes that matter for the slash command: known version →
 * localized notes, unknown version → null, language picks the right
 * section.
 */
describe("buildNotesFor", () => {
  it("returns localized notes for the current packaged version (pt-BR)", () => {
    const translator = createTranslator("pt-BR");
    // The CHANGELOG must include the current package version — this is
    // the same version readOwnVersion would report inside the CLI.
    const notes = buildNotesFor("0.5.2", translator);
    expect(notes).not.toBeNull();
    expect(notes?.version).toBe("0.5.2");
    expect(notes?.heading).toContain("O que mudou na versão 0.5.2");
    expect(notes?.groups.length).toBeGreaterThan(0);
    // The first group of the 0.5.2 entry is "Mudado" in pt-BR.
    expect(notes?.groups[0]?.title).toBe("Mudou");
  });

  it("returns en-US group titles when the translator language is en-US", () => {
    const translator = createTranslator("en-US");
    const notes = buildNotesFor("0.5.2", translator);
    expect(notes).not.toBeNull();
    expect(notes?.heading).toContain("What's new in version 0.5.2");
    expect(notes?.groups[0]?.title).toBe("Changes");
  });

  it("returns null for a version that the CHANGELOG does not list", () => {
    const translator = createTranslator("pt-BR");
    expect(buildNotesFor("9.9.9", translator)).toBeNull();
  });

  it("maps a 'Corrigido' heading to the localized 'Correções' title", () => {
    const translator = createTranslator("pt-BR");
    // v0.5.1 has a 'Corrigido' group (Windows spawn EINVAL fix).
    const notes = buildNotesFor("0.5.1", translator);
    expect(notes).not.toBeNull();
    const titles = notes?.groups.map((g) => g.title) ?? [];
    expect(titles).toContain("Correções");
  });

  it("maps a 'Mudança incompatível' heading to the breaking-change title", () => {
    const translator = createTranslator("pt-BR");
    // v0.5.0 is a breaking change (removed userConfig).
    const notes = buildNotesFor("0.5.0", translator);
    expect(notes).not.toBeNull();
    const titles = notes?.groups.map((g) => g.title) ?? [];
    expect(titles.some((t) => t.includes("Pode quebrar coisas"))).toBe(true);
  });

  it("produces plain-text bullets with bold and code markers stripped", () => {
    const translator = createTranslator("pt-BR");
    const notes = buildNotesFor("0.5.2", translator);
    const allItems = notes?.groups.flatMap((g) => g.items) ?? [];
    for (const item of allItems) {
      expect(item).not.toMatch(/\*\*/);
      expect(item).not.toMatch(/^`|`$/);
    }
  });
});

/**
 * `resolveNotesFor` is the async wrapper the real update flow uses. It prefers
 * the packaged CHANGELOG (offline, instant) and only falls back to GitHub when
 * the local file lacks the version — the exact case of a version jump, which is
 * the bug this fixes. `fetch` is mocked like in `updateCheck.test.ts`.
 */
describe("resolveNotesFor", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uses the packaged CHANGELOG and does NOT hit the network for a known version", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const translator = createTranslator("pt-BR");

    const notes = await resolveNotesFor("0.5.2", translator);
    expect(notes).not.toBeNull();
    expect(notes?.version).toBe("0.5.2");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to the remote CHANGELOG when the version is not packaged locally", async () => {
    // 9.9.9 is not in the packaged CHANGELOG → local miss → remote fetch.
    const remoteMarkdown = [
      "# Changelog",
      "",
      "## [9.9.9] — 2099-01-01",
      "",
      "### 🇧🇷 Português",
      "",
      "**Adicionado**",
      "",
      "- Recurso futurista de teste",
      "",
    ].join("\n");
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(remoteMarkdown, { status: 200 }));
    const translator = createTranslator("pt-BR");

    const notes = await resolveNotesFor("9.9.9", translator);
    expect(notes).not.toBeNull();
    expect(notes?.version).toBe("9.9.9");
    expect(notes?.heading).toContain("9.9.9");
    expect(notes?.groups[0]?.items.some((i) => i.includes("futurista"))).toBe(true);
  });

  it("returns null when the version is missing locally and remote is unreachable", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));
    const translator = createTranslator("pt-BR");

    expect(await resolveNotesFor("9.9.9", translator)).toBeNull();
  });
});
