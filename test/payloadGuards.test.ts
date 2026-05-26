import { describe, expect, it } from "vitest";
import { coerceClaudeHookPayload } from "../src/core/payloadGuards.js";

describe("coerceClaudeHookPayload", () => {
  it("returns empty object for non-object input", () => {
    expect(coerceClaudeHookPayload(null)).toEqual({});
    expect(coerceClaudeHookPayload(undefined)).toEqual({});
    expect(coerceClaudeHookPayload("string")).toEqual({});
    expect(coerceClaudeHookPayload(42)).toEqual({});
    expect(coerceClaudeHookPayload([])).toEqual({});
  });

  it("keeps allowed event names", () => {
    expect(coerceClaudeHookPayload({ hook_event_name: "Stop" })).toEqual({
      hook_event_name: "Stop",
    });
    expect(coerceClaudeHookPayload({ hook_event_name: "Notification" })).toEqual({
      hook_event_name: "Notification",
    });
  });

  it("drops disallowed event names", () => {
    expect(coerceClaudeHookPayload({ hook_event_name: "Hack" })).toEqual({});
    expect(coerceClaudeHookPayload({ hook_event_name: 123 })).toEqual({});
  });

  it("truncates oversized strings to 500 chars", () => {
    const big = "a".repeat(2000);
    const result = coerceClaudeHookPayload({ message: big, agent_type: big });
    expect(result.message?.length).toBe(500);
    expect(result.agent_type?.length).toBe(500);
  });

  it("allows path-like strings up to 1024 chars", () => {
    const longPath = `/${"x".repeat(900)}`;
    const result = coerceClaudeHookPayload({ cwd: longPath });
    expect(result.cwd?.length).toBe(901);
  });

  it("truncates paths beyond 1024 chars", () => {
    const longPath = "/".repeat(2000);
    const result = coerceClaudeHookPayload({ cwd: longPath });
    expect(result.cwd?.length).toBe(1024);
  });

  it("drops empty strings", () => {
    const result = coerceClaudeHookPayload({ message: "", agent_type: "" });
    expect(result.message).toBeUndefined();
    expect(result.agent_type).toBeUndefined();
  });

  it("drops non-string fields", () => {
    const result = coerceClaudeHookPayload({
      message: 123,
      cwd: { not: "string" },
      error: true,
    });
    expect(result.message).toBeUndefined();
    expect(result.cwd).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it("discards unknown extra fields", () => {
    const result = coerceClaudeHookPayload({
      hook_event_name: "Stop",
      malicious_field: "should be dropped",
      __proto__: { polluted: true },
    });
    expect(result).toEqual({ hook_event_name: "Stop" });
    expect((result as Record<string, unknown>).malicious_field).toBeUndefined();
  });

  it("handles a realistic full payload", () => {
    const result = coerceClaudeHookPayload({
      hook_event_name: "StopFailure",
      cwd: "/home/user/project",
      message: "rate limited",
      error_type: "rate_limit",
      error: "Too many requests",
      session_id: "abc-123",
    });
    expect(result).toEqual({
      hook_event_name: "StopFailure",
      cwd: "/home/user/project",
      message: "rate limited",
      error_type: "rate_limit",
      error: "Too many requests",
      session_id: "abc-123",
    });
  });
});
