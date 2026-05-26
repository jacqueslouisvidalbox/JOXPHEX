// Contour lines via Difference-of-Gaussians: subtract a blurred copy from
// a less-blurred copy to extract band-pass edges. Threshold to get clean
// pen-like contours.
import { ctxOf, putImageData, luminance, clamp } from './_common.js';

function boxBlurGrey(grey, W, H, radius) {
  if (radius <= 0) return grey.slice();
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  const r = radius | 0;
  const k = 1 / (2 * r + 1);
  // horizontal
  for (let y = 0; y < H; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += grey[y * W + Math.max(0, Math.min(W - 1, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = sum * k;
      const xAdd = Math.min(W - 1, x + r + 1);
      const xSub = Math.max(0, x - r);
      sum += grey[y * W + xAdd] - grey[y * W + xSub];
    }
  }
  // vertical
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.max(0, Math.min(H - 1, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = sum * k;
      const yAdd = Math.min(H - 1, y + r + 1);
      const ySub = Math.max(0, y - r);
      sum += tmp[yAdd * W + x] - tmp[ySub * W + x];
    }
  }
  return out;
}

export default {
  id: 'contours',
  name: 'Contours',
  group: 'edges',
  notes: 'Difference-of-Gaussians line drawing. Soft, pen-like edges.',
  defaults: {
    fine: 1, coarse: 5, threshold: 6, invert: false,
    bg: '#ffffff', fg: '#000000'
  },
  controls: [
    { key: 'fine',      label: 'FINE BLUR',   type: 'range', min: 0, max: 8,  step: 1, pixelScale: 'distance' },
    { key: 'coarse',    label: 'COARSE BLUR', type: 'range', min: 1, max: 30, step: 1, pixelScale: 'distance' },
    { key: 'threshold', label: 'THRESHOLD',   type: 'range', min: 0, max: 60, step: 1 },
    { key: 'invert',    label: 'INVERT', type: 'toggle', options: [
      { value: false, label: 'OFF' }, { value: true, label: 'ON' }
    ]},
    { key: 'bg', label: 'BG', type: 'color' },
    { key: 'fg', label: 'INK', type: 'color' }
  ],
  apply(src, dst, params) {
    const { fine, coarse, threshold, invert, bg, fg } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;

    const grey = new Float32Array(W * H);
    for (let i = 0, j = 0; j < grey.length; i += 4, j++) {
      grey[j] = luminance(sd[i], sd[i + 1], sd[i + 2]);
    }

    const blurFine = boxBlurGrey(grey, W, H, Math.max(0, fine | 0));
    const blurCoarse = boxBlurGrey(grey, W, H, Math.max(1, coarse | 0));

    const out = sctx.createImageData(W, H);
    const od = out.data;
    const bgRGB = hexToRgb(bg);
    const fgRGB = hexToRgb(fg);

    for (let i = 0; i < W * H; i++) {
      const dog = blurFine[i] - blurCoarse[i]; // band-pass
      let isEdge = dog < -threshold;            // dark sides of edges
      if (invert) isEdge = !isEdge;
      const di = i * 4;
      const c = isEdge ? fgRGB : bgRGB;
      od[di] = c[0]; od[di + 1] = c[1]; od[di + 2] = c[2]; od[di + 3] = 255;
    }
    putImageData(dst, out);
  }
};

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
