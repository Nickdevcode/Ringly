import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/core/config.js";
import { buildIntent, isEventEnabled } from "../src/core/notifier.js";
import type { ClaudeHookPayload, RinglyConfig } from "../src/core/types.js";

describe("isEventEnabled", () => {
  const baseConfig: RinglyConfig = {
    ...DEFAULT_CONFIG,
    events: {
      notification: true,
      stop: false,
      stopFailure: true,
      subagentStop: false,
    },
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
