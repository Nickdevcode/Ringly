import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { type FC, useEffect, useState } from "react";
import { DEFAULT_APP_ID } from "../../core/types.js";
import type { RegisterAumidResult } from "../../platform/windows/aumid.js";

export interface AumidRegisterProps {
  appId?: string;
  registerFn: (appId: string) => Promise<RegisterAumidResult>;
  onDone: (result: RegisterAumidResult) => void;
}

type Stage = "running" | "done" | "error";

export const AumidRegister: FC<AumidRegisterProps> = ({ appId, registerFn, onDone }) => {
  const [stage, setStage] = useState<Stage>("running");
  const [result, setResult] = useState<RegisterAumidResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await registerFn(appId ?? DEFAULT_APP_ID);
        if (cancelled) return;
        setResult(r);
        setStage(r.ok ? "done" : "error");
        setTimeout(() => onDone(r), 600);
      } catch (err) {
        if (cancelled) return;
        const failure: RegisterAumidResult = {
          ok: false,
          notifierSetting: null,
          skipped: false,
          reason: (err as Error).message,
        };
        setResult(failure);
        setStage("error");
        setTimeout(() => onDone(failure), 600);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appId, registerFn, onDone]);

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Step 4 / 4 — Registering Windows integration</Text>
      {stage === "running" && (
        <Box gap={1}>
          <Spinner type="dots" />
          <Text>Creating Start Menu shortcut and AUMID…</Text>
        </Box>
      )}
      {stage === "done" && result && (
        <Box flexDirection="column" gap={0}>
          <Text color="green">✓ Done</Text>
          {result.skipped && <Text dimColor>(already registered, skipped rewrite)</Text>}
          {result.notifierSetting && (
            <Text dimColor>Notification setting: {result.notifierSetting}</Text>
          )}
        </Box>
      )}
      {stage === "error" && result && (
        <Box flexDirection="column">
          <Text color="red">✗ Failed</Text>
          <Text dimColor>{result.reason ?? "unknown error"}</Text>
        </Box>
      )}
    </Box>
  );
};
