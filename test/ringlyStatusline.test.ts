import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/core/config.js";

// The renderer is a standalone plugin .mjs (not part of the src bundle). Import
// it dynamically so vitest transpiles/loads it like any ESM module.
const mod = await import("../plugin/statusline/ringly-statusline.mjs");
const {
  renderStatusline,
  renderContextMeter,
  renderGit,
  renderLines,
  renderRateLimits,
  formatReset,
  composeCore,
  resolveSegments,
  DEFAULT_SEGMENTS,
} = mod as unknown as {
  renderStatusline: (data: unknown, options: unknown) => string;
  renderContextMeter: (data: unknown, options: unknown) => string;
  renderGit: (git: unknown) => string;
  renderLines: (data: unknown) => string;
  renderRateLimits: (data: unknown) => string;
  formatReset: (v: unknown) => string;
  composeCore: (o: unknown) => string;
  resolveSegments: (o: Record<string, unknown>) => Record<string, boolean>;
  DEFAULT_SEGMENTS: Record<string, boolean>;
};

// ANSI shorthands matching the renderer.
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;

/** Options that only enable the deterministic (no-filesystem) segments. */
function coreOnlyOptions(overrides: Record<string, unknown> = {}) {
  return {
    statusline_segment_model: true,
    statusline_segment_task: false,
    statusline_segment_dirname: true,
    statusline_segment_context: true,
    statusline_segment_lastCommand: false,
    statusline_segment_git: false,
    statusline_segment_lines: false,
    statusline_segment_rateLimits: false,
    ...overrides,
  };
}

describe("DEFAULT_SEGMENTS drift", () => {
  it("matches src/core config defaults exactly", () => {
    expect(DEFAULT_SEGMENTS).toEqual(DEFAULT_CONFIG.statusline.segments);
  });
});

describe("resolveSegments", () => {
  it("defaults each segment and honors explicit booleans", () => {
    const seg = resolveSegments({ statusline_segment_git: false });
    expect(seg.git).toBe(false);
    expect(seg.model).toBe(true);
  });
});

describe("renderContextMeter", () => {
  const meter = (remaining: number) =>
    renderContextMeter({ context_window: { remaining_percentage: remaining } }, {});

  it("colors by usage threshold (green/yellow/orange/skull)", () => {
    // With the 16.5% auto-compact buffer, used = 100 - ((remaining-16.5)/83.5)*100.
    // Pick remaining values that land squarely in each color band:
    //   remaining 95 → used ~6   (green,  <50)
    //   remaining 55 → used ~54  (yellow, 50–64)
    //   remaining 40 → used ~72  (orange, 65–79)
    //   remaining 20 → used ~96  (skull,  ≥80)
    expect(meter(95)).toContain("\x1b[32m");
    expect(meter(55)).toContain("\x1b[33m");
    expect(meter(40)).toContain("\x1b[38;5;208m");
    const high = meter(20);
    expect(high).toContain("\x1b[5;31m");
    expect(high).toContain("💀");
  });

  it("renders a 10-cell bar and a percentage", () => {
    const out = meter(50);
    const bars = (out.match(/[█░]/g) || []).length;
    expect(bars).toBe(10);
    expect(out).toMatch(/\d+%/);
  });

  it("returns empty when remaining is unavailable", () => {
    expect(renderContextMeter({ context_window: {} }, {})).toBe("");
    expect(renderContextMeter({}, {})).toBe("");
  });

  it("honors the hidden precalc option", () => {
    const out = renderContextMeter(
      { context_window: { used_percentage: 42, remaining_percentage: 99 } },
      { statusline_context_precalc: true },
    );
    expect(out).toContain("42%");
  });
});

describe("renderGit", () => {
  it("shows branch cyan with ahead/behind/dirty markers", () => {
    const out = renderGit({ branch: "main", ahead: 2, behind: 1, dirty: 3 });
    expect(out).toBe(
      " │ \x1b[36mmain\x1b[0m \x1b[32m↑2\x1b[0m \x1b[31m↓1\x1b[0m \x1b[33m●3\x1b[0m",
    );
  });

  it("omits zero counters and returns empty for null state", () => {
    expect(renderGit({ branch: "main", ahead: 0, behind: 0, dirty: 0 })).toBe(
      " │ \x1b[36mmain\x1b[0m",
    );
    expect(renderGit(null)).toBe("");
  });
});

describe("renderLines", () => {
  it("shows +added -removed when nonzero", () => {
    expect(renderLines({ cost: { total_lines_added: 12, total_lines_removed: 4 } })).toBe(
      " │ \x1b[32m+12\x1b[0m \x1b[31m-4\x1b[0m",
    );
  });
  it("is empty when both are zero/absent", () => {
    expect(renderLines({ cost: { total_lines_added: 0, total_lines_removed: 0 } })).toBe("");
    expect(renderLines({})).toBe("");
  });
});

describe("renderRateLimits / formatReset", () => {
  it("renders 5h and 7d meters joined by a dim dot", () => {
    const out = renderRateLimits({
      rate_limits: {
        five_hour: { used_percentage: 23 },
        seven_day: { used_percentage: 80 },
      },
    });
    expect(out).toContain("5h");
    expect(out).toContain("7d");
    expect(out).toContain("23%");
    expect(out).toContain("80%");
    expect(out).toContain("\x1b[2m·\x1b[0m");
  });

  it("omits absent windows and the whole segment when both absent", () => {
    const only5h = renderRateLimits({ rate_limits: { five_hour: { used_percentage: 10 } } });
    expect(only5h).toContain("5h");
    expect(only5h).not.toContain("7d");
    expect(renderRateLimits({})).toBe("");
  });

  it("formats reset deltas and drops past resets", () => {
    // Add ~30s of slack so the floor(delta/60000) doesn't shed a minute to the
    // few ms that pass between building the epoch and formatReset reading Date.now().
    const now = Date.now();
    const inMin = (m: number) => Math.floor((now + m * 60000 + 30000) / 1000);
    expect(formatReset(inMin(30))).toBe("30m");
    expect(formatReset(inMin(90))).toBe("1h 30m");
    expect(formatReset(inMin(26 * 60))).toBe("1d 2h");
    expect(formatReset(Math.floor((now - 60000) / 1000))).toBe("");
    expect(formatReset(null)).toBe("");
  });
});

describe("composeCore", () => {
  it("joins present pieces with ' │ ' and drops absent ones (no dangling sep)", () => {
    const out = composeCore({
      model: DIM("Opus"),
      ctx: "",
      middle: null,
      dirname: DIM("proj"),
      lastCmdSuffix: "",
      position: "end",
    });
    expect(out).toBe(`${DIM("Opus")} │ ${DIM("proj")}`);
  });

  it("glues the meter to the directory in 'end' and to the model in 'front'", () => {
    const end = composeCore({
      model: DIM("Opus"),
      ctx: " CTX",
      middle: null,
      dirname: DIM("proj"),
      lastCmdSuffix: "",
      position: "end",
    });
    expect(end).toBe(`${DIM("Opus")} │ ${DIM("proj")} CTX`);

    const front = composeCore({
      model: DIM("Opus"),
      ctx: " CTX",
      middle: null,
      dirname: DIM("proj"),
      lastCmdSuffix: "",
      position: "front",
    });
    expect(front).toBe(`${DIM("Opus")} CTX │ ${DIM("proj")}`);
  });
});

describe("renderStatusline (integration, filesystem-free segments)", () => {
  const data = {
    model: { display_name: "Opus" },
    workspace: { current_dir: "/home/me/my-project" },
    session_id: "", // empty → no task lookup, no filesystem
    context_window: { remaining_percentage: 90, context_window_size: 1_000_000 },
  };

  it("produces the core layout matching the original hybrid (model │ dir+meter)", () => {
    const out = renderStatusline(data, coreOnlyOptions());
    const meter = renderContextMeter(data, {});
    expect(out).toBe(`${DIM("Opus")} │ ${DIM("my-project")}${meter}`);
  });

  it("drops a segment cleanly when toggled off (no dangling separators)", () => {
    const out = renderStatusline(
      data,
      coreOnlyOptions({ statusline_segment_model: false, statusline_segment_context: false }),
    );
    // Only the directory remains.
    expect(out).toBe(DIM("my-project"));
  });

  it("returns empty string when the master switch is off", () => {
    expect(renderStatusline(data, coreOnlyOptions({ statusline_enabled: false }))).toBe("");
  });

  it("never throws on malformed/empty data", () => {
    expect(() => renderStatusline({}, coreOnlyOptions())).not.toThrow();
    expect(() => renderStatusline({ model: null }, coreOnlyOptions())).not.toThrow();
  });

  it("falls back to 'Claude' when the model name is missing", () => {
    const out = renderStatusline(
      { ...data, model: undefined },
      coreOnlyOptions({ statusline_segment_context: false, statusline_segment_dirname: false }),
    );
    expect(out).toBe(DIM("Claude"));
  });
});
