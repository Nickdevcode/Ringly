import { logger } from "../core/logger.js";
import type { NotificationChannel, NotificationIntent } from "../core/types.js";
import { createToastChannel } from "./toast.js";

export interface ChannelRegistryOptions {
  appId?: string;
}

export function buildDefaultChannels(options: ChannelRegistryOptions = {}): NotificationChannel[] {
  return [createToastChannel({ ...(options.appId ? { appId: options.appId } : {}) })];
}

export async function dispatchToChannels(
  intent: NotificationIntent,
  channels: NotificationChannel[],
): Promise<void> {
  await Promise.all(
    channels.map(async (channel) => {
      try {
        if (!(await channel.isAvailable())) {
          logger.debug("Channel not available; skipping", { channel: channel.name });
          return;
        }
        await channel.send(intent);
      } catch (err) {
        logger.error("Channel dispatch failed", {
          channel: channel.name,
          message: (err as Error).message,
        });
      }
    }),
  );
}
