import { Box, Text } from "ink";
import type { FC } from "react";
import type { Translator } from "../../core/translator.js";

export interface DoneProps {
  translator: Translator;
  marketplaceCommand: string;
  installCommand: string;
}

export const Done: FC<DoneProps> = ({ translator, marketplaceCommand, installCommand }) => {
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
          ✓ {translator.t("tui.done.ready")}
        </Text>
      </Box>

      <Box flexDirection="column" paddingLeft={2} gap={1}>
        <Text>
          <Text color="yellow" bold>
            {translator.t("tui.done.final_step")}
          </Text>{" "}
          {translator.t("tui.done.final_step_body")}
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
        <Text dimColor>{translator.t("tui.done.useful_commands")}</Text>
        <Box flexDirection="row" gap={2} marginTop={0}>
          <Text>
            <Text color="cyan">ringly doctor</Text>
            <Text dimColor> {translator.t("tui.done.cmd_doctor")}</Text>
          </Text>
        </Box>
        <Box flexDirection="row" gap={2}>
          <Text>
            <Text color="cyan">ringly config</Text>
            <Text dimColor> {translator.t("tui.done.cmd_config")}</Text>
          </Text>
        </Box>
        <Box flexDirection="row" gap={2}>
          <Text>
            <Text color="cyan">ringly test</Text>
            <Text dimColor> {translator.t("tui.done.cmd_test")}</Text>
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
