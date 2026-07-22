import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputPath = path.resolve('new-logo.png');
const buildDir = path.resolve('build');

async function convertLogo() {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  console.log(`Original logo: ${metadata.width}x${metadata.height}, ${metadata.channels} channels, ${metadata.format}`);

  // Create build directory if it doesn't exist
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // 1. Create PNG (1024x1024) - for Linux and general use
  await sharp(inputPath)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(buildDir, 'icon.png'));
  console.log('Created build/icon.png (1024x1024)');

  // 2. Create ICO (256x256 base - sharp doesn't support multi-size ICO directly)
  await sharp(inputPath)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(path.join(buildDir, 'icon.ico'));
  console.log('Created build/icon.ico (256x256 base)');

  // 3. Create ICNS placeholder and iconset for macOS
  const icnsDir = path.join(buildDir, 'icon.iconset');
  if (!fs.existsSync(icnsDir)) {
    fs.mkdirSync(icnsDir, { recursive: true });
  }

  const icnsSizes = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 },
  ];

  for (const { name, size } of icnsSizes) {
    await sharp(inputPath)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(icnsDir, name));
  }
  console.log('Created build/icon.iconset with all required sizes (macOS CI will convert to .icns)');

  // Create placeholder ICNS for local Windows builds
  await sharp(inputPath)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(buildDir, 'icon.icns'));
  console.log('Created build/icon.icns (placeholder - macOS CI will replace)');

  // 4. Create renderer assets (light/dark variants)
  const rendererAssetsDir = path.resolve('src/renderer/assets/brand');

  // Light version (for dark backgrounds - inverted)
  await sharp(inputPath)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .negate({ alpha: false })
    .png()
    .toFile(path.join(rendererAssetsDir, 'coder-logo-light.png'));
  console.log('Created src/renderer/assets/brand/coder-logo-light.png (inverted for dark mode)');

  // Dark version (for light backgrounds - original)
  await sharp(inputPath)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(rendererAssetsDir, 'coder-logo-dark.png'));
  console.log('Created src/renderer/assets/brand/coder-logo-dark.png (original for light mode)');

  // Create coder-logo.png (standard version - dark)
  await sharp(inputPath)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(rendererAssetsDir, 'coder-logo.png'));
  console.log('Created src/renderer/assets/brand/coder-logo.png');

  // 5. Update coder-mark.svg and .png (smaller mark version)
  await sharp(inputPath)
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(rendererAssetsDir, 'coder-mark.png'));
  
  const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <image href="data:image/png;base64,${fs.readFileSync(path.join(rendererAssetsDir, 'coder-mark.png')).toString('base64')}" width="128" height="128"/>
</svg>`;
  fs.writeFileSync(path.join(rendererAssetsDir, 'coder-mark.svg'), markSvg);
  console.log('Created src/renderer/assets/brand/coder-mark.svg and .png');

  // 6. Create SVG wrapper for coder-logo.svg
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <image href="data:image/png;base64,${fs.readFileSync(path.join(rendererAssetsDir, 'coder-logo.png')).toString('base64')}" width="512" height="512"/>
</svg>`;
  fs.writeFileSync(path.join(rendererAssetsDir, 'coder-logo.svg'), logoSvg);
  console.log('Created src/renderer/assets/brand/coder-logo.svg');

  console.log('\nAll logo assets created successfully!');
}

convertLogo().catch(console.error);