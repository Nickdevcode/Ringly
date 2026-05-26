import { logger } from "../../core/logger.js";
import type { ToastOptions } from "../../core/types.js";
import type { SendToastResult } from "../windows/toast.js";

let warningPrinted = false;

export async function sendMacOSToast(_options: ToastOptions): Promise<SendToastResult> {
  logger.warn("macOS toast not implemented yet; planned for a future release");
  if (!warningPrinted) {
    warningPrinted = true;
    process.stderr.write(
      "[Ringly] macOS toast notifications are not implemented yet. " +
        "Track progress at https://github.com/nickdevcode/Ringly/issues\n",
    );
  }
  return { delivered: false, blocked: false, reason: "platform_not_implemented" };
}
