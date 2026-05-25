import { logger } from "../../core/logger.js";
import type { ToastOptions } from "../../core/types.js";
import type { SendToastResult } from "../windows/toast.js";

export async function sendLinuxToast(_options: ToastOptions): Promise<SendToastResult> {
  logger.warn("Linux toast not implemented yet; planned for a future release");
  return { delivered: false, blocked: false, reason: "platform_not_implemented" };
}
