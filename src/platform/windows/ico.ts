/**
 * Minimal ICO container builder. Packs one or more PNG buffers into a single
 * `.ico` file. Windows has accepted PNG-compressed icon images since Vista, so
 * we embed PNGs directly — no BMP/`BITMAPINFOHEADER`, no AND mask. This keeps
 * the packer tiny and lets us ship crisp icons at every size.
 *
 * Layout (all integers little-endian):
 *   ICONDIR        — 6 bytes:  reserved(0) u16 | type(1) u16 | count u16
 *   ICONDIRENTRY×N — 16 bytes each:
 *     bWidth  u8  (0 means 256)   bHeight u8  (0 means 256)
 *     bColorCount u8 (0)          bReserved u8 (0)
 *     wPlanes u16 (1)             wBitCount u16 (32)
 *     dwBytesInRes u32 (PNG len)  dwImageOffset u32 (absolute)
 *   PNG data×N     — the raw PNG bytes, in entry order.
 *
 * This module is pure (no fs / no PowerShell) so it can be unit-tested on any
 * OS; `scripts/gen-icon.mjs` renders the PNGs (Windows-only) and calls it.
 */

const ICONDIR_SIZE = 6;
const ICONDIRENTRY_SIZE = 16;

/**
 * Builds a `.ico` byte buffer from parallel `pngBuffers` / `sizes` arrays
 * (`sizes[i]` is the pixel dimension — width === height — of `pngBuffers[i]`).
 * Caller is responsible for passing PNGs that actually match the sizes.
 */
export function packIco(pngBuffers: Buffer[], sizes: number[]): Buffer {
  if (pngBuffers.length !== sizes.length) {
    throw new Error("packIco: pngBuffers and sizes must have the same length");
  }
  if (pngBuffers.length === 0) {
    throw new Error("packIco: need at least one image");
  }

  const count = pngBuffers.length;
  const header = Buffer.alloc(ICONDIR_SIZE);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(count, 4);

  const entries = Buffer.alloc(ICONDIRENTRY_SIZE * count);
  let offset = ICONDIR_SIZE + ICONDIRENTRY_SIZE * count;

  sizes.forEach((size, i) => {
    const png = pngBuffers[i];
    if (!png) throw new Error(`packIco: missing PNG buffer at index ${i}`);
    const e = i * ICONDIRENTRY_SIZE;
    const dim = size >= 256 ? 0 : size; // 256 is encoded as 0
    entries.writeUInt8(dim, e); // bWidth
    entries.writeUInt8(dim, e + 1); // bHeight
    entries.writeUInt8(0, e + 2); // bColorCount
    entries.writeUInt8(0, e + 3); // bReserved
    entries.writeUInt16LE(1, e + 4); // wPlanes
    entries.writeUInt16LE(32, e + 6); // wBitCount
    entries.writeUInt32LE(png.length, e + 8); // dwBytesInRes
    entries.writeUInt32LE(offset, e + 12); // dwImageOffset
    offset += png.length;
  });

  return Buffer.concat([header, entries, ...pngBuffers]);
}

/** The icon sizes Ringly ships, smallest to largest. */
export const RINGLY_ICON_SIZES = [16, 32, 48, 64, 128, 256] as const;
