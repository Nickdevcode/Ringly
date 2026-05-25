import { Box, Text } from "ink";
import type { FC } from "react";

export interface DoneProps {
  marketplaceCommand: string;
  installCommand: string;
}

export const Done: FC<DoneProps> = ({ marketplaceCommand, installCommand }) => {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="green">
        ✓ Ringly is ready
      </Text>
      <Text>Final step: register the plugin inside Claude Code:</Text>
      <Text> </Text>
      <Text>
        <Text color="cyan">{marketplaceCommand}</Text>
      </Text>
      <Text>
        <Text color="cyan">{installCommand}</Text>
      </Text>
      <Text> </Text>
      <Text dimColor>
        Need to verify the setup? Run <Text color="cyan">ringly doctor</Text>.
      </Text>
      <Text dimColor>
        Want to change settings? Run <Text color="cyan">ringly config</Text> or edit
      </Text>
      <Text dimColor>them in the Claude Code plugin manager (userConfig).</Text>
    </Box>
  );
};
