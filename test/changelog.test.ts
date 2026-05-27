import { describe, expect, it } from "vitest";
import {
  extractSection,
  findEntry,
  parseChangelog,
  readPackagedChangelog,
} from "../src/core/changelog.js";

const SAMPLE = `# Changelog

> Header description that the parser should ignore.

---

## [0.6.0] — 2026-06-01

### 🇧🇷 Português

**Adicionado**

- **Novidade um** com texto bold inline e \`código\`.
- Item dois sem ênfase.

**Corrigido**

- Conserto de algo importante.

### 🇺🇸 English

**Added**

- **First new thing** with bold and \`code\`.
- Second item.

**Fixed**

- Fixed something important.

---

## [0.5.0] — 2026-05-26

### 🇧🇷 Português

**Mudança incompatível**

- Removido o \`userConfig\` do plugin.

### 🇺🇸 English

**Breaking change**

- Removed \`userConfig\` from the plugin.

---
`;

describe("parseChangelog", () => {
  it("returns an empty array for empty input", () => {
    expect(parseChangelog("")).toEqual([]);
  });

  it("returns an empty array for non-string input", () => {
    // @ts-expect-error: intentional misuse
    expect(parseChangelog(null)).toEqual([]);
  });

  it("returns an empty array when no entries match the pattern", () => {
    expect(parseChangelog("# Just a header\n\nNo entries here.")).toEqual([]);
  });

  it("parses multiple entries in order", () => {
    const entries = parseChangelog(SAMPLE);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.version).toBe("0.6.0");
    expect(entries[0]?.date).toBe("2026-06-01");
    expect(entries[1]?.version).toBe("0.5.0");
    expect(entries[1]?.date).toBe("2026-05-26");
  });

  it("separates pt-BR and en-US sections", () => {
    const entries = parseChangelog(SAMPLE);
    const entry = entries[0];
    expect(entry?.sections.map((s) => s.language)).toEqual(["pt-BR", "en-US"]);
  });

  it("strips bold and code markers from bullet text", () => {
    const entries = parseChangelog(SAMPLE);
    const ptGroups = entries[0]?.sections.find((s) => s.language === "pt-BR")?.groups ?? [];
    const addedBullets = ptGroups.find((g) => g.heading === "Adicionado")?.bullets ?? [];
    expect(addedBullets[0]).toBe("Novidade um com texto bold inline e código.");
    expect(addedBullets[1]).toBe("Item dois sem ênfase.");
  });

  it("captures multiple groups per section", () => {
    const entries = parseChangelog(SAMPLE);
    const ptGroups = entries[0]?.sections.find((s) => s.language === "pt-BR")?.groups ?? [];
    expect(ptGroups.map((g) => g.heading)).toEqual(["Adicionado", "Corrigido"]);
  });

  it("handles a single-section entry", () => {
    const single = `## [1.0.0] — 2026-01-01

### 🇺🇸 English

**Fixed**

- Initial release.
`;
    const entries = parseChangelog(single);
    expect(entries[0]?.sections).toHaveLength(1);
    expect(entries[0]?.sections[0]?.language).toBe("en-US");
  });

  it("skips groups with no bullets", () => {
    const empty = `## [1.0.0] — 2026-01-01

### 🇺🇸 English

**Added**

(nothing yet)

**Fixed**

- Real bullet.
`;
    const entries = parseChangelog(empty);
    const groups = entries[0]?.sections[0]?.groups ?? [];
    expect(groups.map((g) => g.heading)).toEqual(["Fixed"]);
  });

  it("tolerates entries without dates", () => {
    const noDate = `## [2.0.0]

### 🇺🇸 English

**Added**

- Date-less entry.
`;
    const entries = parseChangelog(noDate);
    expect(entries[0]?.version).toBe("2.0.0");
    expect(entries[0]?.date).toBeNull();
  });

  it("accepts a prerelease version in the header", () => {
    const pre = `## [1.0.0-beta] — 2026-01-01

### 🇺🇸 English

**Added**

- Beta!
`;
    const entries = parseChangelog(pre);
    expect(entries[0]?.version).toBe("1.0.0-beta");
  });
});

describe("findEntry", () => {
  it("finds an existing entry by exact version", () => {
    const entries = parseChangelog(SAMPLE);
    expect(findEntry(entries, "0.5.0")?.version).toBe("0.5.0");
  });

  it("returns null when the version is not listed", () => {
    const entries = parseChangelog(SAMPLE);
    expect(findEntry(entries, "9.9.9")).toBeNull();
  });

  it("returns null for invalid inputs", () => {
    expect(findEntry([], "1.0.0")).toBeNull();
    // @ts-expect-error: intentional misuse
    expect(findEntry(null, "1.0.0")).toBeNull();
  });
});

describe("extractSection", () => {
  it("returns the groups for the requested language", () => {
    const entries = parseChangelog(SAMPLE);
    const entry = findEntry(entries, "0.6.0");
    if (!entry) throw new Error("expected entry 0.6.0 to parse");
    const ptGroups = extractSection(entry, "pt-BR");
    expect(ptGroups.map((g) => g.heading)).toEqual(["Adicionado", "Corrigido"]);
  });

  it("falls back to the other language when the requested one is missing", () => {
    const only = `## [1.0.0] — 2026-01-01

### 🇧🇷 Português

**Adicionado**

- Só em pt-BR.
`;
    const entry = parseChangelog(only)[0];
    if (!entry) throw new Error("expected single entry to parse");
    const enGroups = extractSection(entry, "en-US");
    expect(enGroups[0]?.heading).toBe("Adicionado");
  });

  it("returns an empty array when the entry has no sections", () => {
    expect(extractSection({ version: "0.0.0", date: null, sections: [] }, "pt-BR")).toEqual([]);
  });
});

describe("readPackagedChangelog", () => {
  it("locates the real CHANGELOG.md packaged with the project", () => {
    const raw = readPackagedChangelog(import.meta.url);
    expect(raw).not.toBeNull();
    expect(raw).toMatch(/^# Changelog/);
  });

  it("returns null when called from an unrelated module URL", () => {
    // A file:// URL outside the project tree won't find a `name: "ringly"`
    // package.json within MAX_DEPTH levels.
    const fake = "file:///nonexistent-path-xyz/some/module.js";
    expect(readPackagedChangelog(fake)).toBeNull();
  });
});
