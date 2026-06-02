import { logger } from "../core/logger.js";
import type {
  NotificationChannel,
  NotificationIntent,
  ToastOptions,
  ToastSoundName,
} from "../core/types.js";
import { DEFAULT_APP_ID } from "../core/types.js";
import { detectPlatform } from "../platform/index.js";
import { sendLinuxToast } from "../platform/linux/toast.js";
import { sendMacOSToast } from "../platform/macos/toast.js";
import { resolveIconPath } from "../platform/windows/icon.js";
import { sendWindowsToast } from "../platform/windows/toast.js";

export interface ToastChannelOptions {
  appId?: string;
  forceSilent?: boolean;
}

export function createToastChannel(options: ToastChannelOptions = {}): NotificationChannel {
  const appId = options.appId ?? DEFAULT_APP_ID;
  const silent = options.forceSilent ?? false;

  return {
    name: "toast",
    async isAvailable() {
      const platform = detectPlatform();
      return platform === "windows" || platform === "macos" || platform === "linux";
    },
    async send(intent: NotificationIntent) {
      const sound: ToastSoundName = silent || !intent.sound ? "silent" : intent.soundName;
      const platform = detectPlatform();

      const toastOptions: ToastOptions = {
        appId,
        title: intent.title,
        body: intent.body,
        sound,
        // Rich-toast fields. Each degrades gracefully when absent: the icon is
        // omitted if the asset is missing; scenario only emits a non-default
        // attribute; displayTimestamp stamps "now" (resolved here, not in the
        // pure mapper). No ToastHeader — it duplicated the title and added
        // visual noise; grouping is left to the OS default.
        iconPath: resolveIconPath(),
        scenario: intent.scenario,
        displayTimestamp: new Date().toISOString(),
      };

      logger.debug("Dispatch toast", { platform, event: intent.event, title: intent.title });

      switch (platform) {
        case "windows":
          await sendWindowsToast(toastOptions);
          return;
        case "macos":
          await sendMacOSToast(toastOptions);
          return;
        case "linux":
          await sendLinuxToast(toastOptions);
          return;
        default:
          logger.warn("Unsupported platform for toast", { platform });
      }
    },
  };
}
