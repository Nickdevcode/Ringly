import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readStdin, tryParseJson } from "../src/core/stdin.js";

describe("tryParseJson", () => {
  it("returns null for empty string", () => {
    expect(tryParseJson("")).toBeNull();
    expect(tryParseJson("   ")).toBeNull();
  });

  it("parses valid JSON", () => {
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns null for invalid JSON", () => {
    expect(tryParseJson("not json")).toBeNull();
    expect(tryParseJson("{ broken")).toBeNull();
  });

  it("removes UTF-8 BOM before parsing", () => {
    expect(tryParseJson('﻿{"x":42}')).toEqual({ x: 42 });
  });
});

describe("readStdin", () => {
  let originalStdin: NodeJS.ReadStream;
  let fakeStdin: PassThrough;

  beforeEach(() => {
    originalStdin = process.stdin;
    fakeStdin = new PassThrough();
    Object.defineProperty(fakeStdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process, "stdin", {
      value: fakeStdin,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("returns empty string when stdin is TTY", async () => {
    Object.defineProperty(fakeStdin, "isTTY", { value: true, configurable: true });
    const result = await readStdin({ timeoutMs: 50 });
    expect(result).toBe("");
  });

  it("reads chunks until end", async () => {
    const promise = readStdin({ timeoutMs: 1000 });
    fakeStdin.write("hello ");
    fakeStdin.write("world");
    fakeStdin.end();
    expect(await promise).toBe("hello world");
  });

  it("respects maxBytes and returns empty when exceeded", async () => {
    const promise = readStdin({ timeoutMs: 1000, maxBytes: 5 });
    fakeStdin.write("123456789");
    expect(await promise).toBe("");
  });

  it("times out and returns whatever was collected", async () => {
    const promise = readStdin({ timeoutMs: 50 });
    fakeStdin.write("partial");
    const result = await promise;
    expect(result).toBe("partial");
  });
});
