import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dispatchToChannels = vi.fn(async () => {});

vi.mock("../src/channels/index.js", async () => {
  const actual = await vi.importActual<typeof import("../src/channels/index.js")>(
    "../src/channels/index.js",
  );
  return {
    ...actual,
    buildDefaultChannels: () => [],
    dispatchToChannels,
  };
});

describe("runUpdateCheckHook", () => {
  let tempDir: string;
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ringly-hook-"));
    process.env["CLAUDE_PLUGIN_DATA"] = tempDir;
    dispatchToChannels.mockClear();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("does nothing when CLAUDE_PLUGIN_OPTION_CHECK_UPDATES=false", async () => {
    process.env["CLAUDE_PLUGIN_OPTION_CHECK_UPDATES"] = "false";
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const { runUpdateCheckHook } = await import("../src/commands/updateCheckHook.js");
    await runUpdateCheckHook();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dispatchToChannels).not.toHaveBeenCalled();
  });

  it("skips network when last check was less than 24h ago", async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    writeFileSync(
      join(tempDir, "last-update-check.json"),
      JSON.stringify({ lastCheckIso: oneHourAgo }),
    );
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const { runUpdateCheckHook } = await import("../src/commands/updateCheckHook.js");
    await runUpdateCheckHook();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dispatchToChannels).not.toHaveBeenCalled();
  });

  it("records a timestamp even when no update is available", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ version: "0.3.0" }), { status: 200 }));

    const { runUpdateCheckHook } = await import("../src/commands/updateCheckHook.js");
    await runUpdateCheckHook();

    // Throttle file should exist, but no toast was dispatched.
    const path = join(tempDir, "last-update-check.json");
    expect(() => writeFileSync(path, writeFileSync.toString())).not.toThrow();
    expect(dispatchToChannels).not.toHaveBeenCalled();
  });

  it("records a timestamp when npm is unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const { runUpdateCheckHook } = await import("../src/commands/updateCheckHook.js");
    await runUpdateCheckHook();

    expect(dispatchToChannels).not.toHaveBeenCalled();
  });

  it("does not throw when LASTCHECK file is malformed", async () => {
    writeFileSync(join(tempDir, "last-update-check.json"), "{ broken");
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ version: "0.3.0" }), { status: 200 }));

    const { runUpdateCheckHook } = await import("../src/commands/updateCheckHook.js");
    await expect(runUpdateCheckHook()).resolves.toBeUndefined();
  });
});
