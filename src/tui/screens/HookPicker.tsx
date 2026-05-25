import { Box, Text, useInput } from "ink";
import { type FC, useState } from "react";

export interface EventToggles {
  notification: boolean;
  stop: boolean;
  stopFailure: boolean;
  subagentStop: boolean;
}

export interface HookPickerProps {
  initial: EventToggles;
  onSubmit: (toggles: EventToggles) => void;
}

interface Item {
  key: keyof EventToggles;
  label: string;
  description: string;
}

const ITEMS: readonly Item[] = [
  {
    key: "notification",
    label: "Permission / input requests",
    description: "Notify when Claude needs your attention",
  },
  {
    key: "stop",
    label: "Task complete",
    description: "Notify when Claude finishes a response",
  },
  {
    key: "stopFailure",
    label: "API errors",
    description: "Notify when an API error ends the session",
  },
  {
    key: "subagentStop",
    label: "Subagent finished",
    description: "Notify when a subagent completes (off by default)",
  },
];

export const HookPicker: FC<HookPickerProps> = ({ initial, onSubmit }) => {
  const [toggles, setToggles] = useState<EventToggles>(initial);
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => (c <= 0 ? ITEMS.length - 1 : c - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((c) => (c >= ITEMS.length - 1 ? 0 : c + 1));
      return;
    }
    if (input === " ") {
      const item = ITEMS[cursor];
      if (!item) return;
      setToggles((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
      return;
    }
    if (key.return) onSubmit(toggles);
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Step 2 / 4 — Which events should notify you?</Text>
      <Text dimColor>↑/↓ to move · space to toggle · Enter to confirm</Text>
      <Box flexDirection="column" marginTop={1}>
        {ITEMS.map((item, idx) => {
          const active = idx === cursor;
          const checked = toggles[item.key];
          const icon = checked ? "[x]" : "[ ]";
          const props = active ? { color: "cyan" as const } : {};
          return (
            <Text key={item.key} {...props}>
              {`${active ? "›" : " "} ${icon} ${item.label}  `}
              <Text dimColor>{item.description}</Text>
            </Text>
          );
        })}
      </Box>
    </Box>
  );
};
