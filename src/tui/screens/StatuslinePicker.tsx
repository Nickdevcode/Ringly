import { Box, Text, useInput } from "ink";
import { type FC, useState } from "react";
import type { Translator } from "../../core/translator.js";
import {
  STATUSLINE_SEGMENT_KEYS,
  type StatuslineConfig,
  type StatuslineContextPosition,
  type StatuslineSegments,
} from "../../core/types.js";
import { Footer } from "../components/Footer.js";
import { Header } from "../components/Header.js";

export interface StatuslinePickerProps {
  translator: Translator;
  initial: StatuslineConfig;
  onSubmit: (value: StatuslineConfig) => void;
}

/** Icon shown next to each segment row (purely decorative, TUI-only). */
const SEGMENT_ICONS: Record<keyof StatuslineSegments, string> = {
  model: "🧠",
  task: "📝",
  dirname: "📁",
  context: "📊",
  lastCommand: "⌘ ",
  git: "🌿",
  lines: "±",
  rateLimits: "⏱ ",
};

/**
 * A vertical picker for the status line: a master enable toggle, then one
 * checkbox row per segment, then a context-position row toggled with ←/→.
 * Mirrors HookPicker's interaction model (↑/↓ move, Space toggles, Enter
 * confirms) so it feels identical to the events/sound screens.
 */
export const StatuslinePicker: FC<StatuslinePickerProps> = ({ translator, initial, onSubmit }) => {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [segments, setSegments] = useState<StatuslineSegments>(initial.segments);
  const [position, setPosition] = useState<StatuslineContextPosition>(initial.position);
  const [cursor, setCursor] = useState(0);

  // Row layout: [0] master · [1..N] segments · [N+1] position.
  const segmentCount = STATUSLINE_SEGMENT_KEYS.length;
  const positionRow = segmentCount + 1;
  const rowCount = segmentCount + 2;

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => (c <= 0 ? rowCount - 1 : c - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((c) => (c >= rowCount - 1 ? 0 : c + 1));
      return;
    }
    // ←/→ flips the context position when that row is focused.
    if ((key.leftArrow || key.rightArrow) && cursor === positionRow) {
      setPosition((p) => (p === "end" ? "front" : "end"));
      return;
    }
    if (input === " ") {
      if (cursor === 0) {
        setEnabled((e) => !e);
      } else if (cursor === positionRow) {
        setPosition((p) => (p === "end" ? "front" : "end"));
      } else {
        const segKey = STATUSLINE_SEGMENT_KEYS[cursor - 1];
        if (segKey) setSegments((prev) => ({ ...prev, [segKey]: !prev[segKey] }));
      }
      return;
    }
    if (key.return) onSubmit({ enabled, position, segments });
  });

  const enabledCount = Object.values(segments).filter(Boolean).length;

  const renderCheckRow = (
    rowIndex: number,
    checked: boolean,
    icon: string,
    label: string,
    description: string,
  ) => {
    const active = rowIndex === cursor;
    const checkbox = checked ? "◉" : "◯";
    const checkboxColor = checked ? "green" : "gray";
    const cursorMark = active ? "›" : " ";
    return (
      <Box flexDirection="row" gap={1}>
        {active ? (
          <Text bold color="cyan">
            {cursorMark}
          </Text>
        ) : (
          <Text bold>{cursorMark}</Text>
        )}
        <Text color={checkboxColor}>{checkbox}</Text>
        <Text>{icon}</Text>
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
  };

  return (
    <Box flexDirection="column">
      <Header
        translator={translator}
        step={4}
        totalSteps={5}
        title={translator.t("tui.statusline.title")}
        subtitle={translator.t("tui.statusline.subtitle", {
          enabled: enabledCount,
          total: segmentCount,
        })}
      />

      {/* Explanatory blurb — many users won't know what a status line is. */}
      <Box paddingLeft={2} marginBottom={1}>
        <Text dimColor>{translator.t("tui.statusline.explain")}</Text>
      </Box>

      <Box flexDirection="column" paddingLeft={2}>
        {/* Master switch */}
        {renderCheckRow(
          0,
          enabled,
          "⚡",
          translator.t("tui.statusline.enabled.label"),
          translator.t("tui.statusline.enabled.desc"),
        )}

        {/* Segment toggles — dimmed as a group when the master is off. */}
        <Box flexDirection="column" marginTop={1}>
          {STATUSLINE_SEGMENT_KEYS.map((segKey, idx) =>
            renderCheckRow(
              idx + 1,
              segments[segKey],
              SEGMENT_ICONS[segKey],
              translator.t(`tui.statusline.segment.${segKey}.label`),
              translator.t(`tui.statusline.segment.${segKey}.desc`),
            ),
          )}
        </Box>

        {/* Context position (enum row) */}
        <Box flexDirection="row" gap={1} marginTop={1}>
          {cursor === positionRow ? (
            <Text bold color="cyan">
              ›
            </Text>
          ) : (
            <Text bold> </Text>
          )}
          <Text>↹</Text>
          {cursor === positionRow ? (
            <Text bold color="cyan">
              {translator.t("tui.statusline.position.label")}
            </Text>
          ) : (
            <Text>{translator.t("tui.statusline.position.label")}</Text>
          )}
          <Text color="yellow">{translator.t(`tui.statusline.position.${position}`)}</Text>
          <Text dimColor>— {translator.t("tui.statusline.position.desc")}</Text>
        </Box>
      </Box>

      {!enabled && (
        <Box paddingLeft={2} marginTop={1}>
          <Text color="yellow">{translator.t("tui.statusline.off_hint")}</Text>
        </Box>
      )}

      <Footer
        hints={[
          { key: "↑/↓", label: translator.t("tui.footer.move") },
          { key: "Space", label: translator.t("tui.footer.toggle") },
          { key: "←/→", label: translator.t("tui.statusline.footer.position") },
          { key: "Enter", label: translator.t("tui.footer.confirm") },
        ]}
      />
    </Box>
  );
};
