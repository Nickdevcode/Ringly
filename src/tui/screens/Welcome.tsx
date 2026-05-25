import { Box, Text, useInput } from "ink";
import type { FC } from "react";
import { Footer } from "../components/Footer.js";

export interface WelcomeProps {
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

export const Welcome: FC<WelcomeProps> = ({ onContinue }) => {
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
        <Text bold>Welcome to Ringly</Text>
        <Text>
          Native cross-platform notifications for <Text color="cyan">Claude Code</Text>.
        </Text>
        <Box flexDirection="column">
          <Text dimColor>
            We'll guide you through <Text bold>4 quick steps</Text>:
          </Text>
          <Text dimColor> 1 · Choose your notification language</Text>
          <Text dimColor> 2 · Pick which events should notify you</Text>
          <Text dimColor> 3 · Sound & debug preferences</Text>
          <Text dimColor> 4 · Register the Windows integration</Text>
        </Box>
      </Box>

      <Footer
        hints={[
          { key: "Enter", label: "continue" },
          { key: "Ctrl+C", label: "cancel" },
        ]}
      />
    </Box>
  );
};
