import { describe, expect, it } from "vitest";
import { escapeXmlText } from "../src/core/xml.js";

describe("escapeXmlText", () => {
  it("escapes ampersand and angle brackets", () => {
    expect(escapeXmlText("Tom & Jerry < 100 > 0")).toBe("Tom &amp; Jerry &lt; 100 &gt; 0");
  });

  it("escapes quotes", () => {
    expect(escapeXmlText("She said \"hi\" and 'bye'")).toBe(
      "She said &quot;hi&quot; and &apos;bye&apos;",
    );
  });

  it("escapes non-ASCII as numeric entities", () => {
    expect(escapeXmlText("ação")).toBe("a&#231;&#227;o");
    expect(escapeXmlText("Tarefa concluída")).toBe("Tarefa conclu&#237;da");
  });

  it("escapes the em dash", () => {
    expect(escapeXmlText("Claude — Erro")).toBe("Claude &#8212; Erro");
  });

  it("returns empty string for empty input", () => {
    expect(escapeXmlText("")).toBe("");
  });
});
