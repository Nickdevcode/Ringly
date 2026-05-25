import { describe, expect, it } from "vitest";
import { createTranslator, resolveLanguage } from "../src/core/translator.js";

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

  it("resolveLanguage falls back to detection when auto", () => {
    const original = process.env["LANG"];
    process.env["LANG"] = "pt_BR.UTF-8";
    try {
      expect(resolveLanguage("auto")).toBe("pt-BR");
    } finally {
      if (original === undefined) delete process.env["LANG"];
      else process.env["LANG"] = original;
    }
  });
});
