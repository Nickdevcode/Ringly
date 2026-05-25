import { Box, Text, useInput } from "ink";
import { type FC, useState } from "react";
import type { Translator } from "../../core/translator.js";
import { Footer } from "../components/Footer.js";
import { Header } from "../components/Header.js";

export interface EventToggles {
  notification: boolean;
  stop: boolean;
  stopFailure: boolean;
  subagentStop: boolean;
}

export interface HookPickerProps {
  translator: Translator;
  initial: EventToggles;
  onSubmit: (toggles: EventToggles) => void;
}

interface Item {
  key: keyof EventToggles;
  icon: string;
  labelKey: string;
  descKey: string;
}

const ITEMS: readonly Item[] = [
  {
    key: "notification",
    icon: "🔔",
    labelKey: "tui.events.notification.label",
    descKey: "tui.events.notification.desc",
  },
  {
    key: "stop",
    icon: "✅",
    labelKey: "tui.events.stop.label",
    descKey: "tui.events.stop.desc",
  },
  {
    key: "stopFailure",
    icon: "⚠️ ",
    labelKey: "tui.events.stopFailure.label",
    descKey: "tui.events.stopFailure.desc",
  },
  {
    key: "subagentStop",
    icon: "🤖",
    labelKey: "tui.events.subagentStop.label",
    descKey: "tui.events.subagentStop.desc",
  },
];

export const HookPicker: FC<HookPickerProps> = ({ translator, initial, onSubmit }) => {
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
        translator={translator}
        step={2}
        totalSteps={4}
        title={translator.t("tui.events.title")}
        subtitle={translator.t("tui.events.subtitle", {
          enabled: enabledCount,
          total: ITEMS.length,
        })}
      />

      <Box flexDirection="column" paddingLeft={2}>
        {ITEMS.map((item, idx) => {
          const active = idx === cursor;
          const checked = toggles[item.key];
          const checkbox = checked ? "◉" : "◯";
          const checkboxColor = checked ? "green" : "gray";
          const cursorMark = active ? "›" : " ";
          const label = translator.t(item.labelKey);
          const description = translator.t(item.descKey);

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
