import { Box, Text } from "ink";
import type { FC } from "react";
import type { Translator } from "../../core/translator.js";

export interface ConfigDoneProps {
  translator: Translator;
  settingsFile: string;
}

export const ConfigDone: FC<ConfigDoneProps> = ({ translator, settingsFile }) => {
  const reloadFirst = translator
    .t("tui.config.reload_body", { command: "__CMD__" })
    .split("__CMD__");

  const cliOnlyBody = translator
    .t("tui.config.cli_only_body", {
      plugin: "__PLUGIN__",
      command: "__CMD__",
    })
    .split(/__PLUGIN__|__CMD__/);

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
          ✓ {translator.t("tui.config.saved")}
        </Text>
      </Box>

      <Box flexDirection="column" paddingLeft={2} gap={1}>
        <Text>
          {translator.t("tui.config.written_to")}{" "}
          <Text dimColor>{settingsFile || "~/.claude/settings.json"}</Text>
        </Text>
        <Text dimColor>{translator.t("tui.config.backup_created")}</Text>
      </Box>

      <Box
        borderStyle="round"
        borderColor="yellow"
        paddingX={2}
        paddingY={0}
        flexDirection="column"
      >
        <Text bold color="yellow">
          ⚠ {translator.t("tui.config.reload_required")}
        </Text>
        <Text>
          {reloadFirst[0]}
          <Text color="cyan">/reload-plugins</Text>
          {reloadFirst[1] ?? ""}
        </Text>
        <Text>{translator.t("tui.config.reload_body2")}</Text>
      </Box>

      <Box borderStyle="single" borderColor="gray" paddingX={2} paddingY={0} flexDirection="column">
        <Text bold dimColor>
          {translator.t("tui.config.cli_only_title")}
        </Text>
        <Text dimColor>
          {cliOnlyBody[0]}
          <Text color="cyan">/plugin</Text>
          {cliOnlyBody[1] ?? ""}
          <Text color="cyan">ringly config</Text>
          {cliOnlyBody[2] ?? ""}
        </Text>
      </Box>
    </Box>
  );
};
