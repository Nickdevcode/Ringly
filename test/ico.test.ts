import { describe, expect, it } from "vitest";
import { packIco, RINGLY_ICON_SIZES } from "../src/platform/windows/ico.js";

// Distinct fake PNG payloads (content is irrelevant to the container layout).
function fakePngs(sizes: number[]): Buffer[] {
  return sizes.map((s, i) => Buffer.alloc(10 + i, s % 256));
}

describe("packIco", () => {
  it("writes a valid ICONDIR header", () => {
    const sizes = [16, 32];
    const ico = packIco(fakePngs(sizes), sizes);
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type = icon
    expect(ico.readUInt16LE(4)).toBe(2); // count
  });

  it("places the first image right after the directory and chains offsets", () => {
    const sizes = [16, 32, 48];
    const pngs = fakePngs(sizes);
    const ico = packIco(pngs, sizes);

    // Entry i starts at byte 6 + i*16; dwImageOffset is at +12 within it.
    const entry = (i: number) => 6 + i * 16;
    const headerSize = 6 + 16 * sizes.length; // 6 + 48 = 54
    expect(ico.readUInt32LE(entry(0) + 12)).toBe(headerSize);
    expect(ico.readUInt32LE(entry(1) + 12)).toBe(headerSize + pngs[0].length);
    expect(ico.readUInt32LE(entry(2) + 12)).toBe(headerSize + pngs[0].length + pngs[1].length);
  });

  it("records each PNG's byte length and 32-bit/1-plane fields", () => {
    const sizes = [16, 32];
    const pngs = fakePngs(sizes);
    const ico = packIco(pngs, sizes);
    const entry = (i: number) => 6 + i * 16;
    expect(ico.readUInt16LE(entry(0) + 4)).toBe(1); // wPlanes
    expect(ico.readUInt16LE(entry(0) + 6)).toBe(32); // wBitCount
    expect(ico.readUInt32LE(entry(0) + 8)).toBe(pngs[0].length); // dwBytesInRes
    expect(ico.readUInt32LE(entry(1) + 8)).toBe(pngs[1].length);
  });

  it("encodes 256 as 0 in the width/height bytes", () => {
    const sizes = [256];
    const ico = packIco(fakePngs(sizes), sizes);
    expect(ico.readUInt8(6)).toBe(0); // bWidth
    expect(ico.readUInt8(6 + 1)).toBe(0); // bHeight
  });

  it("encodes sub-256 sizes literally", () => {
    const sizes = [48];
    const ico = packIco(fakePngs(sizes), sizes);
    expect(ico.readUInt8(6)).toBe(48);
    expect(ico.readUInt8(6 + 1)).toBe(48);
  });

  it("produces a total length of header + entries + all PNG bytes", () => {
    const sizes = [...RINGLY_ICON_SIZES];
    const pngs = fakePngs(sizes);
    const ico = packIco(pngs, sizes);
    const expected = 6 + 16 * sizes.length + pngs.reduce((sum, b) => sum + b.length, 0);
    expect(ico.length).toBe(expected);
  });

  it("rejects mismatched array lengths and empty input", () => {
    expect(() => packIco([Buffer.alloc(1)], [16, 32])).toThrow();
    expect(() => packIco([], [])).toThrow();
  });
});
