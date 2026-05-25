import { Box, Text } from "ink";
import type { FC } from "react";

export interface ConfigDoneProps {
  settingsFile: string;
}

export const ConfigDone: FC<ConfigDoneProps> = ({ settingsFile }) => {
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
          ✓ Configuration saved
        </Text>
      </Box>

      <Box flexDirection="column" paddingLeft={2} gap={1}>
        <Text>
          Written to <Text dimColor>{settingsFile || "~/.claude/settings.json"}</Text>
        </Text>
        <Text dimColor>A timestamped backup of the previous file was created next to it.</Text>
      </Box>

      <Box
        borderStyle="round"
        borderColor="yellow"
        paddingX={2}
        paddingY={0}
        flexDirection="column"
      >
        <Text bold color="yellow">
          ⚠ Reload required
        </Text>
        <Text>
          Run <Text color="cyan">/reload-plugins</Text> inside Claude Code so the new
        </Text>
        <Text>settings take effect immediately.</Text>
      </Box>

      <Box flexDirection="column" paddingLeft={2}>
        <Text dimColor>You can also change these settings any time via:</Text>
        <Text>
          {" "}
          <Text color="cyan">/plugin</Text>
          <Text dimColor> → Installed → Ringly → Configure</Text>
        </Text>
      </Box>
    </Box>
  );
};
