import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(size, bgHex, text) {
  // Simple uncompressed or deflate PNG generator
  const width = size;
  const height = size;

  // RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);

  const r = parseInt(bgHex.slice(1, 3), 16);
  const g = parseInt(bgHex.slice(3, 5), 16);
  const b = parseInt(bgHex.slice(5, 7), 16);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Draw rounded rectangle background
      const radius = size * 0.2;
      const dx = Math.max(0, Math.abs(x - width / 2) - (width / 2 - radius));
      const dy = Math.max(0, Math.abs(y - height / 2) - (height / 2 - radius));
      const isCorner = Math.sqrt(dx * dx + dy * dy) > radius;

      if (isCorner) {
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      } else {
        // Subtle gradient
        const factor = 1 - (y / height) * 0.25;
        buffer[idx] = Math.round(r * factor);
        buffer[idx + 1] = Math.round(g * factor);
        buffer[idx + 2] = Math.round(b * factor);
        buffer[idx + 3] = 255;

        // Draw inner TV / screen icon
        const tvW = width * 0.55;
        const tvH = height * 0.38;
        const tvX1 = (width - tvW) / 2;
        const tvX2 = tvX1 + tvW;
        const tvY1 = height * 0.25;
        const tvY2 = tvY1 + tvH;

        const border = Math.max(3, Math.round(size * 0.035));
        const inTvBorder = (x >= tvX1 && x <= tvX2 && y >= tvY1 && y <= tvY2) &&
          (x < tvX1 + border || x > tvX2 - border || y < tvY1 + border || y > tvY2 - border);

        // TV stand
        const standX1 = width * 0.44;
        const standX2 = width * 0.56;
        const standY1 = tvY2;
        const standY2 = tvY2 + height * 0.08;
        const baseW = width * 0.35;
        const baseX1 = (width - baseW) / 2;
        const baseX2 = baseX1 + baseW;
        const baseY1 = standY2;
        const baseY2 = standY2 + height * 0.03;

        const inStand = (x >= standX1 && x <= standX2 && y >= standY1 && y <= standY2) ||
                        (x >= baseX1 && x <= baseX2 && y >= baseY1 && y <= baseY2);

        // Play triangle inside TV
        const triX1 = width * 0.45;
        const triX2 = width * 0.58;
        const triYCenter = (tvY1 + tvY2) / 2;
        const triH = height * 0.12;

        let inTri = false;
        if (x >= triX1 && x <= triX2) {
          const prog = (x - triX1) / (triX2 - triX1);
          const maxDiff = (triH / 2) * (1 - prog);
          if (Math.abs(y - triYCenter) <= maxDiff) {
            inTri = true;
          }
        }

        if (inTvBorder || inStand || inTri) {
          buffer[idx] = 255;
          buffer[idx + 1] = 255;
          buffer[idx + 2] = 255;
          buffer[idx + 3] = 255;
        }
      }
    }
  }

  // Build PNG chunk format
  const rawScanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    rawScanlines[y * (width * 4 + 1)] = 0; // Filter byte: None
    buffer.copy(rawScanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const deflated = zlib.deflateSync(rawScanlines);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const png = Buffer.concat([
    header,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0))
  ]);

  return png;
}

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate PWA icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, '#0f172a', 'M'));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, '#0f172a', 'M'));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, '#0f172a', 'M'));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, '#0f172a', 'M'));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="100" fill="#0f172a"/>
  <rect x="70" y="90" width="372" height="240" rx="16" stroke="#38bdf8" stroke-width="20" fill="#1e293b"/>
  <rect x="226" y="330" width="60" height="50" fill="#38bdf8"/>
  <rect x="156" y="380" width="200" height="24" rx="8" fill="#38bdf8"/>
  <polygon points="230,165 315,210 230,255" fill="#38bdf8"/>
  <circle cx="120" cy="140" r="10" fill="#22c55e"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svg);
console.log('Icons generated successfully.');
