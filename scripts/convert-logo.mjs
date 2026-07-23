import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import toIco from 'to-ico';

const lightLogoPath = path.resolve('new-logo-light.png');  // For dark mode (light logo)
const darkLogoPath = path.resolve('new-logo-dark.png');    // For light mode (dark logo)
const buildDir = path.resolve('build');

async function convertLogo() {
  const lightMeta = await sharp(lightLogoPath).metadata();
  const darkMeta = await sharp(darkLogoPath).metadata();
  console.log(`Light logo (for dark mode): ${lightMeta.width}x${lightMeta.height}, ${lightMeta.channels} channels, ${lightMeta.format}`);
  console.log(`Dark logo (for light mode): ${darkMeta.width}x${darkMeta.height}, ${darkMeta.channels} channels, ${darkMeta.format}`);

  // Create build directory if it doesn't exist
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // 1. Create PNG (1024x1024) - for Linux and general use (use dark logo as default app icon)
  await sharp(darkLogoPath)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(buildDir, 'icon.png'));
  console.log('Created build/icon.png (1024x1024) - dark logo as default');

  // 2. Create multi-size ICO for Windows (16, 32, 48, 256) - use dark logo
  const icoSizes = [16, 32, 48, 256];
  const pngBuffers = await Promise.all(
    icoSizes.map(size =>
      sharp(darkLogoPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );
  const icoBuffer = await toIco(pngBuffers);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
  console.log('Created build/icon.ico (multi-size: 16, 32, 48, 256) - dark logo');

  // 3. Create ICNS placeholder and iconset for macOS - use dark logo
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
    await sharp(darkLogoPath)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(icnsDir, name));
  }
  console.log('Created build/icon.iconset with all required sizes (macOS CI will convert to .icns) - dark logo');

  // Create placeholder ICNS for local Windows builds
  await sharp(darkLogoPath)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(buildDir, 'icon.icns'));
  console.log('Created build/icon.icns (placeholder - macOS CI will replace) - dark logo');

  // 4. Create renderer assets (light/dark variants)
  const rendererAssetsDir = path.resolve('src/renderer/assets/brand');

  // Light version (for dark backgrounds) - use the light logo
  await sharp(lightLogoPath)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(rendererAssetsDir, 'coder-logo-light.png'));
  console.log('Created src/renderer/assets/brand/coder-logo-light.png (light logo for dark mode)');

  // Dark version (for light backgrounds) - use the dark logo
  await sharp(darkLogoPath)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(rendererAssetsDir, 'coder-logo-dark.png'));
  console.log('Created src/renderer/assets/brand/coder-logo-dark.png (dark logo for light mode)');

  // Create coder-logo.png (standard version - dark logo as default)
  await sharp(darkLogoPath)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(rendererAssetsDir, 'coder-logo.png'));
  console.log('Created src/renderer/assets/brand/coder-logo.png (dark logo as default)');

  // 5. Update coder-mark.svg and .png (smaller mark version) - use dark logo
  await sharp(darkLogoPath)
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(rendererAssetsDir, 'coder-mark.png'));
  
  const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <image href="data:image/png;base64,${fs.readFileSync(path.join(rendererAssetsDir, 'coder-mark.png')).toString('base64')}" width="128" height="128"/>
</svg>`;
  fs.writeFileSync(path.join(rendererAssetsDir, 'coder-mark.svg'), markSvg);
  console.log('Created src/renderer/assets/brand/coder-mark.svg and .png');

  // 6. Create SVG wrapper for coder-logo.svg (dark logo)
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <image href="data:image/png;base64,${fs.readFileSync(path.join(rendererAssetsDir, 'coder-logo.png')).toString('base64')}" width="512" height="512"/>
</svg>`;
  fs.writeFileSync(path.join(rendererAssetsDir, 'coder-logo.svg'), logoSvg);
  console.log('Created src/renderer/assets/brand/coder-logo.svg');

  // 7. Also create light version of coder-mark for potential future use
  await sharp(lightLogoPath)
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(rendererAssetsDir, 'coder-mark-light.png'));
  console.log('Created src/renderer/assets/brand/coder-mark-light.png (light mark for dark mode)');

  console.log('\nAll logo assets created successfully!');
}

convertLogo().catch(console.error);