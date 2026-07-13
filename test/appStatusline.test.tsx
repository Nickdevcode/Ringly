/**
 * Regression test for the status-line master toggle in the config TUI.
 *
 * The bug: `App.finish` read `statusline` from React state, but the
 * StatuslinePicker submits on the same tick it calls `setStatusline` — so
 * `finish` saw the *stale* pre-toggle value and persisted `enabled: false`
 * even after the user switched it on. The fix threads the picker's freshly
 * chosen value straight into `finish` as an override.
 *
 * This drives the full `App` (config mode) through every screen up to the
 * status line, flips the master switch, confirms, and asserts `onComplete`
 * receives `statusline.enabled === true`.
 */
import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../src/core/config.js";
import type { RinglyConfig } from "../src/core/types.js";
import { App } from "../src/tui/App.js";

/** Lets Ink flush its render/input cycle between keystrokes. */
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const ENTER = "\r";
const SPACE = " ";

describe("App (config mode) → status line persistence", () => {
  it("persists enabled:true when the user turns the master toggle on and confirms", async () => {
    const initialConfig: RinglyConfig = {
      ...DEFAULT_CONFIG,
      language: "pt-BR",
      statusline: { ...DEFAULT_CONFIG.statusline, enabled: false },
    };

    let received: RinglyConfig | null = null;
    const onComplete = vi.fn((config: RinglyConfig) => {
      received = config;
    });

    const { stdin, unmount } = render(
      React.createElement(App, {
        initialConfig,
        isWindows: false,
        mode: "config",
        onComplete,
      }),
    );

    // config mode opens on the LanguagePicker (SelectInput): Enter picks the
    // highlighted item and advances to events.
    await tick();
    stdin.write(ENTER); // language → events
    await tick();
    stdin.write(ENTER); // events (HookPicker) → sound
    await tick();
    stdin.write(ENTER); // sound → statusline
    await tick();

    // StatuslinePicker: cursor starts on row 0 (master switch). Space flips it
    // on, Enter submits — this is the exact interaction that used to lose the
    // toggle.
    stdin.write(SPACE);
    await tick();
    stdin.write(ENTER);
    await tick(60);

    unmount();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(received).not.toBeNull();
    expect(received?.statusline.enabled).toBe(true);
  });
});
