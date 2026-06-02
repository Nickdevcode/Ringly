import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemoteChangelog } from "../src/core/remoteChangelog.js";

/**
 * `fetchRemoteChangelog` reads CHANGELOG.md from GitHub at a release tag so
 * `/ringly-update` can show notes for a version newer than the installed one.
 * It must be fully fail-silent (any failure → null) and must validate the
 * version before building a URL (no path traversal). `fetch` is mocked the same
 * way as in `updateCheck.test.ts`.
 */
describe("fetchRemoteChangelog", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns the CHANGELOG body when the tag responds 200", async () => {
    const body = "# Changelog\n\n## [0.7.0] — 2026-06-02\n";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));

    const result = await fetchRemoteChangelog("0.7.0");
    expect(result).toBe(body);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("tries the `v<version>` tag URL first", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("# Changelog\n", { status: 200 }));
    globalThis.fetch = fetchSpy;

    await fetchRemoteChangelog("0.7.0");

    const firstUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(firstUrl).toContain("/v0.7.0/CHANGELOG.md");
  });

  it("falls back to the next ref after a 404, then succeeds", async () => {
    const body = "# Changelog\n\n## [0.7.0]\n";
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 })) // v0.7.0 tag
      .mockResolvedValueOnce(new Response("not found", { status: 404 })) // bare 0.7.0 tag
      .mockResolvedValueOnce(new Response(body, { status: 200 })); // main
    globalThis.fetch = fetchSpy;

    const result = await fetchRemoteChangelog("0.7.0");
    expect(result).toBe(body);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const lastUrl = fetchSpy.mock.calls[2]?.[0] as string;
    expect(lastUrl).toContain("/main/CHANGELOG.md");
  });

  it("returns null when every ref 404s", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));
    expect(await fetchRemoteChangelog("9.9.9")).toBeNull();
  });

  it("returns null on a network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await fetchRemoteChangelog("0.7.0")).toBeNull();
  });

  it("returns null on an empty body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    expect(await fetchRemoteChangelog("0.7.0")).toBeNull();
  });

  it("returns null when the body exceeds the size cap", async () => {
    const huge = "a".repeat(512 * 1024 + 1);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(huge, { status: 200 }));
    expect(await fetchRemoteChangelog("0.7.0")).toBeNull();
  });

  it("rejects a malformed version without calling fetch", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    expect(await fetchRemoteChangelog("../../etc/passwd")).toBeNull();
    expect(await fetchRemoteChangelog("not-semver")).toBeNull();
    expect(await fetchRemoteChangelog("0.7")).toBeNull();
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

    const result = await fetchRemoteChangelog("0.7.0", { timeoutMs: 10 });
    expect(result).toBeNull();
  });

  it("honors a custom ownerRepo and rawHost (for tests/forks)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("# Changelog\n", { status: 200 }));
    globalThis.fetch = fetchSpy;

    await fetchRemoteChangelog("0.7.0", {
      ownerRepo: "someone/Fork",
      rawHost: "https://example.test",
    });

    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toBe("https://example.test/someone/Fork/v0.7.0/CHANGELOG.md");
  });
});
