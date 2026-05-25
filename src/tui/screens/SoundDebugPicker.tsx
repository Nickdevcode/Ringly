import { Box, Text, useInput } from "ink";
import { type FC, useState } from "react";
import type { Translator } from "../../core/translator.js";
import { Footer } from "../components/Footer.js";
import { Header } from "../components/Header.js";

export interface SoundDebugValues {
  sound: boolean;
  debug: boolean;
}

export interface SoundDebugPickerProps {
  translator: Translator;
  initial: SoundDebugValues;
  onSubmit: (values: SoundDebugValues) => void;
}

interface Field {
  key: keyof SoundDebugValues;
  icon: string;
  labelKey: string;
  descKey: string;
}

const FIELDS: readonly Field[] = [
  {
    key: "sound",
    icon: "🔊",
    labelKey: "tui.sound.sound.label",
    descKey: "tui.sound.sound.desc",
  },
  {
    key: "debug",
    icon: "🪵",
    labelKey: "tui.sound.debug.label",
    descKey: "tui.sound.debug.desc",
  },
];

export const SoundDebugPicker: FC<SoundDebugPickerProps> = ({ translator, initial, onSubmit }) => {
  const [values, setValues] = useState<SoundDebugValues>(initial);
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) setCursor((c) => (c <= 0 ? FIELDS.length - 1 : c - 1));
    else if (key.downArrow) setCursor((c) => (c >= FIELDS.length - 1 ? 0 : c + 1));
    else if (input === " ") {
      const field = FIELDS[cursor];
      if (!field) return;
      setValues((prev) => ({ ...prev, [field.key]: !prev[field.key] }));
    } else if (key.return) onSubmit(values);
  });

  return (
    <Box flexDirection="column">
      <Header
        translator={translator}
        step={3}
        totalSteps={4}
        title={translator.t("tui.sound.title")}
        subtitle={translator.t("tui.sound.subtitle")}
      />

      <Box flexDirection="column" paddingLeft={2}>
        {FIELDS.map((field, idx) => {
          const active = idx === cursor;
          const checked = values[field.key];
          const checkbox = checked ? "◉" : "◯";
          const checkboxColor = checked ? "green" : "gray";
          const cursorMark = active ? "›" : " ";
          const label = translator.t(field.labelKey);
          const description = translator.t(field.descKey);

          return (
            <Box key={field.key} flexDirection="row" gap={1}>
              {active ? (
                <Text bold color="cyan">
                  {cursorMark}
                </Text>
              ) : (
                <Text bold>{cursorMark}</Text>
              )}
              <Text color={checkboxColor}>{checkbox}</Text>
              <Text>{field.icon}</Text>
              {active ? (
                <Text bold color="cyan">
                  {label}
                </Text>
              ) : (
                <Text>{label}</Text>
              )}
              <Text dimColor>— {description}</Text>
            </Box>
          );
        })}
      </Box>

      <Footer
        hints={[
          { key: "↑/↓", label: translator.t("tui.footer.move") },
          { key: "Space", label: translator.t("tui.footer.toggle") },
          { key: "Enter", label: translator.t("tui.footer.confirm") },
        ]}
      />
    </Box>
  );
};
