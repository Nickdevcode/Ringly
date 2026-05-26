import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTranslator, detectSystemLanguage, resolveLanguage } from "../src/core/translator.js";

describe("translator", () => {
  it("translates fixed keys in pt-BR", () => {
    const t = createTranslator("pt-BR");
    expect(t.language).toBe("pt-BR");
    expect(t.t("title.stop")).toContain("Tarefa concluída");
    expect(t.t("body.stop")).toContain("Aguardando");
  });

  it("translates fixed keys in en-US", () => {
    const t = createTranslator("en-US");
    expect(t.language).toBe("en-US");
    expect(t.t("title.stop")).toContain("Task complete");
    expect(t.t("body.stop")).toContain("Waiting");
  });

  it("interpolates parameters", () => {
    const t = createTranslator("pt-BR");
    const result = t.t("notification.tool_permission", { tool: "Bash" });
    expect(result).toBe("Permissão necessária para usar Bash");
  });

  it("returns the key itself when missing in both locales", () => {
    const t = createTranslator("pt-BR");
    expect(t.t("definitely.missing.key")).toBe("definitely.missing.key");
  });

  it("resolveLanguage returns explicit value when concrete", () => {
    expect(resolveLanguage("pt-BR")).toBe("pt-BR");
    expect(resolveLanguage("en-US")).toBe("en-US");
  });

  describe("detectSystemLanguage", () => {
    const originalLang = process.env["LANG"];
    const originalLanguage = process.env["LANGUAGE"];
    const originalLcAll = process.env["LC_ALL"];
    const originalLcMessages = process.env["LC_MESSAGES"];
    const originalPluginLang = process.env["CLAUDE_PLUGIN_OPTION_LANGUAGE"];
    const OriginalDateTimeFormat = Intl.DateTimeFormat;

    function stubIntl(locale: string): void {
      function FakeFormat(this: unknown) {
        return {
          resolvedOptions: () => ({ locale }),
        };
      }
      // biome-ignore lint/suspicious/noExplicitAny: replacing global Intl ctor for tests
      (Intl as any).DateTimeFormat = FakeFormat as unknown as typeof Intl.DateTimeFormat;
    }

    beforeEach(() => {
      delete process.env["LANG"];
      delete process.env["LANGUAGE"];
      delete process.env["LC_ALL"];
      delete process.env["LC_MESSAGES"];
      delete process.env["CLAUDE_PLUGIN_OPTION_LANGUAGE"];
    });

    afterEach(() => {
      // biome-ignore lint/suspicious/noExplicitAny: restore real Intl ctor
      (Intl as any).DateTimeFormat = OriginalDateTimeFormat;
      if (originalLang !== undefined) process.env["LANG"] = originalLang;
      if (originalLanguage !== undefined) process.env["LANGUAGE"] = originalLanguage;
      if (originalLcAll !== undefined) process.env["LC_ALL"] = originalLcAll;
      if (originalLcMessages !== undefined) process.env["LC_MESSAGES"] = originalLcMessages;
      if (originalPluginLang !== undefined) {
        process.env["CLAUDE_PLUGIN_OPTION_LANGUAGE"] = originalPluginLang;
      }
    });

    it("respects CLAUDE_PLUGIN_OPTION_LANGUAGE first when not auto", () => {
      process.env["CLAUDE_PLUGIN_OPTION_LANGUAGE"] = "en-US";
      stubIntl("pt-BR");
      expect(detectSystemLanguage()).toBe("en-US");
    });

    it("uses Intl.DateTimeFormat when env not explicit", () => {
      stubIntl("pt-BR");
      expect(detectSystemLanguage()).toBe("pt-BR");
    });

    it("falls back to LANG when Intl returns unsupported locale", () => {
      stubIntl("fr-FR");
      process.env["LANG"] = "pt_BR.UTF-8";
      expect(detectSystemLanguage()).toBe("pt-BR");
    });

    it("returns en-US as final fallback", () => {
      stubIntl("zh-CN");
      expect(detectSystemLanguage()).toBe("en-US");
    });

    it("treats 'auto' value in env as not-explicit", () => {
      process.env["CLAUDE_PLUGIN_OPTION_LANGUAGE"] = "auto";
      stubIntl("pt-BR");
      expect(detectSystemLanguage()).toBe("pt-BR");
    });
  });
});
