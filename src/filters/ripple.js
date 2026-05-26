// Radial ripple: concentric sine waves emanating from a center point.
// Each pixel sampled from a position pushed in/out along its radial axis.
import { ctxOf, putImageData } from './_common.js';

export default {
  id: 'ripple',
  name: 'Ripple',
  group: 'warp',
  notes: 'Concentric radial waves from a center point. Drop a stone in.',
  defaults: { amplitude: 18, wavelength: 60, cx: 0.5, cy: 0.5, phase: 0 },
  controls: [
    { key: 'amplitude',  label: 'AMP PX',     type: 'range', min: 0, max: 80, step: 1, pixelScale: 'distance' },
    { key: 'wavelength', label: 'WAVE PX',    type: 'range', min: 5, max: 300, step: 1, pixelScale: 'distance' },
    { key: 'cx',         label: 'CENTER X',   type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'cy',         label: 'CENTER Y',   type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'phase',      label: 'PHASE',      type: 'range', min: 0, max: 360, step: 5 }
  ],
  apply(src, dst, params) {
    const { amplitude, wavelength, cx, cy, phase } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;

    const ox = cx * W, oy = cy * H;
    const k = (2 * Math.PI) / Math.max(2, wavelength);
    const ph = (phase * Math.PI) / 180;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - ox, dy = y - oy;
        const r = Math.sqrt(dx * dx + dy * dy);
        const offset = amplitude * Math.sin(r * k + ph);
        const ang = Math.atan2(dy, dx);
        let sx = x - offset * Math.cos(ang);
        let sy = y - offset * Math.sin(ang);
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
