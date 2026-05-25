import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { FC } from "react";
import type { LanguageSetting } from "../../core/types.js";

export interface LanguagePickerProps {
  onSelect: (language: LanguageSetting) => void;
}

export const LanguagePicker: FC<LanguagePickerProps> = ({ onSelect }) => {
  const items: { label: string; value: LanguageSetting }[] = [
    { label: "Auto (follow system locale)", value: "auto" },
    { label: "Português (pt-BR)", value: "pt-BR" },
    { label: "English (en-US)", value: "en-US" },
  ];

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Step 1 / 4 — Notification language</Text>
      <SelectInput items={items} onSelect={(item) => onSelect(item.value)} />
    </Box>
  );
};
