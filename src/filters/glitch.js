// Datamosh / glitch: scanline displacement, color stripe corruption,
// occasional block swaps. Deterministic via seed.
import { ctxOf, putImageData } from './_common.js';
import { mulberry32 } from '../utils/image.js';

export default {
  id: 'glitch',
  name: 'Glitch',
  group: 'experimental',
  notes: 'Scanline displacement + block swaps + channel corruption.',
  defaults: { intensity: 0.4, blocks: 12, seed: 42 },
  controls: [
    { key: 'intensity', label: 'INTENSITY', type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'blocks',    label: 'BLOCK SWAPS', type: 'range', min: 0, max: 60, step: 1 },
    { key: 'seed',      label: 'SEED', type: 'range', min: 1, max: 99999, step: 1 }
  ],
  apply(src, dst, params) {
    const { intensity, blocks, seed } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const dctx = ctxOf(dst);
    // Start from a copy of the source
    dctx.drawImage(src, 0, 0);

    const rng = mulberry32(seed);
    // Scanline displacement: divide image into N horizontal bands; shift each randomly.
    const bands = Math.max(1, Math.round(H / 8));
    for (let b = 0; b < bands; b++) {
      if (rng() > intensity) continue;
      const y = Math.floor((b / bands) * H);
      const hh = Math.max(1, Math.floor(H / bands));
      const shift = Math.round((rng() - 0.5) * 2 * intensity * W * 0.25);
      // Move a horizontal stripe by `shift` pixels
      const stripe = sctx.getImageData(0, y, W, hh);
      dctx.clearRect(0, y, W, hh);
      // Place shifted
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = hh;
      tmp.getContext('2d').putImageData(stripe, 0, 0);
      dctx.drawImage(tmp, shift, y);
      // Wrap-around for the gap
      if (shift > 0) dctx.drawImage(tmp, shift - W, y);
      else if (shift < 0) dctx.drawImage(tmp, shift + W, y);
    }

    // Color channel corruption: yank random horizontal strips in just one channel.
    const corruptImg = dctx.getImageData(0, 0, W, H);
    const cd = corruptImg.data;
    const corrupts = Math.floor(intensity * 30);
    for (let i = 0; i < corrupts; i++) {
      const y0 = Math.floor(rng() * H);
      const hh = Math.max(1, Math.floor(rng() * 6));
      const ch = Math.floor(rng() * 3);
      const tint = Math.floor(rng() * 256);
      for (let y = y0; y < Math.min(H, y0 + hh); y++) {
        for (let x = 0; x < W; x++) {
          cd[(y * W + x) * 4 + ch] = tint;
        }
      }
    }
    dctx.putImageData(corruptImg, 0, 0);

    // Block swaps
    for (let i = 0; i < blocks; i++) {
      const bw = 20 + Math.floor(rng() * 100);
      const bh = 10 + Math.floor(rng() * 40);
      const x1 = Math.floor(rng() * (W - bw));
      const y1 = Math.floor(rng() * (H - bh));
      const x2 = Math.floor(rng() * (W - bw));
      const y2 = Math.floor(rng() * (H - bh));
      const a = sctx.getImageData(x1, y1, bw, bh);
      const b = dctx.getImageData(x2, y2, bw, bh);
      dctx.putImageData(a, x2, y2);
      dctx.putImageData(b, x1, y1);
    }
  }
};
