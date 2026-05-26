/**
 * SessionStart hook: runs once per session, throttled to one network
 * check per 24h. When a newer version is on npm, fires a native toast
 * through the same channel infrastructure the regular notification hooks
 * use — so the user sees the same "Ringly" toast they're already wired
 * to react to. Everything is fail-silent: the SessionStart hook must
 * never delay or break the start of a Claude Code session.
 */
import envPaths from "env-paths";
import { buildDefaultChannels, dispatchToChannels } from "../channels/index.js";
import { applyEnvOverrides, DEFAULT_CONFIG, loadConfig } from "../core/config.js";
import { logger } from "../core/logger.js";
import { readOwnVersion } from "../core/ownVersion.js";
import { createTranslator } from "../core/translator.js";
import type { NotificationIntent, RinglyConfig } from "../core/types.js";
import {
  checkForUpdate,
  readLastCheckRecord,
  recordCheck,
  shouldCheckUpdate,
} from "../core/updateCheck.js";

const PACKAGE_NAME = "ringly";
const CHECK_TIMEOUT_MS = 3000;

export async function runUpdateCheckHook(): Promise<void> {
  try {
    const baseConfig = (() => {
      try {
        return loadConfig();
      } catch {
        return { ...DEFAULT_CONFIG };
      }
    })();
    const config = applyEnvOverrides(baseConfig);

    if (!config.checkUpdates) {
      logger.debug("Update check disabled by config; skipping");
      return;
    }

    const dataDir = resolveDataDir();
    const lastCheck = readLastCheckRecord(dataDir);
    if (!shouldCheckUpdate(lastCheck?.lastCheckIso)) {
      logger.debug("Update check throttled (< 24h since last check)", {
        lastCheckIso: lastCheck?.lastCheckIso,
      });
      return;
    }

    const currentVersion = readOwnVersion(import.meta.url);
    if (currentVersion === "0.0.0") {
      logger.debug("Could not resolve current Ringly version; skipping update check");
      return;
    }

    const result = await checkForUpdate({
      packageName: PACKAGE_NAME,
      currentVersion,
      timeoutMs: CHECK_TIMEOUT_MS,
    });

    // Persist the timestamp even on null/no-update to avoid hammering
    // npm when offline. Next session will retry after 24h.
    recordCheck(dataDir);

    if (!result?.hasUpdate) {
      logger.debug("Update check completed, no update", {
        current: currentVersion,
        result,
      });
      return;
    }

    await fireUpdateToast(config, result.currentVersion, result.latestVersion);
    logger.info("Update toast dispatched", {
      current: result.currentVersion,
      latest: result.latestVersion,
    });
  } catch (err) {
    logger.error("SessionStart update check failed (suppressed)", {
      message: (err as Error).message,
    });
  }
}

async function fireUpdateToast(
  config: RinglyConfig,
  currentVersion: string,
  latestVersion: string,
): Promise<void> {
  const translator = createTranslator(config.language);
  const intent: NotificationIntent = {
    event: "Notification",
    title: "Ringly",
    body: translator.t("cli.update.toast_body", {
      current: currentVersion,
      latest: latestVersion,
    }),
    severity: "info",
    projectName: null,
    sound: config.sound,
    soundName: config.sound ? "Notification.Default" : "silent",
  };

  const channels = buildDefaultChannels({ appId: config.appId });
  await dispatchToChannels(intent, channels);
}

/**
 * Resolves the directory where the throttle timestamp lives. Prefers
 * `${CLAUDE_PLUGIN_DATA}` (the persistent data dir Claude Code injects
 * for plugins — same convention the logger already uses) and falls
 * back to the env-paths default for standalone CLI usage.
 */
function resolveDataDir(): string {
  const pluginData = process.env["CLAUDE_PLUGIN_DATA"];
  if (pluginData && pluginData.trim().length > 0) return pluginData;
  return envPaths("ringly", { suffix: "" }).data;
}
