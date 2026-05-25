import { Box, Text } from "ink";
import type { FC } from "react";
import type { Translator } from "../../core/translator.js";

export interface HeaderProps {
  translator?: Translator;
  step?: number;
  totalSteps?: number;
  title: string;
  subtitle?: string;
}

export const Header: FC<HeaderProps> = ({ translator, step, totalSteps, title, subtitle }) => {
  const stepLabel =
    step && totalSteps
      ? translator
        ? translator.t("tui.header.step", { step, total: totalSteps })
        : `Step ${step}/${totalSteps}`
      : null;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        paddingY={0}
        flexDirection="row"
        gap={1}
      >
        <Text bold color="cyan">
          ◉ Ringly
        </Text>
        {stepLabel && (
          <>
            <Text dimColor>·</Text>
            <Text color="yellow">{stepLabel}</Text>
          </>
        )}
        <Text dimColor>·</Text>
        <Text bold>{title}</Text>
      </Box>
      {subtitle && (
        <Box paddingLeft={2}>
          <Text dimColor>{subtitle}</Text>
        </Box>
      )}
    </Box>
  );
};
