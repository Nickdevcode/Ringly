import { spawn } from "node:child_process";
import { logger } from "../../core/logger.js";

export interface RunPowerShellOptions {
  script: string;
  timeoutMs?: number;
}

export interface PowerShellResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

export function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

export function resolvePowerShellExecutable(): string {
  if (process.env["RINGLY_USE_PWSH"] === "1") return "pwsh.exe";
  return "powershell.exe";
}

export async function runPowerShell(options: RunPowerShellOptions): Promise<PowerShellResult> {
  const { script, timeoutMs = 8000 } = options;
  const encoded = encodePowerShellCommand(script);
  const exe = resolvePowerShellExecutable();

  return await new Promise<PowerShellResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const child = spawn(
      exe,
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      logger.error("PowerShell spawn error", { message: err.message });
      resolve({ ok: false, stdout, stderr: stderr || err.message, code: null, timedOut });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timedOut && (code === 0 || code === null),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code,
        timedOut,
      });
    });
  });
}
