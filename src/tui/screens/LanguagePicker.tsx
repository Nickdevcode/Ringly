import { Box } from "ink";
import SelectInput from "ink-select-input";
import type { FC } from "react";
import type { LanguageSetting } from "../../core/types.js";
import { Footer } from "../components/Footer.js";
import { Header } from "../components/Header.js";

export interface LanguagePickerProps {
  onSelect: (language: LanguageSetting) => void;
}

interface Item {
  label: string;
  value: LanguageSetting;
  key: string;
}

export const LanguagePicker: FC<LanguagePickerProps> = ({ onSelect }) => {
  const items: Item[] = [
    { label: "🌐  Auto  —  follow system locale", value: "auto", key: "auto" },
    { label: "🇧🇷  Português  (pt-BR)", value: "pt-BR", key: "pt" },
    { label: "🇺🇸  English  (en-US)", value: "en-US", key: "en" },
  ];

  return (
    <Box flexDirection="column">
      <Header
        step={1}
        totalSteps={4}
        title="Notification language"
        subtitle="Pick the language used in toast titles and bodies."
      />

      <Box paddingLeft={2}>
        <SelectInput items={items} onSelect={(item) => onSelect(item.value)} />
      </Box>

      <Footer
        hints={[
          { key: "↑/↓", label: "move" },
          { key: "Enter", label: "select" },
        ]}
      />
    </Box>
  );
};
