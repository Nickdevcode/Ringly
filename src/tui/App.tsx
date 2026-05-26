import { Box, useApp } from "ink";
import { type FC, useCallback, useMemo, useState } from "react";
import { createTranslator } from "../core/translator.js";
import type { LanguageSetting, RinglyConfig } from "../core/types.js";
import type { RegisterAumidResult } from "../platform/windows/aumid.js";
import { AumidRegister } from "./screens/AumidRegister.js";
import { ConfigDone } from "./screens/ConfigDone.js";
import { Done } from "./screens/Done.js";
import { type EventToggles, HookPicker } from "./screens/HookPicker.js";
import { LanguagePicker } from "./screens/LanguagePicker.js";
import { SoundDebugPicker, type SoundDebugValues } from "./screens/SoundDebugPicker.js";
import { Welcome } from "./screens/Welcome.js";

type Stage = "welcome" | "language" | "events" | "sound" | "aumid" | "done";

export type AppMode = "init" | "config";

export interface AppProps {
  initialConfig: RinglyConfig;
  isWindows: boolean;
  mode?: AppMode;
  registerAumidFn?: ((appId: string) => Promise<RegisterAumidResult>) | undefined;
  onComplete: (config: RinglyConfig, aumid: RegisterAumidResult | null) => Promise<void> | void;
  marketplaceCommand?: string;
  installCommand?: string;
  settingsFile?: string;
}

export const App: FC<AppProps> = ({
  initialConfig,
  isWindows,
  mode = "init",
  registerAumidFn,
  onComplete,
  marketplaceCommand,
  installCommand,
  settingsFile,
}) => {
  const { exit } = useApp();
  const [stage, setStage] = useState<Stage>(mode === "config" ? "language" : "welcome");

  /**
   * During `init` the TUI always starts in English to present a
   * predictable interface to any user. As soon as they pick a
   * language in `LanguagePicker`, every following screen (events,
   * sound, AUMID, done) reflects that choice in real time.
   *
   * During `config` it makes sense to open in the user's current
   * language, because they are only reconfiguring — not being
   * introduced to Ringly for the first time.
   */
  const [language, setLanguage] = useState<LanguageSetting>(
    mode === "init" ? "en-US" : initialConfig.language,
  );
  const translator = useMemo(() => createTranslator(language), [language]);

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
      {stage === "welcome" && (
        <Welcome translator={translator} onContinue={() => setStage("language")} />
      )}
      {stage === "language" && (
        <LanguagePicker
          translator={translator}
          onSelect={(value) => {
            setLanguage(value);
            setStage("events");
          }}
        />
      )}
      {stage === "events" && (
        <HookPicker
          translator={translator}
          initial={events}
          onSubmit={(values) => {
            setEvents(values);
            setStage("sound");
          }}
        />
      )}
      {stage === "sound" && (
        <SoundDebugPicker
          translator={translator}
          initial={soundDebug}
          onSubmit={(values) => {
            setSoundDebug(values);
            if (mode === "init" && isWindows && registerAumidFn) {
              setStage("aumid");
            } else {
              finish(null).catch(() => exit());
            }
          }}
        />
      )}
      {stage === "aumid" && registerAumidFn && (
        <AumidRegister
          translator={translator}
          registerFn={registerAumidFn}
          onDone={(result) => {
            setAumid(result);
            finish(result).catch(() => exit());
          }}
        />
      )}
      {stage === "done" && mode === "init" && marketplaceCommand && installCommand && (
        <Done
          translator={translator}
          marketplaceCommand={marketplaceCommand}
          installCommand={installCommand}
        />
      )}
      {stage === "done" && mode === "config" && (
        <ConfigDone translator={translator} settingsFile={settingsFile ?? ""} />
      )}
    </Box>
  );
};

export type AppCompletion = (
  config: RinglyConfig,
  aumid: RegisterAumidResult | null,
) => Promise<void> | void;
