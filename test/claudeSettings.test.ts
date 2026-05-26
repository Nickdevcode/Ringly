import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../src/core/config.js";

const FAKE_HOME = join(tmpdir(), `ringly-test-home-${Date.now()}`);

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    homedir: () => FAKE_HOME,
  };
});

import {
  getClaudeSettingsFile,
  pluginOptionsToRinglyConfig,
  readRinglyPluginOptions,
  ringlyConfigToPluginOptions,
  writeRinglyPluginOptions,
} from "../src/core/claudeSettings.js";

describe("claudeSettings", () => {
  beforeEach(() => {
    if (existsSync(FAKE_HOME)) rmSync(FAKE_HOME, { recursive: true, force: true });
    mkdirSync(FAKE_HOME, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(FAKE_HOME)) rmSync(FAKE_HOME, { recursive: true, force: true });
  });

  it("returns empty options when settings.json does not exist", () => {
    expect(readRinglyPluginOptions()).toEqual({});
  });

  it("reads existing plugin options", () => {
    const file = getClaudeSettingsFile();
    mkdirSync(join(FAKE_HOME, ".claude"), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({
        pluginConfigs: {
          ringly: { options: { language: "pt-BR", sound: false } },
        },
      }),
    );

    expect(readRinglyPluginOptions()).toEqual({ language: "pt-BR", sound: false });
  });

  it("creates settings.json and writes ringly options", () => {
    const result = writeRinglyPluginOptions({ language: "en-US", debug: true });

    expect(result.wasCreated).toBe(true);
    expect(result.backupFile).toBeNull();

    const written = JSON.parse(readFileSync(getClaudeSettingsFile(), "utf8"));
    expect(written.pluginConfigs.ringly.options).toEqual({ language: "en-US", debug: true });
  });

  it("preserves unrelated settings when writing ringly options", () => {
    const file = getClaudeSettingsFile();
    mkdirSync(join(FAKE_HOME, ".claude"), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({
        theme: "dark",
        hooks: { Stop: [] },
        pluginConfigs: {
          "other-plugin": { options: { foo: "bar" } },
        },
      }),
    );

    writeRinglyPluginOptions({ language: "pt-BR" });

    const written = JSON.parse(readFileSync(file, "utf8"));
    expect(written.theme).toBe("dark");
    expect(written.hooks).toEqual({ Stop: [] });
    expect(written.pluginConfigs["other-plugin"].options).toEqual({ foo: "bar" });
    expect(written.pluginConfigs.ringly.options).toEqual({ language: "pt-BR" });
  });

  it("creates a backup when overwriting an existing settings.json", () => {
    const file = getClaudeSettingsFile();
    mkdirSync(join(FAKE_HOME, ".claude"), { recursive: true });
    writeFileSync(file, JSON.stringify({ existing: true }));

    const result = writeRinglyPluginOptions({ debug: true });

    expect(result.wasCreated).toBe(false);
    expect(result.backupFile).not.toBeNull();
    if (result.backupFile) {
      expect(existsSync(result.backupFile)).toBe(true);
      const backup = JSON.parse(readFileSync(result.backupFile, "utf8"));
      expect(backup.existing).toBe(true);
    }
  });

  it("converts RinglyConfig to plugin options with flat keys", () => {
    const opts = ringlyConfigToPluginOptions(DEFAULT_CONFIG);
    expect(opts.language).toBe("auto");
    expect(opts.events_notification).toBe(true);
    expect(opts.events_stop).toBe(true);
    expect(opts.events_stopFailure).toBe(true);
    expect(opts.events_subagentStop).toBe(false);
    expect(opts.sound).toBe(true);
    expect(opts.debug).toBe(false);
  });

  it("converts plugin options back to RinglyConfig", () => {
    const config = pluginOptionsToRinglyConfig(
      {
        language: "pt-BR",
        events_notification: false,
        sound: false,
        debug: true,
      },
      DEFAULT_CONFIG,
    );

    expect(config.language).toBe("pt-BR");
    expect(config.events.notification).toBe(false);
    expect(config.events.stop).toBe(true);
    expect(config.sound).toBe(false);
    expect(config.debug).toBe(true);
  });

  it("falls back to defaults when plugin options have invalid language", () => {
    const config = pluginOptionsToRinglyConfig({ language: "fr-FR" }, DEFAULT_CONFIG);
    expect(config.language).toBe(DEFAULT_CONFIG.language);
  });

  it("does not leave .tmp.* leftover files after a successful write", () => {
    writeRinglyPluginOptions({ language: "pt-BR" });

    const dir = join(FAKE_HOME, ".claude");
    const entries = readFileSync ? require("node:fs").readdirSync(dir) : [];
    const leftovers = entries.filter((e: string) => e.includes(".tmp."));
    expect(leftovers).toEqual([]);
  });

  it("prunes backup files older than 7 days", () => {
    const file = getClaudeSettingsFile();
    mkdirSync(join(FAKE_HOME, ".claude"), { recursive: true });
    writeFileSync(file, JSON.stringify({ existing: true }));

    const oldBackup = `${file}.ringly-bak.2020-01-01T00-00-00-000Z`;
    writeFileSync(oldBackup, "{}");
    const fs = require("node:fs");
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    fs.utimesSync(oldBackup, new Date(eightDaysAgo), new Date(eightDaysAgo));

    writeRinglyPluginOptions({ debug: true });

    expect(existsSync(oldBackup)).toBe(false);
  });

  it("keeps backup files newer than 7 days", () => {
    const file = getClaudeSettingsFile();
    mkdirSync(join(FAKE_HOME, ".claude"), { recursive: true });
    writeFileSync(file, JSON.stringify({ existing: true }));

    const recentBackup = `${file}.ringly-bak.2026-05-20T00-00-00-000Z`;
    writeFileSync(recentBackup, "{}");

    writeRinglyPluginOptions({ debug: true });

    expect(existsSync(recentBackup)).toBe(true);
  });
});
