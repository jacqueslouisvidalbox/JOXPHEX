// Keep pixels whose hue is near the chosen target; desaturate the rest.
import { ctxOf, putImageData, luminance } from './_common.js';

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0;
  const d = mx - mn;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = mx === 0 ? 0 : d / mx;
  return [h, s, mx];
}

export default {
  id: 'colorIsolation',
  name: 'Color Isolation',
  group: 'color',
  notes: 'Keep pixels near the target hue; desaturate the rest.',
  defaults: { targetHue: 0, tolerance: 30, desat: 1.0 },
  controls: [
    { key: 'targetHue', label: 'HUE °',     type: 'range', min: 0, max: 360, step: 1 },
    { key: 'tolerance', label: 'TOLERANCE', type: 'range', min: 1, max: 180, step: 1 },
    { key: 'desat',     label: 'DESAT',     type: 'range', min: 0, max: 1, step: 0.05 }
  ],
  apply(src, dst, params) {
    const { targetHue, tolerance, desat } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;

    for (let i = 0; i < sd.length; i += 4) {
      const r = sd[i], g = sd[i + 1], b = sd[i + 2];
      const [h] = rgbToHsv(r, g, b);
      let dh = Math.abs(h - targetHue);
      if (dh > 180) dh = 360 - dh;
      const inside = dh <= tolerance;
      if (inside) {
        od[i] = r; od[i + 1] = g; od[i + 2] = b;
      } else {
        const lum = luminance(r, g, b);
        od[i]     = r * (1 - desat) + lum * desat;
        od[i + 1] = g * (1 - desat) + lum * desat;
        od[i + 2] = b * (1 - desat) + lum * desat;
      }
      od[i + 3] = 255;
    }
    putImageData(dst, out);
  }
};
