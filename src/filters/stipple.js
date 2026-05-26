// Stipple: jittered dots whose density is set by local darkness.
import { ctxOf, luminance } from './_common.js';
import { mulberry32 } from '../utils/image.js';

export default {
  id: 'stipple',
  name: 'Stipple',
  group: 'halftone',
  notes: 'Pseudo-random dot density. Reproducible via seed.',
  defaults: { density: 0.6, dotSize: 1.4, seed: 1337, bg: '#f5f1e8', fg: '#0a0a0a' },
  controls: [
    { key: 'density', label: 'DENSITY', type: 'range', min: 0.05, max: 2, step: 0.05 },
    { key: 'dotSize', label: 'DOT SIZE', type: 'range', min: 0.5, max: 5, step: 0.1, pixelScale: 'distance' },
    { key: 'seed',    label: 'SEED', type: 'range', min: 1, max: 99999, step: 1 },
    { key: 'bg', label: 'PAPER', type: 'color' },
    { key: 'fg', label: 'INK',   type: 'color' }
  ],
  apply(src, dst, params) {
    const { density, dotSize, seed, bg, fg } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const dctx = ctxOf(dst);
    const data = sctx.getImageData(0, 0, W, H).data;

    dctx.fillStyle = bg;
    dctx.fillRect(0, 0, W, H);
    dctx.fillStyle = fg;

    const rng = mulberry32(seed);
    // Target dot count: density * (W*H / 50). Cap for huge images.
    const total = Math.min(2_000_000, Math.floor(density * (W * H) / 50));
    for (let i = 0; i < total; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const idx = ((y | 0) * W + (x | 0)) * 4;
      const lum = luminance(data[idx], data[idx + 1], data[idx + 2]) / 255;
      // Probability of placing a dot grows as lum drops (dark = more dots).
      if (rng() > (1 - lum)) continue;
      dctx.beginPath();
      dctx.arc(x, y, dotSize, 0, Math.PI * 2);
      dctx.fill();
    }
  }
};
