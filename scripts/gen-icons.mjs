// One-off generator for the PWA icons (public/icon-192.png, icon-512.png).
// Draws a rounded dark square with a blocky "E" in the accent color.
// Run with: node scripts/gen-icons.mjs   (requires pngjs available)
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

const BG = [15, 23, 42, 255]; // #0f172a
const FG = [37, 99, 235, 255]; // #2563eb

function make(size, out) {
  const png = new PNG({ width: size, height: size });
  const radius = size * 0.18;

  const set = (x, y, c) => {
    const i = (size * y + x) << 2;
    png.data[i] = c[0];
    png.data[i + 1] = c[1];
    png.data[i + 2] = c[2];
    png.data[i + 3] = c[3];
  };

  // rounded-rect test: clamp the point to the inner rect (inset by radius),
  // then keep pixels within `radius` of that clamped point.
  const inRounded = (x, y) => {
    const r = radius;
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  };

  // "E" geometry, kept within the central safe zone for maskable icons.
  const x0 = size * 0.32, x1 = size * 0.68;
  const y0 = size * 0.28, y1 = size * 0.72;
  const stem = size * 0.09, bar = size * 0.09;
  const midW = (x1 - x0) * 0.72;
  const inE = (x, y) => {
    if (x >= x0 && x <= x0 + stem && y >= y0 && y <= y1) return true; // vertical
    if (y >= y0 && y <= y0 + bar && x >= x0 && x <= x1) return true; // top
    if (y >= (y0 + y1) / 2 - bar / 2 && y <= (y0 + y1) / 2 + bar / 2 && x >= x0 && x <= x0 + midW) return true; // middle
    if (y >= y1 - bar && y <= y1 && x >= x0 && x <= x1) return true; // bottom
    return false;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRounded(x, y)) {
        set(x, y, [0, 0, 0, 0]); // transparent outside rounded square
      } else if (inE(x, y)) {
        set(x, y, FG);
      } else {
        set(x, y, BG);
      }
    }
  }

  writeFileSync(out, PNG.sync.write(png));
  console.log('wrote', out);
}

make(192, new URL('../public/icon-192.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
make(512, new URL('../public/icon-512.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
