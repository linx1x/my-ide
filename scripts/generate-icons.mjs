/**
 * Generates PNG icons for PWA / iOS home screen from the favicon SVG.
 * Run: node scripts/generate-icons.mjs
 * Requires: npm install -g sharp  OR  npx sharp-cli (handled below)
 *
 * Falls back to a hand-crafted minimal PNG if sharp is unavailable.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dir, '../src/dashboard/client/public/icons');
mkdirSync(outDir, { recursive: true });

// Try sharp first (fast, high quality)
let sharp;
try { ({ default: sharp } = await import('sharp')); } catch { /* not installed */ }

const SVG_SRC = join(__dir, '../src/dashboard/client/public/favicon.svg');

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

if (sharp) {
  for (const { name, size } of sizes) {
    await sharp(SVG_SRC).resize(size, size).png().toFile(join(outDir, name));
    console.log(`✓ ${name}`);
  }
} else {
  // Minimal PNG fallback: solid #0B0F14 square with white ⌥ glyph drawn via pure bytes.
  // Uses a tiny canvas-free approach: encode a 1×1 PNG scaled via metadata trick.
  // For a real project, install sharp. This produces a solid-colour placeholder.
  console.warn('sharp not found — writing solid-colour placeholder PNGs.');
  console.warn('Run: npm install sharp  and re-run this script for proper icons.');

  // Hand-crafted 1×1 dark-background PNG (will appear as solid colour square)
  // Real icon generation requires sharp or canvas — this is just a valid placeholder.
  const { createCanvas: cc } = await import('canvas').catch(() => ({ createCanvas: null }));
  if (cc) {
    for (const { name, size } of sizes) {
      const canvas = cc(size, size);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0B0F14';
      ctx.fillRect(0, 0, size, size);
      // Draw white code-bracket glyph
      const pad = size * 0.2;
      const s = size - pad * 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = size * 0.07;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Left bracket <
      ctx.beginPath();
      ctx.moveTo(pad + s * 0.32, pad + s * 0.2);
      ctx.lineTo(pad + s * 0.12, pad + s * 0.5);
      ctx.lineTo(pad + s * 0.32, pad + s * 0.8);
      ctx.stroke();
      // Right bracket >
      ctx.beginPath();
      ctx.moveTo(pad + s * 0.68, pad + s * 0.2);
      ctx.lineTo(pad + s * 0.88, pad + s * 0.5);
      ctx.lineTo(pad + s * 0.68, pad + s * 0.8);
      ctx.stroke();
      // Underscore / slash
      ctx.beginPath();
      ctx.moveTo(pad + s * 0.42, pad + s * 0.72);
      ctx.lineTo(pad + s * 0.58, pad + s * 0.28);
      ctx.stroke();
      const buf = canvas.toBuffer('image/png');
      writeFileSync(join(outDir, name), buf);
      console.log(`✓ ${name} (canvas)`);
    }
  } else {
    console.error('Neither sharp nor canvas is available. Add the icons manually.');
    process.exit(1);
  }
}

console.log('Icons written to', outDir);
