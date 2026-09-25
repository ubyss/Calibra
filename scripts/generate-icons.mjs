import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outputDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
const sizes = [16, 32, 48, 128];
const supersampling = 4;

const gradientStart = [124, 124, 240];
const gradientEnd = [72, 64, 196];

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function roundedRectDistance(x, y, radius) {
  const qx = Math.abs(x - 0.5) - (0.5 - radius);
  const qy = Math.abs(y - 0.5) - (0.5 - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function samplePixel(x, y) {
  if (roundedRectDistance(x, y, 0.24) > 0) {
    return null;
  }

  const ringDistance = Math.abs(Math.hypot(x - 0.5, y - 0.5) - 0.27);
  const isRing = ringDistance < 0.045;
  const isHand =
    segmentDistance(x, y, 0.5, 0.5, 0.5, 0.33) < 0.035 || segmentDistance(x, y, 0.5, 0.5, 0.62, 0.58) < 0.035;

  if (isRing || isHand) {
    return [255, 255, 255];
  }

  const t = (x + y) / 2;
  return gradientStart.map((start, index) => Math.round(start + (gradientEnd[index] - start) * t));
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const samplesPerPixel = supersampling * supersampling;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let coverage = 0;

      for (let sy = 0; sy < supersampling; sy++) {
        for (let sx = 0; sx < supersampling; sx++) {
          const color = samplePixel((px + (sx + 0.5) / supersampling) / size, (py + (sy + 0.5) / supersampling) / size);
          if (color) {
            red += color[0];
            green += color[1];
            blue += color[2];
            coverage++;
          }
        }
      }

      const offset = (py * size + px) * 4;
      if (coverage > 0) {
        rgba[offset] = Math.round(red / coverage);
        rgba[offset + 1] = Math.round(green / coverage);
        rgba[offset + 2] = Math.round(blue / coverage);
        rgba[offset + 3] = Math.round((coverage / samplesPerPixel) * 255);
      }
    }
  }

  return encodePng(size, rgba);
}

mkdirSync(outputDir, { recursive: true });
for (const size of sizes) {
  writeFileSync(resolve(outputDir, `icon-${size}.png`), renderIcon(size));
}
console.log(`Ícones gerados em ${outputDir}`);
