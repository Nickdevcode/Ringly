import { Box, Text } from "ink";
import type { FC } from "react";

export interface HeaderProps {
  step?: number;
  totalSteps?: number;
  title: string;
  subtitle?: string;
}

export const Header: FC<HeaderProps> = ({ step, totalSteps, title, subtitle }) => {
  const stepLabel = step && totalSteps ? `Step ${step}/${totalSteps}` : null;

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
