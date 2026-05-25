import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/tui/**",
        "src/cli.ts",
        "src/hook.ts",
        "src/platform/macos/**",
        "src/platform/linux/**",
        "src/commands/init.ts",
      ],
      reporter: ["text", "html"],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
