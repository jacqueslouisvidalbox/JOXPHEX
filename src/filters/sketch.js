// Pencil sketch: invert + blur, then color-dodge against the original.
// Classic photo-to-sketch recipe.
import { ctxOf, putImageData, luminance, clamp } from './_common.js';

function boxBlurGrey(grey, W, H, radius) {
  if (radius <= 0) return grey.slice();
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  const r = radius | 0;
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += grey[y * W + Math.max(0, Math.min(W - 1, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = s * k;
      const xA = Math.min(W - 1, x + r + 1), xS = Math.max(0, x - r);
      s += grey[y * W + xA] - grey[y * W + xS];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.max(0, Math.min(H - 1, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = s * k;
      const yA = Math.min(H - 1, y + r + 1), yS = Math.max(0, y - r);
      s += tmp[yA * W + x] - tmp[yS * W + x];
    }
  }
  return out;
}

export default {
  id: 'sketch',
  name: 'Pencil Sketch',
  group: 'stylize',
  notes: 'Color-dodge blend between greyscale and blurred-inverted greyscale.',
  defaults: { radius: 8, intensity: 1.0, monochrome: true },
  controls: [
    { key: 'radius',     label: 'BLUR PX',   type: 'range', min: 1, max: 30, step: 1, pixelScale: 'distance' },
    { key: 'intensity',  label: 'INTENSITY', type: 'range', min: 0, max: 1.5, step: 0.05 },
    { key: 'monochrome', label: 'MODE', type: 'toggle', options: [
      { value: true,  label: 'MONO' },
      { value: false, label: 'COLOR' }
    ]}
  ],
  apply(src, dst, params) {
    const { radius, intensity, monochrome } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;

    const grey = new Float32Array(W * H);
    for (let i = 0, j = 0; j < grey.length; i += 4, j++) {
      grey[j] = luminance(sd[i], sd[i + 1], sd[i + 2]);
    }
    const blurInverted = boxBlurGrey(
      new Float32Array(grey.map(v => 255 - v)), W, H, radius
    );

    const out = sctx.createImageData(W, H);
    const od = out.data;
    for (let j = 0; j < grey.length; j++) {
      const a = grey[j];
      const b = blurInverted[j];
      // color-dodge: a / (1 - b)
      let v = b >= 255 ? 255 : clamp((a * 255) / (255 - b), 0, 255);
      // bias toward white via intensity
      v = clamp(255 - (255 - v) * intensity, 0, 255);
      const di = j * 4;
      if (monochrome) {
        od[di] = od[di + 1] = od[di + 2] = v;
      } else {
        // Multiply sketch lightness against original color.
        const k = v / 255;
        od[di]     = clamp(sd[di]     * k, 0, 255);
        od[di + 1] = clamp(sd[di + 1] * k, 0, 255);
        od[di + 2] = clamp(sd[di + 2] * k, 0, 255);
      }
      od[di + 3] = 255;
    }
    putImageData(dst, out);
  }
};
