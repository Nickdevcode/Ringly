/**
 * Parser for the project's bilingual CHANGELOG.md (Keep a Changelog flavour
 * with `### 🇧🇷 Português` / `### 🇺🇸 English` sub-sections). Used by the
 * `/ringly-update` slash command so the user sees a friendly summary of
 * what changed before being asked to install the new version.
 *
 * Design notes:
 *  - No new runtime dependency — only `node:fs` + `node:path` + regex.
 *  - Walks up the filesystem to locate the packaged `CHANGELOG.md`, the
 *    same way `readOwnVersion` finds `package.json`. CHANGELOG ships in the
 *    npm tarball via `package.json#files`, so this works in source, in
 *    `dist/`, and in a globally-installed npm prefix.
 *  - Defensive: every public function returns a benign empty/null value
 *    when the markdown shape diverges from what it expects, instead of
 *    throwing. The slash command falls back to "release notes unavailable"
 *    gracefully.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_DEPTH = 6;

export type ChangelogLanguage = "pt-BR" | "en-US";

export interface ChangelogGroup {
  /** Raw heading text as it appears in the markdown ("Adicionado", "Fixed", …). */
  heading: string;
  /** Bullet text, with surrounding `- ` stripped and `**bold**` markers removed. */
  bullets: string[];
}

export interface ChangelogSection {
  language: ChangelogLanguage;
  groups: ChangelogGroup[];
}

export interface ChangelogEntry {
  version: string;
  date: string | null;
  sections: ChangelogSection[];
}

/**
 * Reads the packaged CHANGELOG.md by walking up from the calling module
 * until a `package.json` whose `name === "ringly"` is found, then reading
 * the sibling `CHANGELOG.md`. Returns `null` when not found or unreadable.
 */
export function readPackagedChangelog(moduleUrl: string): string | null {
  try {
    let dir = dirname(fileURLToPath(moduleUrl));
    for (let i = 0; i < MAX_DEPTH; i++) {
      const pkgPath = join(dir, "package.json");
      try {
        const raw = readFileSync(pkgPath, "utf8");
        const parsed = JSON.parse(raw) as { name?: unknown };
        if (parsed.name === "ringly") {
          const changelogPath = join(dir, "CHANGELOG.md");
          if (existsSync(changelogPath)) {
            return readFileSync(changelogPath, "utf8");
          }
          return null;
        }
      } catch {
        /* keep walking */
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const ENTRY_PATTERN = /^##\s+\[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\](?:\s*[—\-–]\s*(\S.*?))?\s*$/;
const SECTION_PT_PATTERN = /^###\s+🇧🇷\s+Portugu[êe]s\s*$/;
const SECTION_EN_PATTERN = /^###\s+🇺🇸\s+English\s*$/;
const GROUP_HEADING_PATTERN = /^\*\*([^*]+)\*\*\s*$/;
const SEPARATOR_PATTERN = /^---\s*$/;

/**
 * Parses a CHANGELOG.md string into an ordered list of entries (newest first
 * if the file is sorted that way, which our project's CHANGELOG is).
 */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  if (typeof markdown !== "string" || markdown.length === 0) return [];

  const lines = markdown.split(/\r?\n/);
  const entries: ChangelogEntry[] = [];

  let currentEntry: ChangelogEntry | null = null;
  let currentSection: ChangelogSection | null = null;
  let currentGroup: ChangelogGroup | null = null;

  const closeGroup = () => {
    if (currentGroup && currentSection && currentGroup.bullets.length > 0) {
      currentSection.groups.push(currentGroup);
    }
    currentGroup = null;
  };
  const closeSection = () => {
    closeGroup();
    if (currentSection && currentEntry && currentSection.groups.length > 0) {
      currentEntry.sections.push(currentSection);
    }
    currentSection = null;
  };
  const closeEntry = () => {
    closeSection();
    if (currentEntry) {
      entries.push(currentEntry);
      currentEntry = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const entryMatch = ENTRY_PATTERN.exec(line);
    if (entryMatch) {
      closeEntry();
      const [, version, dateRaw] = entryMatch;
      const date = typeof dateRaw === "string" ? dateRaw.trim() : null;
      currentEntry = { version: version as string, date: date || null, sections: [] };
      continue;
    }

    if (!currentEntry) continue;

    if (SEPARATOR_PATTERN.test(line)) {
      closeSection();
      continue;
    }

    if (SECTION_PT_PATTERN.test(line)) {
      closeSection();
      currentSection = { language: "pt-BR", groups: [] };
      continue;
    }
    if (SECTION_EN_PATTERN.test(line)) {
      closeSection();
      currentSection = { language: "en-US", groups: [] };
      continue;
    }

    if (!currentSection) continue;

    const groupMatch = GROUP_HEADING_PATTERN.exec(line);
    if (groupMatch) {
      closeGroup();
      const heading = (groupMatch[1] as string).trim();
      currentGroup = { heading, bullets: [] };
      continue;
    }

    if (currentGroup) {
      const bulletMatch = /^-\s+(.*)$/.exec(line);
      if (bulletMatch) {
        const text = stripInlineMarkdown((bulletMatch[1] as string).trim());
        if (text.length > 0) currentGroup.bullets.push(text);
      }
      // Anything else (blank lines, prose) inside an open group is skipped;
      // the group only closes when the next `**Heading**`, language section,
      // separator, or entry begins. This tolerates blank lines that the
      // project's CHANGELOG puts between the heading and its first bullet.
    }
  }

  closeEntry();
  return entries;
}

/**
 * Finds an entry by exact version match. Returns `null` when missing.
 */
export function findEntry(entries: ChangelogEntry[], version: string): ChangelogEntry | null {
  if (!Array.isArray(entries) || typeof version !== "string") return null;
  return entries.find((e) => e.version === version) ?? null;
}

/**
 * Extracts the groups for a given language from an entry. Falls back to the
 * other supported language when the requested one is missing (so an English
 * reader still gets something if the author wrote only the pt-BR section).
 */
export function extractSection(
  entry: ChangelogEntry,
  language: ChangelogLanguage,
): ChangelogGroup[] {
  if (!entry || !Array.isArray(entry.sections)) return [];
  const primary = entry.sections.find((s) => s.language === language);
  if (primary && primary.groups.length > 0) return primary.groups;
  const fallback = entry.sections.find((s) => s.language !== language);
  return fallback?.groups ?? [];
}

function stripInlineMarkdown(text: string): string {
  // Remove `**bold**` and `*italic*` markers but keep the inner text. Drop
  // backtick code spans' delimiters too — the slash command will reword
  // bullets anyway, so we want plain text the model can rewrite.
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}
