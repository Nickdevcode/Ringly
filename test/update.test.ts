import { describe, expect, it } from "vitest";
import { buildNpmInstallSpec } from "../src/commands/update.js";

/**
 * Regression coverage for the Windows `spawn EINVAL` bug.
 *
 * Background: Node 20.12+/21.7+/22+ refuses to spawn `.bat`/`.cmd` shims
 * directly (CVE-2024-27980). Calling `spawn("npm.cmd", [...], { shell: false })`
 * throws `EINVAL` before npm can run. The fix is to enable `shell: true` on
 * Windows so `cmd.exe` resolves the shim — safe here because the arguments
 * are hardcoded literals (no user input).
 */
describe("buildNpmInstallSpec", () => {
  it("targets npm with `install -g ringly@latest` on every platform", () => {
    for (const platform of ["win32", "darwin", "linux"] as const) {
      const spec = buildNpmInstallSpec(platform);
      expect(spec.command).toBe("npm");
      expect(spec.args).toEqual(["install", "-g", "ringly@latest"]);
    }
  });

  it("uses shell: true on Windows to avoid EINVAL when invoking npm.cmd", () => {
    const spec = buildNpmInstallSpec("win32");
    expect(spec.options.shell).toBe(true);
  });

  it("uses shell: false on macOS/Linux where npm is a real PATH executable", () => {
    expect(buildNpmInstallSpec("darwin").options.shell).toBe(false);
    expect(buildNpmInstallSpec("linux").options.shell).toBe(false);
  });

  it("pipes stdout/stderr and hides the spawned window on every platform", () => {
    for (const platform of ["win32", "darwin", "linux"] as const) {
      const spec = buildNpmInstallSpec(platform);
      expect(spec.options.stdio).toEqual(["ignore", "pipe", "pipe"]);
      expect(spec.options.windowsHide).toBe(true);
    }
  });
});
