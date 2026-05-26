// Chromatic aberration / RGB channel shift.
import { ctxOf, putImageData } from './_common.js';

export default {
  id: 'rgbShift',
  name: 'RGB Shift',
  group: 'experimental',
  notes: 'Independent channel offsets. Crank up for chromatic-aberration glitch.',
  defaults: { rx: 6, ry: 0, gx: 0, gy: 0, bx: -6, by: 0 },
  controls: [
    { key: 'rx', label: 'R X', type: 'range', min: -40, max: 40, step: 1, pixelScale: 'distance' },
    { key: 'ry', label: 'R Y', type: 'range', min: -40, max: 40, step: 1, pixelScale: 'distance' },
    { key: 'gx', label: 'G X', type: 'range', min: -40, max: 40, step: 1, pixelScale: 'distance' },
    { key: 'gy', label: 'G Y', type: 'range', min: -40, max: 40, step: 1, pixelScale: 'distance' },
    { key: 'bx', label: 'B X', type: 'range', min: -40, max: 40, step: 1, pixelScale: 'distance' },
    { key: 'by', label: 'B Y', type: 'range', min: -40, max: 40, step: 1, pixelScale: 'distance' }
  ],
  apply(src, dst, params) {
    const { rx, ry, gx, gy, bx, by } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const d = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const o = out.data;

    function sample(x, y, ch) {
      const cx = Math.max(0, Math.min(W - 1, x));
      const cy = Math.max(0, Math.min(H - 1, y));
      return d[(cy * W + cx) * 4 + ch];
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        o[i]     = sample(x - rx, y - ry, 0);
        o[i + 1] = sample(x - gx, y - gy, 1);
        o[i + 2] = sample(x - bx, y - by, 2);
        o[i + 3] = 255;
      }
    }
    putImageData(dst, out);
  }
};
