import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const sourcePngPath = path.join(repoRoot, "src", "renderer", "assets", "brand", "coder-logo-dark.png");
const buildDirectory = path.join(repoRoot, "build");
const generatedDirectory = path.join(buildDirectory, "generated-icons");

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icnsEntries = [
  ["icp4", 16],
  ["icp5", 32],
  ["icp6", 64],
  ["ic07", 128],
  ["ic08", 256],
  ["ic09", 512],
  ["ic10", 1024]
];

await mkdir(generatedDirectory, { recursive: true });

const sourcePng = await readFile(sourcePngPath);
const sourceDataUri = `data:image/png;base64,${sourcePng.toString("base64")}`;
await writeFile(
  path.join(buildDirectory, "icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><image href="${sourceDataUri}" width="1024" height="1024" preserveAspectRatio="xMidYMid meet"/></svg>`,
  "utf8"
);

const browser = await chromium.launch({ headless: true });

try {
  const pngs = new Map();

  for (const size of Array.from(new Set([...icoSizes, ...icnsEntries.map((entry) => entry[1])])).sort((a, b) => a - b)) {
    const png = await renderPng(size, sourceDataUri);
    pngs.set(size, png);
  }

  await writeFile(path.join(buildDirectory, "icon.png"), pngs.get(1024));
  await writeFile(path.join(buildDirectory, "icon.ico"), createIco(icoSizes.map((size) => pngs.get(size))));
  await writeFile(
    path.join(buildDirectory, "icon.icns"),
    createIcns(icnsEntries.map(([type, size]) => ({ type, png: pngs.get(size) })))
  );
} finally {
  await browser.close();
  await rm(generatedDirectory, { recursive: true, force: true });
}

async function renderPng(size, dataUri) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const outputPath = path.join(generatedDirectory, `icon-${size}.png`);

  await page.setContent(
    `<!doctype html>
    <html>
      <head>
        <style>
          html,
          body {
            width: ${size}px;
            height: ${size}px;
            margin: 0;
            overflow: hidden;
            background: transparent;
          }

          img {
            width: ${size}px;
            height: ${size}px;
            display: block;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <img src="${dataUri}" alt="">
      </body>
    </html>`
  );

  await page.locator("img").evaluate((image) => image.decode());
  await page.screenshot({
    path: outputPath,
    clip: { x: 0, y: 0, width: size, height: size },
    omitBackground: true
  });
  await page.close();

  return readFile(outputPath);
}

function createIco(images) {
  const headerSize = 6;
  const directorySize = images.length * 16;
  let offset = headerSize + directorySize;
  const header = Buffer.alloc(headerSize + directorySize);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  images.forEach((image, index) => {
    const size = icoSizes[index];
    const entryOffset = headerSize + index * 16;

    header.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(image.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);

    offset += image.length;
  });

  return Buffer.concat([header, ...images]);
}

function createIcns(entries) {
  const chunks = entries.map(({ type, png }) => {
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, "ascii");
    header.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([header, png]);
  });
  const header = Buffer.alloc(8);
  const totalLength = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);

  header.write("icns", 0, 4, "ascii");
  header.writeUInt32BE(totalLength, 4);

  return Buffer.concat([header, ...chunks]);
}
