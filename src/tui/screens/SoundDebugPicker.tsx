import { Box, Text, useInput } from "ink";
import { type FC, useState } from "react";
import { Footer } from "../components/Footer.js";
import { Header } from "../components/Header.js";

export interface SoundDebugValues {
  sound: boolean;
  debug: boolean;
}

export interface SoundDebugPickerProps {
  initial: SoundDebugValues;
  onSubmit: (values: SoundDebugValues) => void;
}

interface Field {
  key: keyof SoundDebugValues;
  icon: string;
  label: string;
  description: string;
}

const FIELDS: readonly Field[] = [
  {
    key: "sound",
    icon: "🔊",
    label: "Play notification sounds",
    description: "Plays the OS toast sound on every event",
  },
  {
    key: "debug",
    icon: "🪵",
    label: "Write debug logs",
    description: "Verbose log file (rotated by size)",
  },
];

export const SoundDebugPicker: FC<SoundDebugPickerProps> = ({ initial, onSubmit }) => {
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
        step={3}
        totalSteps={4}
        title="Sound and logging"
        subtitle="Toggle sound and verbose logging."
      />

      <Box flexDirection="column" paddingLeft={2}>
        {FIELDS.map((field, idx) => {
          const active = idx === cursor;
          const checked = values[field.key];
          const checkbox = checked ? "◉" : "◯";
          const checkboxColor = checked ? "green" : "gray";
          const cursorMark = active ? "›" : " ";

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
                  {field.label}
                </Text>
              ) : (
                <Text>{field.label}</Text>
              )}
              <Text dimColor>— {field.description}</Text>
            </Box>
          );
        })}
      </Box>

      <Footer
        hints={[
          { key: "↑/↓", label: "move" },
          { key: "Space", label: "toggle" },
          { key: "Enter", label: "confirm" },
        ]}
      />
    </Box>
  );
};
