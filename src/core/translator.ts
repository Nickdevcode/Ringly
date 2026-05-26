import enUS from "../locales/en-US.json" with { type: "json" };
import ptBR from "../locales/pt-BR.json" with { type: "json" };
import type { LanguageSetting, SupportedLanguage } from "./types.js";

type LocaleDict = Record<string, string>;

const LOCALES: Record<SupportedLanguage, LocaleDict> = {
  "pt-BR": ptBR as LocaleDict,
  "en-US": enUS as LocaleDict,
};

const FALLBACK_LANGUAGE: SupportedLanguage = "en-US";

export function resolveLanguage(setting: LanguageSetting): SupportedLanguage {
  if (setting === "pt-BR" || setting === "en-US") return setting;
  return detectSystemLanguage();
}

export function detectSystemLanguage(): SupportedLanguage {
  const explicit = process.env["CLAUDE_PLUGIN_OPTION_LANGUAGE"];
  if (typeof explicit === "string" && explicit.length > 0 && explicit.toLowerCase() !== "auto") {
    if (explicit === "pt-BR" || explicit === "en-US") return explicit;
    const normalized = explicit.toLowerCase();
    if (normalized.startsWith("pt")) return "pt-BR";
    if (normalized.startsWith("en")) return "en-US";
  }

  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (locale.startsWith("pt")) return "pt-BR";
    if (locale.startsWith("en")) return "en-US";
  } catch {
    /* ignore */
  }

  const candidates = [
    process.env["LANG"],
    process.env["LANGUAGE"],
    process.env["LC_ALL"],
    process.env["LC_MESSAGES"],
  ].filter((v): v is string => typeof v === "string" && v.length > 0 && v.toLowerCase() !== "auto");

  for (const value of candidates) {
    if (value === "pt-BR" || value === "en-US") return value;
    const normalized = value.toLowerCase();
    if (normalized.startsWith("pt")) return "pt-BR";
    if (normalized.startsWith("en")) return "en-US";
  }

  return FALLBACK_LANGUAGE;
}

export interface Translator {
  language: SupportedLanguage;
  t(key: string, params?: Record<string, string | number>): string;
  has(key: string): boolean;
}

export function createTranslator(setting: LanguageSetting): Translator {
  const language = resolveLanguage(setting);
  const dict = LOCALES[language] ?? LOCALES[FALLBACK_LANGUAGE];
  const fallbackDict = LOCALES[FALLBACK_LANGUAGE];

  return {
    language,
    t(key, params) {
      const value = dict[key] ?? fallbackDict[key] ?? key;
      if (!params) return value;
      return interpolate(value, params);
    },
    has(key) {
      return key in dict || key in fallbackDict;
    },
  };
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (name in params) return String(params[name]);
    return match;
  });
}
