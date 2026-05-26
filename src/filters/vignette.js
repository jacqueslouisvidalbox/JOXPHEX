// Radial darken (or lighten with negative strength).
import { ctxOf, putImageData, clamp } from './_common.js';

export default {
  id: 'vignette',
  name: 'Vignette',
  group: 'stylize',
  notes: 'Radial darkening from center. Negative strength lightens edges.',
  defaults: { strength: 0.6, radius: 0.95, falloff: 1.5 },
  controls: [
    { key: 'strength', label: 'STRENGTH', type: 'range', min: -1, max: 1, step: 0.05 },
    { key: 'radius',   label: 'RADIUS',   type: 'range', min: 0.2, max: 1.5, step: 0.01 },
    { key: 'falloff',  label: 'FALLOFF',  type: 'range', min: 0.5, max: 4, step: 0.1 }
  ],
  apply(src, dst, params) {
    const { strength, radius, falloff } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const img = sctx.getImageData(0, 0, W, H);
    const d = img.data;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy) * radius;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - cx, dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy) / maxR;
        const f = Math.pow(Math.min(1, r), falloff) * strength;
        const i = (y * W + x) * 4;
        if (f >= 0) {
          // darken
          d[i]     = clamp(d[i]     * (1 - f), 0, 255);
          d[i + 1] = clamp(d[i + 1] * (1 - f), 0, 255);
          d[i + 2] = clamp(d[i + 2] * (1 - f), 0, 255);
        } else {
          // lighten (negative strength)
          const t = -f;
          d[i]     = clamp(d[i]     + (255 - d[i])     * t, 0, 255);
          d[i + 1] = clamp(d[i + 1] + (255 - d[i + 1]) * t, 0, 255);
          d[i + 2] = clamp(d[i + 2] + (255 - d[i + 2]) * t, 0, 255);
        }
      }
    }
    putImageData(dst, img);
  }
};
