// Gradient map: remap luminance through a 2- or 3-stop color gradient.
import { ctxOf, putImageData, luminance } from './_common.js';

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export default {
  id: 'gradientMap',
  name: 'Gradient Map',
  group: 'color',
  notes: 'Map luminance through a 3-stop gradient: shadow / mid / highlight.',
  defaults: {
    shadow: '#0a0a0a',
    mid:    '#c81e5a',
    high:   '#f5e9d4',
    midPos: 0.5
  },
  controls: [
    { key: 'shadow', label: 'SHADOW',    type: 'color' },
    { key: 'mid',    label: 'MIDTONE',   type: 'color' },
    { key: 'high',   label: 'HIGHLIGHT', type: 'color' },
    { key: 'midPos', label: 'MID POS',   type: 'range', min: 0.05, max: 0.95, step: 0.01 }
  ],
  apply(src, dst, params) {
    const { shadow, mid, high, midPos } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;
    const s = hexToRgb(shadow), m = hexToRgb(mid), h = hexToRgb(high);

    for (let i = 0; i < sd.length; i += 4) {
      const t = luminance(sd[i], sd[i + 1], sd[i + 2]) / 255;
      let c;
      if (t <= midPos) {
        c = lerp(s, m, midPos === 0 ? 0 : t / midPos);
      } else {
        c = lerp(m, h, midPos === 1 ? 0 : (t - midPos) / (1 - midPos));
      }
      od[i] = c[0]; od[i + 1] = c[1]; od[i + 2] = c[2]; od[i + 3] = 255;
    }
    putImageData(dst, out);
  }
};
