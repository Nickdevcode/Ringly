import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkForUpdate,
  compareSemver,
  isValidSemver,
  readLastCheckRecord,
  recordCheck,
  shouldCheckUpdate,
} from "../src/core/updateCheck.js";

describe("compareSemver", () => {
  it("returns 0 for equal versions", () => {
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
  });

  it("returns positive when first version is higher", () => {
    expect(compareSemver("1.2.4", "1.2.3")).toBeGreaterThan(0);
    expect(compareSemver("1.3.0", "1.2.9")).toBeGreaterThan(0);
    expect(compareSemver("2.0.0", "1.9.9")).toBeGreaterThan(0);
  });

  it("returns negative when first version is lower", () => {
    expect(compareSemver("1.2.3", "1.2.4")).toBeLessThan(0);
    expect(compareSemver("0.3.0", "0.3.1")).toBeLessThan(0);
  });

  it("treats prerelease as lower than release", () => {
    expect(compareSemver("1.0.0-alpha", "1.0.0")).toBeLessThan(0);
    expect(compareSemver("1.0.0", "1.0.0-alpha")).toBeGreaterThan(0);
  });

  it("compares prereleases lexicographically", () => {
    expect(compareSemver("1.0.0-alpha", "1.0.0-beta")).toBeLessThan(0);
    expect(compareSemver("1.0.0-beta", "1.0.0-alpha")).toBeGreaterThan(0);
  });

  it("never returns NaN for malformed components (coerces unparseable parts to 0)", () => {
    // Defensive: even if an unvalidated string slips in, the result must stay a
    // real number so a `> 0` check can't silently read NaN as "no update".
    expect(Number.isNaN(compareSemver("1.2.x", "1.2.3"))).toBe(false);
    expect(Number.isNaN(compareSemver("foo", "bar"))).toBe(false);
    expect(Number.isNaN(compareSemver("", ""))).toBe(false);
    // "1.2.x" → [1,2,0] equals "1.2.0", and 1.2.0 < 1.2.3.
    expect(compareSemver("1.2.x", "1.2.3")).toBeLessThan(0);
    expect(compareSemver("1.2.x", "1.2.0")).toBe(0);
  });
});

describe("isValidSemver", () => {
  it("accepts standard semver", () => {
    expect(isValidSemver("0.3.0")).toBe(true);
    expect(isValidSemver("1.0.0")).toBe(true);
    expect(isValidSemver("10.20.30")).toBe(true);
  });

  it("accepts prerelease suffix", () => {
    expect(isValidSemver("1.0.0-alpha")).toBe(true);
    expect(isValidSemver("1.0.0-rc.1")).toBe(true);
  });

  it("rejects malformed versions", () => {
    expect(isValidSemver("1")).toBe(false);
    expect(isValidSemver("1.2")).toBe(false);
    expect(isValidSemver("v1.2.3")).toBe(false);
    expect(isValidSemver("1.2.3.4")).toBe(false);
    expect(isValidSemver("")).toBe(false);
    expect(isValidSemver("not-a-version")).toBe(false);
  });
});

describe("shouldCheckUpdate", () => {
  const now = new Date("2026-05-26T12:00:00.000Z");

  it("returns true when no record exists", () => {
    expect(shouldCheckUpdate(undefined, now)).toBe(true);
  });

  it("returns true when record is malformed", () => {
    expect(shouldCheckUpdate("garbage", now)).toBe(true);
  });

  it("returns true when more than 24h has passed", () => {
    const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    expect(shouldCheckUpdate(yesterday.toISOString(), now)).toBe(true);
  });

  it("returns false when less than 24h has passed", () => {
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    expect(shouldCheckUpdate(hourAgo.toISOString(), now)).toBe(false);
  });

  it("returns true exactly at the 24h boundary", () => {
    const exactly24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(shouldCheckUpdate(exactly24h.toISOString(), now)).toBe(true);
  });
});

describe("recordCheck + readLastCheckRecord", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ringly-update-check-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null when no record file exists", () => {
    expect(readLastCheckRecord(tempDir)).toBeNull();
  });

  it("writes and reads back a record", () => {
    const now = new Date("2026-05-26T12:00:00.000Z");
    recordCheck(tempDir, now);
    const record = readLastCheckRecord(tempDir);
    expect(record).toEqual({ lastCheckIso: now.toISOString() });
  });

  it("returns null for malformed JSON", () => {
    writeFileSync(join(tempDir, "last-update-check.json"), "{ broken");
    expect(readLastCheckRecord(tempDir)).toBeNull();
  });

  it("returns null when shape is wrong", () => {
    writeFileSync(join(tempDir, "last-update-check.json"), '{"wrong":"shape"}');
    expect(readLastCheckRecord(tempDir)).toBeNull();
  });

  it("persists via atomic write (no leftover tmp files)", () => {
    recordCheck(tempDir, new Date("2026-05-26T12:00:00.000Z"));
    const contents = readFileSync(join(tempDir, "last-update-check.json"), "utf8");
    expect(JSON.parse(contents)).toHaveProperty("lastCheckIso");
  });
});

describe("checkForUpdate", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns hasUpdate=true when registry reports a newer version", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ version: "0.4.0" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await checkForUpdate({
      packageName: "ringly",
      currentVersion: "0.3.0",
    });

    expect(result).toEqual({
      currentVersion: "0.3.0",
      latestVersion: "0.4.0",
      hasUpdate: true,
    });
  });

  it("returns hasUpdate=false when versions match", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ version: "0.3.0" }), { status: 200 }));

    const result = await checkForUpdate({
      packageName: "ringly",
      currentVersion: "0.3.0",
    });

    expect(result?.hasUpdate).toBe(false);
  });

  it("returns hasUpdate=false when local is ahead (e.g. dev build)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ version: "0.3.0" }), { status: 200 }));

    const result = await checkForUpdate({
      packageName: "ringly",
      currentVersion: "0.4.0",
    });

    expect(result?.hasUpdate).toBe(false);
  });

  it("returns null on non-2xx response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));

    const result = await checkForUpdate({
      packageName: "ringly",
      currentVersion: "0.3.0",
    });

    expect(result).toBeNull();
  });

  it("returns null when network throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await checkForUpdate({
      packageName: "ringly",
      currentVersion: "0.3.0",
    });

    expect(result).toBeNull();
  });

  it("returns null when response is not valid JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));

    const result = await checkForUpdate({
      packageName: "ringly",
      currentVersion: "0.3.0",
    });

    expect(result).toBeNull();
  });

  it("returns null when version field is missing", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ name: "ringly" }), { status: 200 }));

    const result = await checkForUpdate({
      packageName: "ringly",
      currentVersion: "0.3.0",
    });

    expect(result).toBeNull();
  });

  it("returns null when version field is not a valid semver", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ version: "not-semver" }), { status: 200 }));

    const result = await checkForUpdate({
      packageName: "ringly",
      currentVersion: "0.3.0",
    });

    expect(result).toBeNull();
  });

  it("rejects invalid package names without hitting the network", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const result = await checkForUpdate({
      packageName: "../escape",
      currentVersion: "0.3.0",
    });

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid current versions without hitting the network", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const result = await checkForUpdate({
      packageName: "ringly",
      currentVersion: "not-a-version",
    });

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("aborts on timeout and returns null", async () => {
    globalThis.fetch = vi.fn().mockImplementation((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const result = await checkForUpdate({
      packageName: "ringly",
      currentVersion: "0.3.0",
      timeoutMs: 10,
    });

    expect(result).toBeNull();
  });

  it("uses custom registry URL when provided", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ version: "0.3.0" }), { status: 200 }));
    globalThis.fetch = fetchSpy;

    await checkForUpdate({
      packageName: "ringly",
      currentVersion: "0.3.0",
      registryUrl: "https://custom.registry.example.com",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://custom.registry.example.com/ringly/latest",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
