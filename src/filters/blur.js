// Box blur (3-pass approximates Gaussian).
import { ctxOf, putImageData } from './_common.js';

function boxBlurChannel(data, W, H, radius, channel) {
  if (radius <= 0) return;
  const tmp = new Float32Array(W * H);
  const r = radius | 0;
  const k = 1 / (2 * r + 1);
  // horizontal
  for (let y = 0; y < H; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) {
      const xc = Math.max(0, Math.min(W - 1, x));
      sum += data[(y * W + xc) * 4 + channel];
    }
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = sum * k;
      const xAdd = Math.min(W - 1, x + r + 1);
      const xSub = Math.max(0, x - r);
      sum += data[(y * W + xAdd) * 4 + channel] - data[(y * W + xSub) * 4 + channel];
    }
  }
  // vertical
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) {
      const yc = Math.max(0, Math.min(H - 1, y));
      sum += tmp[yc * W + x];
    }
    for (let y = 0; y < H; y++) {
      data[(y * W + x) * 4 + channel] = sum * k;
      const yAdd = Math.min(H - 1, y + r + 1);
      const ySub = Math.max(0, y - r);
      sum += tmp[yAdd * W + x] - tmp[ySub * W + x];
    }
  }
}

export default {
  id: 'blur',
  name: 'Blur',
  group: 'blur',
  notes: 'Box blur. 3 passes approximates a Gaussian.',
  defaults: { radius: 4, passes: 2 },
  controls: [
    { key: 'radius', label: 'RADIUS PX', type: 'range', min: 0, max: 30, step: 1, pixelScale: 'distance' },
    { key: 'passes', label: 'PASSES',    type: 'range', min: 1, max: 4, step: 1 }
  ],
  apply(src, dst, params) {
    const { radius, passes } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const img = sctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let p = 0; p < passes; p++) {
      for (let c = 0; c < 3; c++) boxBlurChannel(d, W, H, radius, c);
    }
    // Lock alpha to 255
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    putImageData(dst, img);
  }
};
