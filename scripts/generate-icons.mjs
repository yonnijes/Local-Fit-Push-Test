#!/usr/bin/env node
/**
 * Genera los iconos PNG de la PWA sin dependencias externas.
 * Uso: node scripts/generate-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'apps', 'web', 'public', 'icons');
const PUBLIC_DIR = join(ROOT, 'apps', 'web', 'public');

const SAMPLES = 3;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let row = 0; row < height; row += 1) {
    const offset = row * (stride + 1);
    raw[offset] = 0;
    rgba.copy(raw, offset + 1, row * stride, (row + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const mix = (from, to, amount) => from + (to - from) * amount;

function sampleScene(u, v, glyphScale) {
  // Fondo: degradado diagonal azul noche.
  const diagonal = clamp01(u * 0.55 + v * 0.75);
  let r = mix(9, 22, diagonal);
  let g = mix(16, 38, diagonal);
  let b = mix(30, 74, diagonal);

  // Resplandor cian en la esquina superior derecha.
  const glow = Math.max(0, 1 - Math.hypot(u - 0.84, v - 0.1) / 0.72);
  r += glow * 8;
  g += glow * 34;
  b += glow * 36;

  // Glifo: punto + tres ondas de señal.
  const centerX = 0.5;
  const centerY = 0.665;
  const scaledX = (u - centerX) / glyphScale;
  const scaledY = (v - centerY) / glyphScale;
  const distance = Math.hypot(scaledX, scaledY);
  const angle = Math.atan2(scaledY, scaledX);
  const inUpperArc = angle >= -2.62 && angle <= -0.52;

  const dotRadius = 0.062;
  const arcRadii = [0.155, 0.245, 0.335];
  const arcThickness = 0.036;

  let glyphAmount = 0;

  if (distance <= dotRadius) {
    glyphAmount = 1;
  } else if (inUpperArc) {
    for (const radius of arcRadii) {
      const delta = Math.abs(distance - radius);
      if (delta <= arcThickness) {
        glyphAmount = 1 - Math.pow(delta / arcThickness, 2) * 0.25;
        break;
      }
    }
  }

  if (glyphAmount > 0) {
    const tone = clamp01((distance - 0.1) / 0.3);
    const gr = mix(56, 87, tone);
    const gg = mix(229, 182, tone);
    const gb = mix(200, 255, tone);

    r = mix(r, gr, glyphAmount);
    g = mix(g, gg, glyphAmount);
    b = mix(b, gb, glyphAmount);
  }

  return [r, g, b, 255];
}

function renderIcon(size, glyphScale) {
  const rgba = Buffer.alloc(size * size * 4);
  const inverseSize = 1 / size;
  const totalSamples = SAMPLES * SAMPLES;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const u = (x + (sx + 0.5) / SAMPLES) * inverseSize;
          const v = (y + (sy + 0.5) / SAMPLES) * inverseSize;
          const pixel = sampleScene(u, v, glyphScale);
          r += pixel[0];
          g += pixel[1];
          b += pixel[2];
        }
      }

      const offset = (y * size + x) * 4;
      rgba[offset] = Math.round(r / totalSamples);
      rgba[offset + 1] = Math.round(g / totalSamples);
      rgba[offset + 2] = Math.round(b / totalSamples);
      rgba[offset + 3] = 255;
    }
  }

  return encodePng(size, size, rgba);
}

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Local Fit Push Test">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a1222"/>
      <stop offset="1" stop-color="#16264a"/>
    </linearGradient>
    <linearGradient id="wave" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#38e5c8"/>
      <stop offset="1" stop-color="#57b6ff"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#bg)"/>
  <g fill="none" stroke="url(#wave)" stroke-linecap="round">
    <path d="M22.9 37 A10.5 10.5 0 0 1 41.1 37" stroke-width="3.6"/>
    <path d="M18.1 34.2 A16 16 0 0 1 45.9 34.2" stroke-width="3.6" opacity="0.86"/>
    <path d="M13.4 31.5 A21.5 21.5 0 0 1 50.6 31.5" stroke-width="3.6" opacity="0.68"/>
  </g>
  <circle cx="32" cy="42.5" r="4" fill="#38e5c8"/>
</svg>
`;

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const icons = [
    ['icon-192.png', 192, 1],
    ['icon-512.png', 512, 1],
    ['maskable-512.png', 512, 0.78],
    ['apple-touch-icon-180.png', 180, 0.9],
    ['apple-touch-icon.png', 180, 0.9],
  ];

  for (const [fileName, size, scale] of icons) {
    writeFileSync(join(OUT_DIR, fileName), renderIcon(size, scale));
    console.log(`✔ icons/${fileName} (${size}×${size})`);
  }

  writeFileSync(join(PUBLIC_DIR, 'favicon.svg'), faviconSvg, 'utf8');
  console.log('✔ favicon.svg');
}

main();
