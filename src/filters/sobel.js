// Sobel edge detection. Gradient magnitude → grayscale or 2-color edges.
import { ctxOf, putImageData, luminance, clamp } from './_common.js';

export default {
  id: 'sobel',
  name: 'Sobel Edges',
  group: 'edges',
  notes: '3×3 Sobel kernel. Threshold isolates strong edges; invert flips bg/fg.',
  defaults: { threshold: 60, invert: false, bg: '#ffffff', fg: '#000000' },
  controls: [
    { key: 'threshold', label: 'THRESHOLD', type: 'range', min: 0, max: 255, step: 1 },
    { key: 'invert',    label: 'INVERT', type: 'toggle', options: [
      { value: false, label: 'OFF' }, { value: true, label: 'ON' }
    ]},
    { key: 'bg', label: 'BG', type: 'color' },
    { key: 'fg', label: 'EDGE', type: 'color' }
  ],
  apply(src, dst, params) {
    const { threshold, invert, bg, fg } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;

    // greyscale
    const grey = new Uint8ClampedArray(W * H);
    for (let i = 0, j = 0; j < grey.length; i += 4, j++) {
      grey[j] = luminance(sd[i], sd[i + 1], sd[i + 2]);
    }

    const bgRGB = hexToRgb(bg);
    const fgRGB = hexToRgb(fg);

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const tl = grey[i - W - 1], tc = grey[i - W], tr = grey[i - W + 1];
        const ml = grey[i - 1],                     mr = grey[i + 1];
        const bl = grey[i + W - 1], bc = grey[i + W], br = grey[i + W + 1];
        const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
        const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
        const mag = Math.sqrt(gx * gx + gy * gy);
        const on = mag >= threshold;
        const isEdge = invert ? !on : on;
        const di = i * 4;
        const c = isEdge ? fgRGB : bgRGB;
        od[di] = c[0]; od[di + 1] = c[1]; od[di + 2] = c[2]; od[di + 3] = 255;
      }
    }
    // Fill border with bg
    const borderColor = invert ? fgRGB : bgRGB;
    for (let x = 0; x < W; x++) {
      for (const y of [0, H - 1]) {
        const di = (y * W + x) * 4;
        od[di] = borderColor[0]; od[di + 1] = borderColor[1]; od[di + 2] = borderColor[2]; od[di + 3] = 255;
      }
    }
    for (let y = 0; y < H; y++) {
      for (const x of [0, W - 1]) {
        const di = (y * W + x) * 4;
        od[di] = borderColor[0]; od[di + 1] = borderColor[1]; od[di + 2] = borderColor[2]; od[di + 3] = 255;
      }
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
