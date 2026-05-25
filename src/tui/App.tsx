import { Box, useApp } from "ink";
import { type FC, useCallback, useState } from "react";
import type { LanguageSetting, RinglyConfig } from "../core/types.js";
import type { RegisterAumidResult } from "../platform/windows/aumid.js";
import { AumidRegister } from "./screens/AumidRegister.js";
import { Done } from "./screens/Done.js";
import { type EventToggles, HookPicker } from "./screens/HookPicker.js";
import { LanguagePicker } from "./screens/LanguagePicker.js";
import { SoundDebugPicker, type SoundDebugValues } from "./screens/SoundDebugPicker.js";
import { Welcome } from "./screens/Welcome.js";

type Stage = "welcome" | "language" | "events" | "sound" | "aumid" | "done";

export interface AppProps {
  initialConfig: RinglyConfig;
  isWindows: boolean;
  registerAumidFn?: ((appId: string) => Promise<RegisterAumidResult>) | undefined;
  onComplete: (config: RinglyConfig, aumid: RegisterAumidResult | null) => Promise<void> | void;
  marketplaceCommand: string;
  installCommand: string;
}

export const App: FC<AppProps> = ({
  initialConfig,
  isWindows,
  registerAumidFn,
  onComplete,
  marketplaceCommand,
  installCommand,
}) => {
  const { exit } = useApp();
  const [stage, setStage] = useState<Stage>("welcome");
  const [language, setLanguage] = useState<LanguageSetting>(initialConfig.language);
  const [events, setEvents] = useState<EventToggles>(initialConfig.events);
  const [soundDebug, setSoundDebug] = useState<SoundDebugValues>({
    sound: initialConfig.sound,
    debug: initialConfig.debug,
  });
  const [, setAumid] = useState<RegisterAumidResult | null>(null);

  const finish = useCallback(
    async (aumidResult: RegisterAumidResult | null) => {
      const nextConfig: RinglyConfig = {
        ...initialConfig,
        language,
        events,
        sound: soundDebug.sound,
        debug: soundDebug.debug,
      };
      await onComplete(nextConfig, aumidResult);
      setStage("done");
    },
    [initialConfig, language, events, soundDebug, onComplete],
  );

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {stage === "welcome" && <Welcome onContinue={() => setStage("language")} />}
      {stage === "language" && (
        <LanguagePicker
          onSelect={(value) => {
            setLanguage(value);
            setStage("events");
          }}
        />
      )}
      {stage === "events" && (
        <HookPicker
          initial={events}
          onSubmit={(values) => {
            setEvents(values);
            setStage("sound");
          }}
        />
      )}
      {stage === "sound" && (
        <SoundDebugPicker
          initial={soundDebug}
          onSubmit={(values) => {
            setSoundDebug(values);
            if (isWindows && registerAumidFn) setStage("aumid");
            else finish(null).catch(() => exit());
          }}
        />
      )}
      {stage === "aumid" && registerAumidFn && (
        <AumidRegister
          registerFn={registerAumidFn}
          onDone={(result) => {
            setAumid(result);
            finish(result).catch(() => exit());
          }}
        />
      )}
      {stage === "done" && (
        <Done marketplaceCommand={marketplaceCommand} installCommand={installCommand} />
      )}
    </Box>
  );
};

export type AppCompletion = (
  config: RinglyConfig,
  aumid: RegisterAumidResult | null,
) => Promise<void> | void;
