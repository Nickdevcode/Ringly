/**
 * Fetches the project's `CHANGELOG.md` from GitHub at the tag of a *new*
 * release, so `/ringly-update` can show "what's new" even when the locally
 * installed package predates that version.
 *
 * Why this exists: `readPackagedChangelog` only sees the CHANGELOG shipped
 * inside the *installed* tarball. On a version jump (e.g. 0.6.0 → 0.7.0) that
 * file has no entry for the new version yet — the entry was written when the
 * new version was published, which is necessarily after the old tarball was
 * built. So the notes came back `null`. This module closes that gap by reading
 * the CHANGELOG straight from the tag on GitHub.
 *
 * Design notes:
 *  - No new runtime dependency — Node 20+ native `fetch` + `AbortController`,
 *    same as `updateCheck.ts`.
 *  - Fail-silent: every failure path (offline, 404, timeout, oversized body,
 *    bad version) returns `null`. The caller treats `null` as "fall back to
 *    'release notes unavailable'", never as an error.
 *  - This module is CLI-only (loaded by `commands/update.ts`), NOT on the hook
 *    hot path — so it may use `fetch`/timeouts freely.
 */
import { isValidSemver } from "./updateCheck.js";

const DEFAULT_TIMEOUT_MS = 3000;
/** GitHub raw responses for our CHANGELOG are tens of KB; 512 KB is a safe ceiling. */
const MAX_BYTES = 512 * 1024;
const RAW_HOST = "https://raw.githubusercontent.com";
const DEFAULT_OWNER_REPO = "Nickdevcode/Ringly";

export interface FetchRemoteChangelogOptions {
  timeoutMs?: number;
  /** Override the `owner/repo` slug (defaults to the project's repo). Mainly for tests. */
  ownerRepo?: string;
  /** Override the raw host (mainly for tests). */
  rawHost?: string;
}

/**
 * Returns the raw CHANGELOG.md text for `version` from GitHub, or `null` on any
 * failure. Tries, in order, stopping at the first 200:
 *   1. the `v<version>` tag (our release tags are `vX.Y.Z`)
 *   2. the bare `<version>` tag (defensive, in case a tag lacks the `v`)
 *   3. the `main` branch (fallback — always carries the newest entry)
 */
export async function fetchRemoteChangelog(
  version: string,
  options: FetchRemoteChangelogOptions = {},
): Promise<string | null> {
  // Validate before building any URL — blocks path traversal / injection via a
  // malformed version string coming from the registry response.
  if (!isValidSemver(version)) return null;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ownerRepo = options.ownerRepo ?? DEFAULT_OWNER_REPO;
  const host = options.rawHost ?? RAW_HOST;

  const refs = [`v${version}`, version, "main"];
  for (const ref of refs) {
    const url = `${host}/${ownerRepo}/${ref}/CHANGELOG.md`;
    const body = await fetchText(url, timeoutMs);
    if (body !== null) return body;
  }
  return null;
}

/**
 * Single GET returning the response text, or `null` on non-200, network error,
 * timeout, or a body larger than `MAX_BYTES`.
 */
async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/plain" },
    });
    if (!response.ok) return null;

    const text = await response.text();
    if (text.length > MAX_BYTES) return null;
    if (text.length === 0) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
