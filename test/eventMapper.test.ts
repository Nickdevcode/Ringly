import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapEvent } from "../src/core/eventMapper.js";
import { createTranslator } from "../src/core/translator.js";
import type { ClaudeHookEventName, ClaudeHookPayload } from "../src/core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

function loadFixture(name: string): ClaudeHookPayload {
  return JSON.parse(
    readFileSync(join(fixturesDir, name), { encoding: "utf8" }),
  ) as ClaudeHookPayload;
}

function runMap(
  payload: ClaudeHookPayload,
  event: ClaudeHookEventName,
  language: "pt-BR" | "en-US" = "pt-BR",
) {
  const translator = createTranslator(language);
  return mapEvent({ payload, event, translator, soundEnabled: true });
}

describe("eventMapper - Notification event", () => {
  it("translates tool permission from message regex (pt-BR)", () => {
    const intent = runMap(loadFixture("notification-permission-bash.json"), "Notification");
    expect(intent.title).toContain("Atenção necessária");
    expect(intent.body).toContain("Permissão necessária para usar Bash");
    expect(intent.body.startsWith("NewsDev: ")).toBe(true);
    expect(intent.severity).toBe("warning");
    expect(intent.soundName).toBe("Notification.Default");
  });

  it("translates tool permission via notification_type (en-US)", () => {
    const intent = runMap(
      loadFixture("notification-permission-type.json"),
      "Notification",
      "en-US",
    );
    expect(intent.body).toContain("Permission required to run a tool");
  });

  it("translates idle/waiting input message", () => {
    const intent = runMap(loadFixture("notification-idle.json"), "Notification");
    expect(intent.body).toContain("Aguardando sua resposta");
  });

  it("falls back to attention text when message is empty", () => {
    const intent = runMap({ hook_event_name: "Notification", cwd: "C:/foo/bar" }, "Notification");
    expect(intent.body).toContain("Claude Code precisa da sua atenção");
  });
});

describe("eventMapper - Stop event", () => {
  it("produces the canonical Stop body with project prefix", () => {
    const intent = runMap(loadFixture("stop.json"), "Stop");
    expect(intent.title).toContain("Tarefa concluída");
    expect(intent.body).toBe("NewsDev: Aguardando próximo input");
    expect(intent.soundName).toBe("Notification.IM");
    expect(intent.severity).toBe("info");
  });
});

describe("eventMapper - StopFailure event", () => {
  it("translates rate_limit error type", () => {
    const intent = runMap(loadFixture("stopFailure-rate-limit.json"), "StopFailure");
    expect(intent.title).toContain("Erro de API");
    expect(intent.body).toContain("Limite de uso atingido");
    expect(intent.severity).toBe("error");
    expect(intent.soundName).toBe("Notification.Looping.Alarm2");
  });

  it("translates billing_error type", () => {
    const intent = runMap(loadFixture("stopFailure-billing.json"), "StopFailure");
    expect(intent.body).toContain("Erro de cobrança");
  });

  it("uses fallback when neither type nor message match a known pattern", () => {
    const intent = runMap({ hook_event_name: "StopFailure", cwd: "C:/foo/bar" }, "StopFailure");
    expect(intent.body).toContain("A sessão foi encerrada por um erro");
  });
});

describe("eventMapper - SubagentStop event", () => {
  it("uses agent_type when provided", () => {
    const intent = runMap(loadFixture("subagentStop.json"), "SubagentStop");
    expect(intent.title).toContain("Subagent finalizado");
    expect(intent.body).toContain("gsd-executor");
  });

  it("falls back to generic message when agent_type missing", () => {
    const intent = runMap({ hook_event_name: "SubagentStop", cwd: "C:/foo/bar" }, "SubagentStop");
    expect(intent.body).toContain("Um subagent terminou");
  });
});

describe("eventMapper - project name extraction", () => {
  it("extracts the project name from cwd", () => {
    const intent = runMap({ hook_event_name: "Stop", cwd: "C:/projects/awesome-project" }, "Stop");
    expect(intent.projectName).toBe("awesome-project");
  });

  it("handles trailing slashes", () => {
    const intent = runMap({ hook_event_name: "Stop", cwd: "C:/projects/awesome-project/" }, "Stop");
    expect(intent.projectName).toBe("awesome-project");
  });

  it("returns null when cwd is missing", () => {
    const intent = runMap({ hook_event_name: "Stop" }, "Stop");
    expect(intent.projectName).toBeNull();
  });
});
