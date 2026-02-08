import sharp from 'sharp';
import { writeFileSync } from 'fs';

// aim.camp Player Agent — layers icon on transparent background
const makeSvg = (size, color = '#84cc16', glow = '#22d3ee') => `
<svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- layers icon centered on transparent bg -->
  <g transform="translate(8,10) scale(2)" filter="url(#glow)">
    <polygon points="12,2 2,7 12,12 22,7" fill="none" stroke="${color}" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="2,17 12,22 22,17" fill="none" stroke="${glow}" stroke-width="1.6"
              stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
    <polyline points="2,12 12,17 22,12" fill="none" stroke="${color}" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
  </g>
</svg>`;

async function main() {
  const dir = 'src-tauri/icons';

  // 32x32 PNG
  await sharp(Buffer.from(makeSvg(32)))
    .resize(32, 32)
    .png()
    .toFile(`${dir}/32x32.png`);

  // 128x128 PNG
  await sharp(Buffer.from(makeSvg(128)))
    .resize(128, 128)
    .png()
    .toFile(`${dir}/128x128.png`);

  // For ICO: generate 16, 32, 48, 256 sizes and combine
  const sizes = [16, 32, 48, 256];
  const pngBuffers = [];

  for (const s of sizes) {
    const buf = await sharp(Buffer.from(makeSvg(s)))
      .resize(s, s)
      .png()
      .toBuffer();
    pngBuffers.push({ size: s, buf });
  }

  // Build ICO file (simple uncompressed format with PNG entries)
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;
  let offset = headerSize + dirSize;

  // ICO header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type: ICO
  header.writeUInt16LE(numImages, 4);

  // Directory entries
  const dirEntries = Buffer.alloc(dirSize);
  for (let i = 0; i < numImages; i++) {
    const { size, buf } = pngBuffers[i];
    const o = i * dirEntrySize;
    dirEntries.writeUInt8(size < 256 ? size : 0, o);     // width
    dirEntries.writeUInt8(size < 256 ? size : 0, o + 1);  // height
    dirEntries.writeUInt8(0, o + 2);       // color palette
    dirEntries.writeUInt8(0, o + 3);       // reserved
    dirEntries.writeUInt16LE(1, o + 4);    // color planes
    dirEntries.writeUInt16LE(32, o + 6);   // bits per pixel
    dirEntries.writeUInt32LE(buf.length, o + 8);   // data size
    dirEntries.writeUInt32LE(offset, o + 12);      // data offset
    offset += buf.length;
  }

  const ico = Buffer.concat([
    header,
    dirEntries,
    ...pngBuffers.map(p => p.buf)
  ]);

  writeFileSync(`${dir}/icon.ico`, ico);

  console.log('Icons generated:');
  console.log('  32x32.png, 128x128.png, icon.ico');
}

main().catch(console.error);
