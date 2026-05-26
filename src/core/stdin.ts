export interface ReadStdinOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

export async function readStdin(options: ReadStdinOptions = {}): Promise<string> {
  const { timeoutMs = 4000, maxBytes = 256 * 1024 } = options;

  if (process.stdin.isTTY) return "";

  return await new Promise<string>((resolve) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let settled = false;

    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.removeAllListeners("data");
      process.stdin.removeAllListeners("end");
      process.stdin.removeAllListeners("error");
      resolve(value);
    };

    const timer = setTimeout(() => {
      finish(Buffer.concat(chunks).toString("utf8"));
    }, timeoutMs);

    process.stdin.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxBytes) {
        finish("");
        return;
      }
      chunks.push(chunk);
    });

    process.stdin.on("end", () => {
      finish(Buffer.concat(chunks).toString("utf8"));
    });

    process.stdin.on("error", () => finish(""));
  });
}

export function tryParseJson<T = unknown>(raw: string): T | null {
  if (!raw || raw.trim().length === 0) return null;
  try {
    const trimmed = raw.replace(/^﻿/, "").trim();
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}
