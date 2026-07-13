import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEnvOverrides, DEFAULT_CONFIG } from "../src/core/config.js";

const TARGET_VARS = [
  "CLAUDE_PLUGIN_OPTION_LANGUAGE",
  "CLAUDE_PLUGIN_OPTION_EVENTS_NOTIFICATION",
  "CLAUDE_PLUGIN_OPTION_EVENTS_STOP",
  "CLAUDE_PLUGIN_OPTION_EVENTS_STOPFAILURE",
  "CLAUDE_PLUGIN_OPTION_EVENTS_SUBAGENTSTOP",
  "CLAUDE_PLUGIN_OPTION_SOUND",
  "CLAUDE_PLUGIN_OPTION_DEBUG",
  "CLAUDE_PLUGIN_OPTION_STATUSLINE_ENABLED",
  "CLAUDE_PLUGIN_OPTION_STATUSLINE_POSITION",
  "CLAUDE_PLUGIN_OPTION_STATUSLINE_SEGMENTS_GIT",
  "CLAUDE_PLUGIN_OPTION_STATUSLINE_SEGMENTS_LASTCOMMAND",
];

describe("applyEnvOverrides", () => {
  const backup: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of TARGET_VARS) {
      backup[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of TARGET_VARS) {
      if (backup[key] === undefined) delete process.env[key];
      else process.env[key] = backup[key];
    }
  });

  it("returns config unchanged when no env vars are set", () => {
    const result = applyEnvOverrides(DEFAULT_CONFIG);
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it("overrides language when CLAUDE_PLUGIN_OPTION_LANGUAGE is set", () => {
    process.env["CLAUDE_PLUGIN_OPTION_LANGUAGE"] = "en-US";
    const result = applyEnvOverrides(DEFAULT_CONFIG);
    expect(result.language).toBe("en-US");
  });

  it("ignores invalid language values", () => {
    process.env["CLAUDE_PLUGIN_OPTION_LANGUAGE"] = "fr-FR";
    const result = applyEnvOverrides(DEFAULT_CONFIG);
    expect(result.language).toBe(DEFAULT_CONFIG.language);
  });

  it("toggles individual event flags", () => {
    process.env["CLAUDE_PLUGIN_OPTION_EVENTS_SUBAGENTSTOP"] = "true";
    process.env["CLAUDE_PLUGIN_OPTION_EVENTS_STOP"] = "false";
    const result = applyEnvOverrides(DEFAULT_CONFIG);
    expect(result.events.subagentStop).toBe(true);
    expect(result.events.stop).toBe(false);
  });

  it("respects sound and debug flags", () => {
    process.env["CLAUDE_PLUGIN_OPTION_SOUND"] = "false";
    process.env["CLAUDE_PLUGIN_OPTION_DEBUG"] = "true";
    const result = applyEnvOverrides(DEFAULT_CONFIG);
    expect(result.sound).toBe(false);
    expect(result.debug).toBe(true);
  });

  it("toggles the status line master switch and segments", () => {
    process.env["CLAUDE_PLUGIN_OPTION_STATUSLINE_ENABLED"] = "true";
    process.env["CLAUDE_PLUGIN_OPTION_STATUSLINE_SEGMENTS_GIT"] = "false";
    process.env["CLAUDE_PLUGIN_OPTION_STATUSLINE_SEGMENTS_LASTCOMMAND"] = "true";
    const result = applyEnvOverrides(DEFAULT_CONFIG);
    expect(result.statusline.enabled).toBe(true);
    expect(result.statusline.segments.git).toBe(false);
    expect(result.statusline.segments.lastCommand).toBe(true);
    // Untouched segments keep their defaults.
    expect(result.statusline.segments.model).toBe(true);
  });

  it("accepts a valid status line position and ignores an invalid one", () => {
    process.env["CLAUDE_PLUGIN_OPTION_STATUSLINE_POSITION"] = "front";
    expect(applyEnvOverrides(DEFAULT_CONFIG).statusline.position).toBe("front");

    process.env["CLAUDE_PLUGIN_OPTION_STATUSLINE_POSITION"] = "sideways";
    expect(applyEnvOverrides(DEFAULT_CONFIG).statusline.position).toBe(
      DEFAULT_CONFIG.statusline.position,
    );
  });

  it("defaults the status line to disabled", () => {
    expect(DEFAULT_CONFIG.statusline.enabled).toBe(false);
    expect(DEFAULT_CONFIG.statusline.position).toBe("end");
  });
});
