// Pinch / spherize: radial distortion. Positive strength pinches inward,
// negative bulges outward (spherize).
import { ctxOf, putImageData } from './_common.js';

export default {
  id: 'pinch',
  name: 'Pinch / Bulge',
  group: 'warp',
  notes: 'Positive values pinch toward center; negative bulge outward.',
  defaults: { strength: 0.6, radius: 0.7, cx: 0.5, cy: 0.5 },
  controls: [
    { key: 'strength', label: 'STRENGTH', type: 'range', min: -1, max: 1, step: 0.01 },
    { key: 'radius',   label: 'RADIUS',   type: 'range', min: 0.1, max: 1.5, step: 0.01 },
    { key: 'cx',       label: 'CENTER X', type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'cy',       label: 'CENTER Y', type: 'range', min: 0, max: 1, step: 0.01 }
  ],
  apply(src, dst, params) {
    const { strength, radius, cx, cy } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;

    const ox = cx * W, oy = cy * H;
    const maxR = Math.min(W, H) * radius;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - ox, dy = y - oy;
        const r = Math.sqrt(dx * dx + dy * dy);
        let sx = x, sy = y;
        if (r < maxR && r > 0.0001) {
          const t = r / maxR;                     // 0 at center, 1 at edge
          // shape factor: smooth bell curve at t=0.5
          const k = Math.cos(t * Math.PI / 2);
          const newR = r * Math.pow(t, strength * k);
          const ang = Math.atan2(dy, dx);
          sx = ox + newR * Math.cos(ang);
          sy = oy + newR * Math.sin(ang);
        }
        sx = Math.max(0, Math.min(W - 1, sx | 0));
        sy = Math.max(0, Math.min(H - 1, sy | 0));
        const si = (sy * W + sx) * 4;
        const di = (y * W + x) * 4;
        od[di]     = sd[si];
        od[di + 1] = sd[si + 1];
        od[di + 2] = sd[si + 2];
        od[di + 3] = 255;
      }
    }
    putImageData(dst, out);
  }
};
