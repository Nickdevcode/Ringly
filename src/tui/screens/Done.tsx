import { Box, Text } from "ink";
import type { FC } from "react";

export interface DoneProps {
  marketplaceCommand: string;
  installCommand: string;
}

export const Done: FC<DoneProps> = ({ marketplaceCommand, installCommand }) => {
  return (
    <Box flexDirection="column" gap={1}>
      <Box
        borderStyle="round"
        borderColor="green"
        paddingX={2}
        paddingY={0}
        flexDirection="row"
        gap={1}
      >
        <Text bold color="green">
          ✓ Ringly is ready
        </Text>
      </Box>

      <Box flexDirection="column" paddingLeft={2} gap={1}>
        <Text>
          <Text color="yellow" bold>
            Final step:
          </Text>{" "}
          register the plugin inside Claude Code.
        </Text>

        <Box flexDirection="column" gap={0} paddingLeft={2}>
          <Text dimColor>1.</Text>
          <Box paddingLeft={2}>
            <Text color="cyan">{marketplaceCommand}</Text>
          </Box>
          <Text dimColor>2.</Text>
          <Box paddingLeft={2}>
            <Text color="cyan">{installCommand}</Text>
          </Box>
        </Box>
      </Box>

      <Box
        borderStyle="single"
        borderColor="gray"
        paddingX={2}
        paddingY={0}
        flexDirection="column"
        marginTop={1}
      >
        <Text dimColor>Useful commands:</Text>
        <Box flexDirection="row" gap={2} marginTop={0}>
          <Text>
            <Text color="cyan">ringly doctor</Text>
            <Text dimColor> verify the setup</Text>
          </Text>
        </Box>
        <Box flexDirection="row" gap={2}>
          <Text>
            <Text color="cyan">ringly config</Text>
            <Text dimColor> change settings</Text>
          </Text>
        </Box>
        <Box flexDirection="row" gap={2}>
          <Text>
            <Text color="cyan">ringly test</Text>
            <Text dimColor> fire a sample notification</Text>
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
