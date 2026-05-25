import { Box } from "ink";
import SelectInput from "ink-select-input";
import type { FC } from "react";
import type { Translator } from "../../core/translator.js";
import type { LanguageSetting } from "../../core/types.js";
import { Footer } from "../components/Footer.js";
import { Header } from "../components/Header.js";

export interface LanguagePickerProps {
  translator: Translator;
  onSelect: (language: LanguageSetting) => void;
}

interface Item {
  label: string;
  value: LanguageSetting;
  key: string;
}

export const LanguagePicker: FC<LanguagePickerProps> = ({ translator, onSelect }) => {
  const items: Item[] = [
    { label: `🌐  ${translator.t("tui.language.option.auto")}`, value: "auto", key: "auto" },
    { label: `🇧🇷  ${translator.t("tui.language.option.ptbr")}`, value: "pt-BR", key: "pt" },
    { label: `🇺🇸  ${translator.t("tui.language.option.enus")}`, value: "en-US", key: "en" },
  ];

  return (
    <Box flexDirection="column">
      <Header
        translator={translator}
        step={1}
        totalSteps={4}
        title={translator.t("tui.language.title")}
        subtitle={translator.t("tui.language.subtitle")}
      />

      <Box paddingLeft={2}>
        <SelectInput items={items} onSelect={(item) => onSelect(item.value)} />
      </Box>

      <Footer
        hints={[
          { key: "↑/↓", label: translator.t("tui.footer.move") },
          { key: "Enter", label: translator.t("tui.footer.select") },
        ]}
      />
    </Box>
  );
};
