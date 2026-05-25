import { Box, Text, useInput } from "ink";
import type { FC } from "react";
import type { Translator } from "../../core/translator.js";
import { Footer } from "../components/Footer.js";

export interface WelcomeProps {
  translator: Translator;
  onContinue: () => void;
}

const BANNER = [
  "  ____  _             _       ",
  " |  _ \\(_)_ __   __ _| |_   _ ",
  " | |_) | | '_ \\ / _` | | | | |",
  " |  _ <| | | | | (_| | | |_| |",
  " |_| \\_\\_|_| |_|\\__, |_|\\__, |",
  "                |___/   |___/ ",
];

export const Welcome: FC<WelcomeProps> = ({ translator, onContinue }) => {
  useInput((_, key) => {
    if (key.return || key.rightArrow) onContinue();
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column" alignItems="flex-start">
        {BANNER.map((line, idx) => (
          <Text key={idx.toString()} color="cyan" bold>
            {line}
          </Text>
        ))}
      </Box>

      <Box
        borderStyle="round"
        borderColor="cyan"
        flexDirection="column"
        paddingX={2}
        paddingY={1}
        gap={1}
      >
        <Text bold>{translator.t("tui.welcome.title")}</Text>
        <Text>{translator.t("tui.welcome.tagline", { target: "Claude Code" })}</Text>
        <Box flexDirection="column">
          <Text dimColor>{translator.t("tui.welcome.steps_intro", { count: 4 })}</Text>
          <Text dimColor> {translator.t("tui.welcome.step1")}</Text>
          <Text dimColor> {translator.t("tui.welcome.step2")}</Text>
          <Text dimColor> {translator.t("tui.welcome.step3")}</Text>
          <Text dimColor> {translator.t("tui.welcome.step4")}</Text>
        </Box>
      </Box>

      <Footer
        hints={[
          { key: "Enter", label: translator.t("tui.footer.continue") },
          { key: "Ctrl+C", label: translator.t("tui.footer.cancel") },
        ]}
      />
    </Box>
  );
};
