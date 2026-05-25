import { Box, Text, useInput } from "ink";
import { type FC, useState } from "react";

export interface SoundDebugValues {
  sound: boolean;
  debug: boolean;
}

export interface SoundDebugPickerProps {
  initial: SoundDebugValues;
  onSubmit: (values: SoundDebugValues) => void;
}

const FIELDS: readonly { key: keyof SoundDebugValues; label: string; description: string }[] = [
  { key: "sound", label: "Play notification sounds", description: "Plays the OS toast sound" },
  { key: "debug", label: "Write debug logs", description: "Verbose log file (rotated by size)" },
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
    <Box flexDirection="column" gap={1}>
      <Text bold>Step 3 / 4 — Sound and logging</Text>
      <Text dimColor>↑/↓ to move · space to toggle · Enter to confirm</Text>
      <Box flexDirection="column" marginTop={1}>
        {FIELDS.map((field, idx) => {
          const active = idx === cursor;
          const checked = values[field.key];
          const icon = checked ? "[x]" : "[ ]";
          const props = active ? { color: "cyan" as const } : {};
          return (
            <Text key={field.key} {...props}>
              {`${active ? "›" : " "} ${icon} ${field.label}  `}
              <Text dimColor>{field.description}</Text>
            </Text>
          );
        })}
      </Box>
    </Box>
  );
};
