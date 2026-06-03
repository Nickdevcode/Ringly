import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dispatchSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("../src/channels/index.js", () => ({
  buildDefaultChannels: vi.fn(() => []),
  dispatchToChannels: (...args: unknown[]) => dispatchSpy(...args),
}));

import { DEFAULT_CONFIG } from "../src/core/config.js";
import { buildIntent, isEventEnabled, notify } from "../src/core/notifier.js";
import type { ClaudeHookPayload, RinglyConfig } from "../src/core/types.js";

describe("isEventEnabled", () => {
  const baseConfig: RinglyConfig = {
    ...DEFAULT_CONFIG,
    events: { ...DEFAULT_CONFIG.events, notification: true, stop: false, stopFailure: true },
  };

  it("returns config flag for Notification event", () => {
    expect(isEventEnabled("Notification", baseConfig)).toBe(true);
    expect(
      isEventEnabled("Notification", {
        ...baseConfig,
        events: { ...baseConfig.events, notification: false },
      }),
    ).toBe(false);
  });

  it("returns config flag for Stop event", () => {
    expect(isEventEnabled("Stop", baseConfig)).toBe(false);
  });

  it("returns config flag for StopFailure event", () => {
    expect(isEventEnabled("StopFailure", baseConfig)).toBe(true);
  });

  it("returns config flag for SubagentStop event", () => {
    expect(isEventEnabled("SubagentStop", baseConfig)).toBe(false);
  });
});

describe("buildIntent", () => {
  const config: RinglyConfig = { ...DEFAULT_CONFIG, language: "pt-BR", sound: true };

  it("builds Stop intent in pt-BR with project prefix", () => {
    const payload: ClaudeHookPayload = { cwd: "/path/to/MyApp" };
    const intent = buildIntent({ event: "Stop", payload, config });
    expect(intent.event).toBe("Stop");
    expect(intent.title).toContain("Tarefa concluída");
    expect(intent.body).toContain("MyApp");
    expect(intent.severity).toBe("info");
    expect(intent.sound).toBe(true);
  });

  it("builds Notification intent with severity warning", () => {
    const payload: ClaudeHookPayload = { message: "Claude needs your permission to use Bash" };
    const intent = buildIntent({ event: "Notification", payload, config });
    expect(intent.severity).toBe("warning");
    expect(intent.body).toContain("Bash");
  });

  it("builds StopFailure intent with severity error", () => {
    const payload: ClaudeHookPayload = { error_type: "rate_limit" };
    const intent = buildIntent({ event: "StopFailure", payload, config });
    expect(intent.severity).toBe("error");
  });

  it("builds SubagentStop intent with agent name", () => {
    const payload: ClaudeHookPayload = { agent_type: "gsd-executor" };
    const intent = buildIntent({ event: "SubagentStop", payload, config });
    expect(intent.body).toContain("gsd-executor");
  });

  it("respects soundEnabled=false from config", () => {
    const intent = buildIntent({
      event: "Stop",
      payload: {},
      config: { ...config, sound: false },
    });
    expect(intent.sound).toBe(false);
  });
});

describe("notify", () => {
  let dataDir: string;
  const originalDataDir = process.env["CLAUDE_PLUGIN_DATA"];

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "ringly-notify-"));
    process.env["CLAUDE_PLUGIN_DATA"] = dataDir;
    dispatchSpy.mockClear();
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    if (originalDataDir === undefined) delete process.env["CLAUDE_PLUGIN_DATA"];
    else process.env["CLAUDE_PLUGIN_DATA"] = originalDataDir;
  });

  it("skips dispatch when the event is disabled", async () => {
    // SubagentStop is off by default.
    await notify({ event: "SubagentStop", payload: {}, config: DEFAULT_CONFIG });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("dispatches a non-verbose enabled event without touching the throttle", async () => {
    await notify({ event: "Stop", payload: { cwd: "/x/App" }, config: DEFAULT_CONFIG });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it("throttles a verbose event: first fires, immediate repeat is suppressed", async () => {
    const config: RinglyConfig = {
      ...DEFAULT_CONFIG,
      events: { ...DEFAULT_CONFIG.events, subagentStart: true },
    };
    const payload: ClaudeHookPayload = { cwd: "/x/App", agent_type: "Explore" };
    await notify({ event: "SubagentStart", payload, config });
    await notify({ event: "SubagentStart", payload, config });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not throttle distinct subagents of the same verbose event", async () => {
    const config: RinglyConfig = {
      ...DEFAULT_CONFIG,
      events: { ...DEFAULT_CONFIG.events, subagentStart: true },
    };
    await notify({
      event: "SubagentStart",
      payload: { cwd: "/x/App", agent_type: "Explore" },
      config,
    });
    await notify({
      event: "SubagentStart",
      payload: { cwd: "/x/App", agent_type: "Plan" },
      config,
    });
    expect(dispatchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("notify - TaskCompleted progress counter", () => {
  let dataDir: string;
  const originalDataDir = process.env["CLAUDE_PLUGIN_DATA"];
  const taskConfig: RinglyConfig = {
    ...DEFAULT_CONFIG,
    language: "pt-BR",
    events: { ...DEFAULT_CONFIG.events, taskCreated: true, taskCompleted: true },
  };

  // Body of the most recent dispatched intent.
  const lastBody = () => {
    const calls = dispatchSpy.mock.calls;
    return (calls[calls.length - 1]?.[0] as { body: string }).body;
  };

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "ringly-progress-notify-"));
    process.env["CLAUDE_PLUGIN_DATA"] = dataDir;
    dispatchSpy.mockClear();
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    if (originalDataDir === undefined) delete process.env["CLAUDE_PLUGIN_DATA"];
    else process.env["CLAUDE_PLUGIN_DATA"] = originalDataDir;
  });

  it("shows the counter after seeing two created tasks and completing one", async () => {
    await notify({
      event: "TaskCreated",
      payload: { cwd: "/x/App", session_id: "s1", task_id: "1", task_subject: "A" },
      config: taskConfig,
    });
    await notify({
      event: "TaskCreated",
      payload: { cwd: "/x/App", session_id: "s1", task_id: "2", task_subject: "B" },
      config: taskConfig,
    });
    await notify({
      event: "TaskCompleted",
      payload: { cwd: "/x/App", session_id: "s1", task_id: "1", task_subject: "A" },
      config: taskConfig,
    });
    expect(lastBody()).toBe("App: ✓ A (1/2)");
  });

  it("never shows a counter on TaskCreated", async () => {
    await notify({
      event: "TaskCreated",
      payload: { cwd: "/x/App", session_id: "s1", task_id: "1", task_subject: "A" },
      config: taskConfig,
    });
    expect(lastBody()).not.toContain("(");
  });

  it("dedupes a repeated completion of the same task id (counter stays 1/2)", async () => {
    await notify({
      event: "TaskCreated",
      payload: { cwd: "/x/App", session_id: "s1", task_id: "2", task_subject: "B" },
      config: taskConfig,
    });
    await notify({
      event: "TaskCompleted",
      payload: { cwd: "/x/App", session_id: "s1", task_id: "1", task_subject: "A" },
      config: taskConfig,
    });
    // Re-complete the SAME id with a distinct subject so the throttle dedup key
    // differs and the toast actually dispatches again.
    await notify({
      event: "TaskCompleted",
      payload: { cwd: "/x/App", session_id: "s1", task_id: "1", task_subject: "A (retry)" },
      config: taskConfig,
    });
    expect(lastBody()).toBe("App: ✓ A (retry) (1/2)");
  });

  it("omits the counter when task_id is absent", async () => {
    await notify({
      event: "TaskCompleted",
      payload: { cwd: "/x/App", session_id: "s1", task_subject: "A" },
      config: taskConfig,
    });
    expect(lastBody()).toBe("App: ✓ A");
  });
});
