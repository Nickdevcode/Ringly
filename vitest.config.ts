import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/tui/**",
        "src/cli.ts",
        "src/hook.ts",
        "src/platform/**",
        "src/commands/init.ts",
        "src/commands/config.ts",
        "src/commands/doctor.ts",
        "src/commands/test.ts",
        "src/commands/uninstall.ts",
      ],
      reporter: ["text", "html"],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
    },
  },
});
