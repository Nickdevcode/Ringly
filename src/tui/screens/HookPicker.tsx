import { Box, Text, useInput } from "ink";
import { type FC, useState } from "react";
import { Footer } from "../components/Footer.js";
import { Header } from "../components/Header.js";

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
  icon: string;
  label: string;
  description: string;
}

const ITEMS: readonly Item[] = [
  {
    key: "notification",
    icon: "🔔",
    label: "Permission / input requests",
    description: "Notify when Claude needs your attention",
  },
  {
    key: "stop",
    icon: "✅",
    label: "Task complete",
    description: "Notify when Claude finishes a response",
  },
  {
    key: "stopFailure",
    icon: "⚠️ ",
    label: "API errors",
    description: "Notify when an API error ends the session",
  },
  {
    key: "subagentStop",
    icon: "🤖",
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

  const enabledCount = Object.values(toggles).filter(Boolean).length;

  return (
    <Box flexDirection="column">
      <Header
        step={2}
        totalSteps={4}
        title="Choose which events should notify you"
        subtitle={`${enabledCount} of ${ITEMS.length} enabled`}
      />

      <Box flexDirection="column" paddingLeft={2}>
        {ITEMS.map((item, idx) => {
          const active = idx === cursor;
          const checked = toggles[item.key];
          const checkbox = checked ? "◉" : "◯";
          const checkboxColor = checked ? "green" : "gray";
          const cursorMark = active ? "›" : " ";

          return (
            <Box key={item.key} flexDirection="row" gap={1}>
              {active ? (
                <Text bold color="cyan">
                  {cursorMark}
                </Text>
              ) : (
                <Text bold>{cursorMark}</Text>
              )}
              <Text color={checkboxColor}>{checkbox}</Text>
              <Text>{item.icon}</Text>
              {active ? (
                <Text bold color="cyan">
                  {item.label}
                </Text>
              ) : (
                <Text>{item.label}</Text>
              )}
              <Text dimColor>— {item.description}</Text>
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
