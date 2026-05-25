import { Box, Text } from "ink";
import type { FC } from "react";

export interface FooterHint {
  key: string;
  label: string;
}

export interface FooterProps {
  hints: FooterHint[];
}

export const Footer: FC<FooterProps> = ({ hints }) => {
  return (
    <Box marginTop={1} paddingLeft={2}>
      <Text dimColor>
        {hints.map((hint, idx) => (
          <Text key={hint.key}>
            {idx > 0 && <Text dimColor> </Text>}
            <Text color="cyan">{hint.key}</Text>
            <Text dimColor> {hint.label}</Text>
          </Text>
        ))}
      </Text>
    </Box>
  );
};
