import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/core/notifier.js", () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/core/config.js", async () => {
  // Derive from the real DEFAULT_CONFIG so the mock stays a complete, valid
  // RinglyConfig as the registry grows (all event keys + checkUpdates present),
  // overriding only the language for the assertions below.
  const actual =
    await vi.importActual<typeof import("../src/core/config.js")>("../src/core/config.js");
  return {
    loadConfig: vi.fn(() => ({ ...actual.DEFAULT_CONFIG, language: "en-US" })),
    applyEnvOverrides: vi.fn((cfg) => cfg),
  };
});

import { runHook } from "../src/commands/hook.js";
import { applyEnvOverrides, loadConfig } from "../src/core/config.js";
import { notify } from "../src/core/notifier.js";

describe("runHook", () => {
  let originalStdin: NodeJS.ReadStream;
  let fakeStdin: PassThrough;

  beforeEach(() => {
    originalStdin = process.stdin;
    fakeStdin = new PassThrough();
    Object.defineProperty(fakeStdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process, "stdin", {
      value: fakeStdin,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      configurable: true,
    });
  });

  it("dispatches notify when event is in payload", async () => {
    const payload = JSON.stringify({ hook_event_name: "Stop", cwd: "/test" });
    queueMicrotask(() => {
      fakeStdin.write(payload);
      fakeStdin.end();
    });

    await runHook();

    expect(loadConfig).toHaveBeenCalled();
    expect(applyEnvOverrides).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledOnce();
    const callArg = (notify as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as {
      event: string;
    };
    expect(callArg.event).toBe("Stop");
  });

  it("uses forcedEvent over payload event", async () => {
    const payload = JSON.stringify({ hook_event_name: "Stop" });
    queueMicrotask(() => {
      fakeStdin.write(payload);
      fakeStdin.end();
    });

    await runHook({ forcedEvent: "Notification" });

    expect(notify).toHaveBeenCalledOnce();
    const callArg = (notify as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as {
      event: string;
    };
    expect(callArg.event).toBe("Notification");
  });

  it("does not notify when no recognizable event is given", async () => {
    queueMicrotask(() => {
      fakeStdin.write("{}");
      fakeStdin.end();
    });

    await runHook();

    expect(notify).not.toHaveBeenCalled();
  });

  it("rejects disallowed event names from payload", async () => {
    queueMicrotask(() => {
      fakeStdin.write(JSON.stringify({ hook_event_name: "MaliciousEvent" }));
      fakeStdin.end();
    });

    await runHook();

    expect(notify).not.toHaveBeenCalled();
  });

  it("does not throw when stdin sends invalid JSON", async () => {
    queueMicrotask(() => {
      fakeStdin.write("not-json");
      fakeStdin.end();
    });

    await expect(runHook({ forcedEvent: "Stop" })).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledOnce();
  });
});
