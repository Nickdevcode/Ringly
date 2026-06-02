import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THROTTLE_WINDOW_MS,
  readThrottleRecord,
  shouldFire,
  throttleGate,
  throttleKey,
} from "../src/core/throttle.js";

describe("shouldFire", () => {
  it("fires when there is no prior record", () => {
    expect(shouldFire(undefined, 1000, 8000)).toBe(true);
  });

  it("fires when a non-finite last value is stored", () => {
    expect(shouldFire(Number.NaN, 1000, 8000)).toBe(true);
  });

  it("suppresses inside the window", () => {
    expect(shouldFire(1000, 1000 + 5000, 8000)).toBe(false);
  });

  it("fires once the window has fully elapsed", () => {
    expect(shouldFire(1000, 1000 + 8000, 8000)).toBe(true);
    expect(shouldFire(1000, 1000 + 9000, 8000)).toBe(true);
  });
});

describe("throttleKey", () => {
  it("combines event, project and agent", () => {
    expect(throttleKey("TaskCreated", "MyApp", "gsd-executor")).toBe(
      "TaskCreated:MyApp:gsd-executor",
    );
  });

  it("tolerates null project/agent", () => {
    expect(throttleKey("PreCompact", null, null)).toBe("PreCompact::");
  });

  it("distinguishes different agents in the same project", () => {
    expect(throttleKey("SubagentStart", "App", "Explore")).not.toBe(
      throttleKey("SubagentStart", "App", "Plan"),
    );
  });
});

describe("throttleGate", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ringly-throttle-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("allows the first fire and suppresses an immediate repeat", () => {
    const key = throttleKey("TaskCreated", "App", "agent");
    const now = 1_000_000;
    expect(throttleGate(dir, key, DEFAULT_THROTTLE_WINDOW_MS, now)).toBe(true);
    expect(throttleGate(dir, key, DEFAULT_THROTTLE_WINDOW_MS, now + 100)).toBe(false);
  });

  it("allows again after the window elapses", () => {
    const key = throttleKey("TaskCreated", "App", "agent");
    const now = 1_000_000;
    expect(throttleGate(dir, key, 8000, now)).toBe(true);
    expect(throttleGate(dir, key, 8000, now + 8000)).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    const now = 1_000_000;
    expect(throttleGate(dir, throttleKey("TaskCreated", "App", "a"), 8000, now)).toBe(true);
    expect(throttleGate(dir, throttleKey("TaskCreated", "App", "b"), 8000, now)).toBe(true);
  });

  it("persists via atomic write with no leftover tmp files", () => {
    throttleGate(dir, throttleKey("PreCompact", null, null), 8000, 1_000_000);
    const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp."));
    expect(leftovers).toEqual([]);
    expect(readdirSync(dir)).toContain("event-throttle.json");
  });

  it("fails open on a corrupt throttle file", () => {
    writeFileSync(join(dir, "event-throttle.json"), "{ not json");
    expect(throttleGate(dir, throttleKey("Stop", null, null), 8000, 1_000_000)).toBe(true);
  });

  it("prunes entries older than 10x the window", () => {
    const key = throttleKey("TaskCreated", "App", "old");
    const start = 1_000_000;
    throttleGate(dir, key, 8000, start);
    // Fire a different key far in the future; the stale one should be pruned.
    const farFuture = start + 8000 * 11;
    throttleGate(dir, throttleKey("TaskCreated", "App", "new"), 8000, farFuture);
    const record = readThrottleRecord(dir);
    expect(record.events[key]).toBeUndefined();
  });
});
