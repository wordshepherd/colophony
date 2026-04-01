/**
 * Generate branded favicon and icon assets from source SVGs.
 *
 * Uses Playwright to render SVGs with web fonts loaded correctly,
 * then sharp to resize/convert to required formats.
 *
 * Run: pnpm --filter @colophony/api exec tsx ../../scripts/generate-brand-assets.ts
 */

import { chromium } from "playwright";
import sharp from "sharp";
import { join, resolve, dirname } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BRANDING = join(ROOT, "docs/branding");
const APP_DIR = join(ROOT, "apps/web/src/app");
const PUBLIC_DIR = join(ROOT, "apps/web/public");

// Star-only SVG for 16x16 favicon (C is illegible at that size)
const STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="200" height="200">
  <rect width="36" height="36" rx="4" fill="#191c2b"/>
  <path transform="translate(18, 18)"
    d="M 0,-18 C 1,-13 3,-6 4.5,-4.5 C 6,-3 13,-1 18,0 C 13,1 6,3 4.5,4.5 C 3,6 1,13 0,18 C -1,13 -3,6 -4.5,4.5 C -6,3 -13,1 -18,0 C -13,-1 -6,-3 -4.5,-4.5 C -3,-6 -1,-13 0,-18 Z"
    fill="#c87941"/>
</svg>`;

async function renderSvgToPng(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  svgContent: string,
  size: number,
  viewportSize?: number,
): Promise<Buffer> {
  const page = await browser.newPage();
  const vp = viewportSize ?? 200;
  await page.setViewportSize({ width: vp, height: vp });

  // Load SVG as data URL so Google Fonts @import works
  const dataUrl = `data:text/html,<!DOCTYPE html>
<html><head><style>
  body { margin: 0; padding: 0; overflow: hidden; }
  svg { display: block; width: ${vp}px; height: ${vp}px; }
</style></head><body>${svgContent.replace(/#/g, "%23")}</body></html>`;

  await page.goto(dataUrl, { waitUntil: "networkidle" });
  // Extra wait for font loading
  await page.waitForTimeout(2000);

  const screenshot = await page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: vp, height: vp },
  });
  await page.close();

  // Resize to target
  return Buffer.from(
    await sharp(screenshot)
      .resize(size, size, { fit: "cover" })
      .png()
      .toBuffer(),
  );
}

async function generateIco(png16: Buffer, png32: Buffer): Promise<Buffer> {
  // ICO format: header + directory entries + image data
  // Each image stored as raw RGBA bitmap (BMP without file header)
  const images = [
    {
      size: 16,
      data: await sharp(png16).resize(16, 16).raw().ensureAlpha().toBuffer(),
    },
    {
      size: 32,
      data: await sharp(png32).resize(32, 32).raw().ensureAlpha().toBuffer(),
    },
  ];

  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * images.length;

  // BMP info header is 40 bytes per image
  const bmpHeaderSize = 40;

  let offset = headerSize + dirSize;
  const entries: Buffer[] = [];
  const bitmaps: Buffer[] = [];

  for (const img of images) {
    const w = img.size;
    const h = img.size;
    const bpp = 32;
    const rowSize = w * 4;
    const pixelDataSize = rowSize * h;
    // AND mask: 1 bit per pixel, rows padded to 4 bytes
    const andRowSize = Math.ceil(w / 8);
    const andRowPadded = Math.ceil(andRowSize / 4) * 4;
    const andMaskSize = andRowPadded * h;
    const imageSize = bmpHeaderSize + pixelDataSize + andMaskSize;

    // Directory entry
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(w === 256 ? 0 : w, 0);
    entry.writeUInt8(h === 256 ? 0 : h, 1);
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(bpp, 6);
    entry.writeUInt32LE(imageSize, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);

    // BMP info header (BITMAPINFOHEADER)
    const bmpHeader = Buffer.alloc(bmpHeaderSize);
    bmpHeader.writeUInt32LE(bmpHeaderSize, 0);
    bmpHeader.writeInt32LE(w, 4);
    bmpHeader.writeInt32LE(h * 2, 8); // height * 2 for ICO (includes AND mask)
    bmpHeader.writeUInt16LE(1, 12); // planes
    bmpHeader.writeUInt16LE(bpp, 14);
    bmpHeader.writeUInt32LE(0, 20); // compression
    bmpHeader.writeUInt32LE(pixelDataSize + andMaskSize, 24);

    // Convert RGBA to BGRA and flip vertically (BMP is bottom-up)
    const pixelData = Buffer.alloc(pixelDataSize);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = (y * w + x) * 4;
        const dstIdx = ((h - 1 - y) * w + x) * 4;
        pixelData[dstIdx + 0] = img.data[srcIdx + 2]; // B
        pixelData[dstIdx + 1] = img.data[srcIdx + 1]; // G
        pixelData[dstIdx + 2] = img.data[srcIdx + 0]; // R
        pixelData[dstIdx + 3] = img.data[srcIdx + 3]; // A
      }
    }

    // AND mask (all zeros = fully opaque, since we have alpha channel)
    const andMask = Buffer.alloc(andMaskSize);

    bitmaps.push(Buffer.concat([bmpHeader, pixelData, andMask]));
    offset += imageSize;
  }

  // ICO header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: ICO
  header.writeUInt16LE(images.length, 4);

  return Buffer.concat([header, ...entries, ...bitmaps]);
}

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch();

  const logomarkDarkSvg = await readFile(
    join(BRANDING, "colophony-logomark-dark.svg"),
    "utf-8",
  );

  console.log("Rendering star-only 16x16...");
  const star16 = await renderSvgToPng(browser, STAR_SVG, 16, 200);

  console.log("Rendering logomark 32x32...");
  const logo32 = await renderSvgToPng(browser, logomarkDarkSvg, 32);

  console.log("Rendering logomark 180x180 (apple-icon)...");
  const logo180 = await renderSvgToPng(browser, logomarkDarkSvg, 180);

  console.log("Rendering logomark 192x192...");
  const logo192 = await renderSvgToPng(browser, logomarkDarkSvg, 192);

  console.log("Rendering logomark 512x512...");
  const logo512 = await renderSvgToPng(browser, logomarkDarkSvg, 512);

  await browser.close();

  console.log("Generating favicon.ico...");
  const ico = await generateIco(star16, logo32);

  console.log("Writing files...");
  await Promise.all([
    writeFile(join(APP_DIR, "favicon.ico"), ico),
    writeFile(join(APP_DIR, "apple-icon.png"), logo180),
    writeFile(join(PUBLIC_DIR, "icons/icon-192.png"), logo192),
    writeFile(join(PUBLIC_DIR, "icons/icon-512.png"), logo512),
  ]);

  console.log("Done! Generated:");
  console.log("  apps/web/src/app/favicon.ico (star@16 + logomark@32)");
  console.log("  apps/web/src/app/apple-icon.png (180x180)");
  console.log("  apps/web/public/icons/icon-192.png");
  console.log("  apps/web/public/icons/icon-512.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
