import { Box, Text, useInput } from "ink";
import type { FC } from "react";

export interface WelcomeProps {
  onContinue: () => void;
}

export const Welcome: FC<WelcomeProps> = ({ onContinue }) => {
  useInput((_, key) => {
    if (key.return || key.rightArrow) onContinue();
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">
        Ringly
      </Text>
      <Text>Native cross-platform notifications for Claude Code.</Text>
      <Text dimColor>We'll set up four hooks (Notification, Stop, StopFailure, SubagentStop),</Text>
      <Text dimColor>register the Windows integration, and write your config.</Text>
      <Text> </Text>
      <Text>
        Press <Text color="cyan">Enter</Text> to continue or <Text color="cyan">Ctrl+C</Text> to
        cancel.
      </Text>
    </Box>
  );
};
