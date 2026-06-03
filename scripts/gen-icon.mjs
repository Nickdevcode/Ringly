#!/usr/bin/env node
/**
 * Build-time (manual) generator for `plugin/assets/ringly.ico` — the Start Menu
 * shortcut icon that becomes the toast's corner icon (replacing the Node.js
 * logo). Reproduces the site favicon (`Ringly-landing/public/favicon.svg`):
 * concentric cyan rings (#67E8F9) over a rounded dark square (#0A0B0F).
 *
 * Why manual (not part of `npm run build`): it shells out to PowerShell +
 * System.Drawing to rasterize the geometry, which is Windows-only. CI runs on
 * Linux/macOS, so the `.ico` is generated once on Windows and COMMITTED.
 *
 * Pipeline: for each size, a PowerShell script draws the icon and writes a PNG
 * to a temp file; Node reads the PNGs and packs them into one `.ico` via the
 * tested `packIco` (built to `dist/ico.js`, so run `npm run build` first).
 *
 * Run: `node scripts/gen-icon.mjs`  (Windows only)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

if (process.platform !== "win32") {
  console.error(
    "[gen-icon] This generator is Windows-only (uses PowerShell + System.Drawing).\n" +
      "           The committed plugin/assets/ringly.ico is generated on Windows.",
  );
  process.exit(1);
}

const distIco = resolve(root, "dist", "ico.js");
if (!existsSync(distIco)) {
  console.error("[gen-icon] dist/ico.js not found — run `npm run build` first.");
  process.exit(1);
}
const { packIco, RINGLY_ICON_SIZES } = await import(pathToFileURL(distIco).href);

const sizes = [...RINGLY_ICON_SIZES];
const tmpDir = resolve(root, ".tmp-icon");
mkdirSync(tmpDir, { recursive: true });

/**
 * PowerShell that draws the Ringly mark at `size`px and writes a PNG to `out`.
 * Geometry mirrors favicon.svg (viewBox 32; rounded rect rx=7; rings r=6/10.5/14
 * and a filled center dot r=2; cyan #67E8F9 on #0A0B0F), scaled by k = size/32.
 */
function drawScript(size, out) {
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$S = ${size}
$k = $S / 32.0
$bmp = New-Object System.Drawing.Bitmap($S, $S, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

# Rounded dark background (#0A0B0F), corner radius 7 (scaled)
$r = [int][math]::Round(7 * $k)
$d = $r * 2
$w = $S - 1
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $d, $d, 180, 90)
$path.AddArc($w - $d, 0, $d, $d, 270, 90)
$path.AddArc($w - $d, $w - $d, $d, $d, 0, 90)
$path.AddArc(0, $w - $d, $d, $d, 90, 90)
$path.CloseFigure()
$bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 10, 11, 15))
$g.FillPath($bgBrush, $path)

# Cyan rings (#67E8F9) — radius / stroke / alpha
$cx = 16 * $k; $cy = 16 * $k
function Draw-Ring($radius, $strokeW, $alpha) {
  $col = [System.Drawing.Color]::FromArgb($alpha, 103, 232, 249)
  $pen = New-Object System.Drawing.Pen($col, [float]($strokeW * $k))
  $rr = $radius * $k
  $g.DrawEllipse($pen, [float]($cx - $rr), [float]($cy - $rr), [float]($rr * 2), [float]($rr * 2))
  $pen.Dispose()
}
Draw-Ring 14 0.8 64
Draw-Ring 10.5 1.2 140
Draw-Ring 6 1.6 255

# Filled center dot (r=2)
$dotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 103, 232, 249))
$rr = 2 * $k
$g.FillEllipse($dotBrush, [float]($cx - $rr), [float]($cy - $rr), [float]($rr * 2), [float]($rr * 2))

$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes('${out.replace(/'/g, "''")}', $ms.ToArray())
$g.Dispose(); $bmp.Dispose(); $bgBrush.Dispose(); $dotBrush.Dispose(); $path.Dispose(); $ms.Dispose()
`.trim();
}

function renderPng(size) {
  const out = join(tmpDir, `ringly-${size}.png`);
  const encoded = Buffer.from(drawScript(size, out), "utf16le").toString("base64");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
    { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
  );
  if (result.status !== 0 || !existsSync(out)) {
    throw new Error(
      `PowerShell failed to render ${size}px: ${result.stderr?.toString() ?? "(no stderr)"}`,
    );
  }
  return readFileSync(out);
}

try {
  const pngs = sizes.map(renderPng);
  const ico = packIco(pngs, sizes);
  const outPath = resolve(root, "plugin", "assets", "ringly.ico");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, ico);
  console.log(
    `[gen-icon] wrote ${outPath} (${sizes.length} sizes: ${sizes.join("/")}, ${ico.length} bytes)`,
  );
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
