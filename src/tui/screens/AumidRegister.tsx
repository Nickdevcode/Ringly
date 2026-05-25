import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { type FC, useEffect, useState } from "react";
import { DEFAULT_APP_ID } from "../../core/types.js";
import type { RegisterAumidResult } from "../../platform/windows/aumid.js";
import { Header } from "../components/Header.js";

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
        setTimeout(() => onDone(r), 300);
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
        setTimeout(() => onDone(failure), 300);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appId, registerFn, onDone]);

  return (
    <Box flexDirection="column">
      <Header
        step={4}
        totalSteps={4}
        title="Register Windows integration"
        subtitle="Creating Start Menu shortcut and AUMID for Windows toasts."
      />

      <Box paddingLeft={2} flexDirection="column" gap={1}>
        {stage === "running" && (
          <Box flexDirection="row" gap={1}>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text>Setting up Windows integration…</Text>
          </Box>
        )}

        {stage === "done" && result && (
          <Box flexDirection="column" gap={0}>
            <Box flexDirection="row" gap={1}>
              <Text color="green" bold>
                ✓
              </Text>
              <Text bold color="green">
                Windows integration ready
              </Text>
            </Box>
            {result.skipped && (
              <Box paddingLeft={2}>
                <Text dimColor>(already registered, no changes needed)</Text>
              </Box>
            )}
            {result.notifierSetting && (
              <Box paddingLeft={2}>
                <Text dimColor>Notification setting: </Text>
                <Text color="yellow">{result.notifierSetting}</Text>
              </Box>
            )}
          </Box>
        )}

        {stage === "error" && result && (
          <Box flexDirection="column">
            <Box flexDirection="row" gap={1}>
              <Text color="red" bold>
                ✗
              </Text>
              <Text bold color="red">
                Registration failed
              </Text>
            </Box>
            <Box paddingLeft={2}>
              <Text dimColor>{result.reason ?? "unknown error"}</Text>
            </Box>
            <Box paddingLeft={2} marginTop={1}>
              <Text dimColor>
                Try <Text color="cyan">ringly init --force</Text> after fixing the issue.
              </Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
