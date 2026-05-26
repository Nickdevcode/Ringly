import { describe, expect, it, vi } from "vitest";
import { dispatchToChannels } from "../src/channels/index.js";
import type { NotificationChannel, NotificationIntent } from "../src/core/types.js";

const baseIntent: NotificationIntent = {
  event: "Stop",
  title: "Test",
  body: "Test body",
  severity: "info",
  projectName: null,
  sound: false,
  soundName: "silent",
};

describe("dispatchToChannels", () => {
  it("invokes send() only when isAvailable() is true", async () => {
    const sendAvailable = vi.fn().mockResolvedValue(undefined);
    const sendUnavailable = vi.fn().mockResolvedValue(undefined);

    const channels: NotificationChannel[] = [
      {
        name: "available",
        isAvailable: async () => true,
        send: sendAvailable,
      },
      {
        name: "unavailable",
        isAvailable: async () => false,
        send: sendUnavailable,
      },
    ];

    await dispatchToChannels(baseIntent, channels);

    expect(sendAvailable).toHaveBeenCalledOnce();
    expect(sendUnavailable).not.toHaveBeenCalled();
  });

  it("does not abort other channels when one throws", async () => {
    const goodSend = vi.fn().mockResolvedValue(undefined);
    const badSend = vi.fn().mockRejectedValue(new Error("boom"));

    const channels: NotificationChannel[] = [
      { name: "bad", isAvailable: async () => true, send: badSend },
      { name: "good", isAvailable: async () => true, send: goodSend },
    ];

    await expect(dispatchToChannels(baseIntent, channels)).resolves.toBeUndefined();
    expect(badSend).toHaveBeenCalledOnce();
    expect(goodSend).toHaveBeenCalledOnce();
  });

  it("handles isAvailable rejection gracefully", async () => {
    const send = vi.fn();
    const channels: NotificationChannel[] = [
      {
        name: "rejects",
        isAvailable: async () => {
          throw new Error("availability check failed");
        },
        send,
      },
    ];

    await expect(dispatchToChannels(baseIntent, channels)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it("resolves with empty channels list", async () => {
    await expect(dispatchToChannels(baseIntent, [])).resolves.toBeUndefined();
  });
});
