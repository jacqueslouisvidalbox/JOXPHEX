// Hard binary threshold by luminance.
import { ctxOf, putImageData, luminance } from './_common.js';

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default {
  id: 'threshold',
  name: 'Threshold',
  group: 'color',
  notes: 'Hard cutoff by luminance. Two colors only.',
  defaults: { level: 128, dark: '#000000', light: '#ffffff', invert: false },
  controls: [
    { key: 'level',  label: 'LEVEL',  type: 'range', min: 0, max: 255, step: 1 },
    { key: 'invert', label: 'INVERT', type: 'toggle', options: [
      { value: false, label: 'OFF' }, { value: true, label: 'ON' }
    ]},
    { key: 'dark',  label: 'DARK',  type: 'color' },
    { key: 'light', label: 'LIGHT', type: 'color' }
  ],
  apply(src, dst, params) {
    const { level, dark, light, invert } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;
    const d = hexToRgb(dark), l = hexToRgb(light);

    for (let i = 0; i < sd.length; i += 4) {
      const lum = luminance(sd[i], sd[i + 1], sd[i + 2]);
      const on = invert ? lum >= level : lum < level;
      const c = on ? d : l;
      od[i] = c[0]; od[i + 1] = c[1]; od[i + 2] = c[2]; od[i + 3] = 255;
    }
    putImageData(dst, out);
  }
};
