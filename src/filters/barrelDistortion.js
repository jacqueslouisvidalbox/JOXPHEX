// Barrel / pincushion lens distortion.
import { ctxOf, putImageData } from './_common.js';

export default {
  id: 'barrelDistortion',
  name: 'Barrel / Fish-eye',
  group: 'warp',
  notes: 'Lens distortion. Positive K bulges (fish-eye); negative pinches (pincushion).',
  defaults: { k: 0.4, zoom: 1.0 },
  controls: [
    { key: 'k',    label: 'STRENGTH', type: 'range', min: -0.9, max: 0.9, step: 0.01 },
    { key: 'zoom', label: 'ZOOM',     type: 'range', min: 0.5, max: 2, step: 0.01 }
  ],
  apply(src, dst, params) {
    const { k, zoom } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;
    const cx = W / 2, cy = H / 2;
    const norm = Math.sqrt(cx * cx + cy * cy);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x - cx) / norm;
        const dy = (y - cy) / norm;
        const r2 = dx * dx + dy * dy;
        const factor = (1 + k * r2) / zoom;
        const sx = cx + dx * norm * factor;
        const sy = cy + dy * norm * factor;
        const ix = Math.max(0, Math.min(W - 1, sx | 0));
        const iy = Math.max(0, Math.min(H - 1, sy | 0));
        const si = (iy * W + ix) * 4;
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
