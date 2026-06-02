import { describe, expect, it } from "vitest";
import {
  ALLOWED_EVENT_NAMES,
  buildDefaultEvents,
  EVENT_BY_NAME,
  EVENT_NAMES,
  EVENTS,
} from "../src/core/events.js";
import enUS from "../src/locales/en-US.json" with { type: "json" };
import ptBR from "../src/locales/pt-BR.json" with { type: "json" };

const ptKeys = Object.keys(ptBR as Record<string, string>);
const enKeys = Object.keys(enUS as Record<string, string>);
const ptSet = new Set(ptKeys);
const enSet = new Set(enKeys);

describe("event registry invariants", () => {
  it("has unique event names and config keys", () => {
    const names = EVENTS.map((e) => e.name);
    const keys = EVENTS.map((e) => e.configKey);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("never includes SessionStart (it is an update-check, not a notification)", () => {
    expect(EVENT_NAMES).not.toContain("SessionStart");
    expect(ALLOWED_EVENT_NAMES.has("SessionStart")).toBe(false);
  });

  it("keeps EVENT_NAMES, ALLOWED_EVENT_NAMES and EVENT_BY_NAME in sync", () => {
    for (const e of EVENTS) {
      expect(ALLOWED_EVENT_NAMES.has(e.name)).toBe(true);
      expect(EVENT_BY_NAME[e.name]).toBe(e);
    }
    expect(EVENT_NAMES.length).toBe(EVENTS.length);
  });

  it("buildDefaultEvents covers every config key with its defaultEnabled", () => {
    const defaults = buildDefaultEvents();
    expect(Object.keys(defaults).sort()).toEqual(EVENTS.map((e) => e.configKey).sort());
    for (const e of EVENTS) {
      expect(defaults[e.configKey]).toBe(e.defaultEnabled);
    }
  });

  it("marks all verbose events as off by default (anti-spam contract)", () => {
    for (const e of EVENTS) {
      if (e.verbose) expect(e.defaultEnabled).toBe(false);
    }
  });

  it("has a title and a body key present in BOTH locales for every event", () => {
    for (const e of EVENTS) {
      expect(ptSet.has(e.titleKey), `pt-BR missing ${e.titleKey}`).toBe(true);
      expect(enSet.has(e.titleKey), `en-US missing ${e.titleKey}`).toBe(true);
      expect(ptSet.has(e.bodyKey), `pt-BR missing ${e.bodyKey}`).toBe(true);
      expect(enSet.has(e.bodyKey), `en-US missing ${e.bodyKey}`).toBe(true);
    }
  });

  it("has TUI label/desc keys in BOTH locales for every event", () => {
    for (const e of EVENTS) {
      for (const suffix of ["label", "desc"]) {
        const key = `tui.events.${e.configKey}.${suffix}`;
        expect(ptSet.has(key), `pt-BR missing ${key}`).toBe(true);
        expect(enSet.has(key), `en-US missing ${key}`).toBe(true);
      }
    }
  });

  it("has the resolver-specific sibling keys in both locales", () => {
    for (const e of EVENTS) {
      const base = e.bodyKey.endsWith(".fallback")
        ? e.bodyKey.slice(0, -".fallback".length)
        : e.bodyKey;
      const siblings =
        e.resolver === "agentNamed"
          ? [`${base}.named`]
          : e.resolver === "compact"
            ? [`${base}.manual`, `${base}.auto`]
            : [];
      for (const key of siblings) {
        expect(ptSet.has(key), `pt-BR missing ${key}`).toBe(true);
        expect(enSet.has(key), `en-US missing ${key}`).toBe(true);
      }
    }
  });
});

describe("locale parity", () => {
  it("pt-BR and en-US have the exact same set of keys", () => {
    const onlyInPt = ptKeys.filter((k) => !enSet.has(k));
    const onlyInEn = enKeys.filter((k) => !ptSet.has(k));
    expect(onlyInPt, `keys only in pt-BR: ${onlyInPt.join(", ")}`).toEqual([]);
    expect(onlyInEn, `keys only in en-US: ${onlyInEn.join(", ")}`).toEqual([]);
  });

  it("has no empty translation values", () => {
    for (const [key, value] of Object.entries(ptBR as Record<string, string>)) {
      expect(value.length, `pt-BR empty: ${key}`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(enUS as Record<string, string>)) {
      expect(value.length, `en-US empty: ${key}`).toBeGreaterThan(0);
    }
  });
});
