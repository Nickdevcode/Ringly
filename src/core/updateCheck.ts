/**
 * Checks the npm registry for a newer Ringly release and persists a
 * timestamp so we only hit the network once per day. Designed to run
 * inside the SessionStart hook, so it must fail silently and finish fast
 * — never block the Claude Code session start, even if npm is unreachable.
 *
 * Why a custom module instead of `npm-check-updates` or `latest-version`:
 * we need zero new runtime deps (dispatch.mjs has none on purpose) and
 * Node 20+ fetch is already a project requirement (see engines.node).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFileSync } from "./atomicWrite.js";

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
}

export interface CheckForUpdateOptions {
  packageName: string;
  currentVersion: string;
  timeoutMs?: number;
  registryUrl?: string;
}

const DEFAULT_REGISTRY = "https://registry.npmjs.org";
const DEFAULT_TIMEOUT_MS = 3000;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const LAST_CHECK_FILENAME = "last-update-check.json";

interface LastCheckRecord {
  lastCheckIso: string;
}

/**
 * Fetches the latest version of `packageName` from the npm registry and
 * compares it to `currentVersion`. Returns `null` on any failure (timeout,
 * network error, bad JSON, etc.) — callers must treat `null` as "do not
 * notify" rather than as an error.
 */
export async function checkForUpdate(
  opts: CheckForUpdateOptions,
): Promise<UpdateCheckResult | null> {
  const { packageName, currentVersion } = opts;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const registry = opts.registryUrl ?? DEFAULT_REGISTRY;

  if (!isValidPackageName(packageName) || !isValidSemver(currentVersion)) {
    return null;
  }

  const url = `${registry}/${encodeURIComponent(packageName)}/latest`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { version?: unknown };
    const latestVersion = data.version;

    if (typeof latestVersion !== "string" || !isValidSemver(latestVersion)) {
      return null;
    }

    return {
      currentVersion,
      latestVersion,
      hasUpdate: compareSemver(latestVersion, currentVersion) > 0,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns true when more than `CHECK_INTERVAL_MS` has elapsed since the
 * recorded last check, or when no record exists yet. Invalid records are
 * treated as "never checked" so a corrupted file does not lock the user
 * out of update checks forever.
 */
export function shouldCheckUpdate(
  lastCheckIso: string | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastCheckIso) return true;
  const last = Date.parse(lastCheckIso);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= CHECK_INTERVAL_MS;
}

export function readLastCheckRecord(dataDir: string): LastCheckRecord | null {
  const path = join(dataDir, LAST_CHECK_FILENAME);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "lastCheckIso" in parsed &&
      typeof (parsed as { lastCheckIso: unknown }).lastCheckIso === "string"
    ) {
      return parsed as LastCheckRecord;
    }
    return null;
  } catch {
    return null;
  }
}

export function recordCheck(dataDir: string, now: Date = new Date()): void {
  const path = join(dataDir, LAST_CHECK_FILENAME);
  const record: LastCheckRecord = { lastCheckIso: now.toISOString() };
  try {
    atomicWriteFileSync(path, JSON.stringify(record));
  } catch {
    /* fail silent; next session will retry */
  }
}

/**
 * Compares two semver strings (`x.y.z`, optional `-prerelease` suffix).
 * Returns >0 if a > b, <0 if a < b, 0 if equal. Prerelease versions
 * always lose to their non-prerelease counterparts, matching the
 * semver 2.0 spec for the cases we care about (we never publish
 * prereleases of ringly, so this is defensive — not the full semver
 * comparison algorithm).
 */
export function compareSemver(a: string, b: string): number {
  const [coreA, preA] = a.split("-", 2);
  const [coreB, preB] = b.split("-", 2);
  const partsA = (coreA ?? "0.0.0").split(".").map((n) => Number.parseInt(n, 10));
  const partsB = (coreB ?? "0.0.0").split(".").map((n) => Number.parseInt(n, 10));

  for (let i = 0; i < 3; i++) {
    const ai = partsA[i] ?? 0;
    const bi = partsB[i] ?? 0;
    if (ai !== bi) return ai - bi;
  }

  if (preA && !preB) return -1;
  if (!preA && preB) return 1;
  if (preA && preB) return preA.localeCompare(preB);
  return 0;
}

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

export function isValidSemver(value: string): boolean {
  return SEMVER_PATTERN.test(value);
}

function isValidPackageName(value: string): boolean {
  return PACKAGE_NAME_PATTERN.test(value);
}
