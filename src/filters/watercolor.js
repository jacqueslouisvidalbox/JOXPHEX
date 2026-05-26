// Simplified watercolor: bilateral-ish smoothing + posterize + dark edges.
import { ctxOf, putImageData, luminance, quantizeChannel, clamp } from './_common.js';

export default {
  id: 'watercolor',
  name: 'Watercolor',
  group: 'stylize',
  notes: 'Smoothed flats + posterize + soft edges. Painterly without being precious.',
  defaults: { radius: 3, levels: 6, edgeStrength: 0.5 },
  controls: [
    { key: 'radius',       label: 'SMOOTH PX',  type: 'range', min: 1, max: 8, step: 1, pixelScale: 'distance' },
    { key: 'levels',       label: 'LEVELS',     type: 'range', min: 2, max: 12, step: 1 },
    { key: 'edgeStrength', label: 'EDGE',       type: 'range', min: 0, max: 1, step: 0.05 }
  ],
  apply(src, dst, params) {
    const { radius, levels, edgeStrength } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;

    // Edge-preserving smooth: median-ish via small bilateral; keep it
    // simple — 5x5 spatial mean weighted by colour distance.
    const r = radius;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ci = (y * W + x) * 4;
        const cr = sd[ci], cg = sd[ci + 1], cb = sd[ci + 2];
        let sr = 0, sg = 0, sb = 0, sw = 0;
        for (let oy = -r; oy <= r; oy++) {
          for (let ox = -r; ox <= r; ox++) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const ni = (ny * W + nx) * 4;
            const dr = sd[ni] - cr, dg = sd[ni + 1] - cg, db = sd[ni + 2] - cb;
            const cd = dr * dr + dg * dg + db * db;
            const w = Math.exp(-cd / 1200);
            sr += sd[ni] * w; sg += sd[ni + 1] * w; sb += sd[ni + 2] * w; sw += w;
          }
        }
        let R = sw > 0 ? sr / sw : cr;
        let G = sw > 0 ? sg / sw : cg;
        let B = sw > 0 ? sb / sw : cb;
        R = quantizeChannel(R, levels);
        G = quantizeChannel(G, levels);
        B = quantizeChannel(B, levels);
        od[ci]     = R;
        od[ci + 1] = G;
        od[ci + 2] = B;
        od[ci + 3] = 255;
      }
    }

    // Dark edges via simple gradient on luminance.
    if (edgeStrength > 0) {
      const grey = new Uint8ClampedArray(W * H);
      for (let i = 0, j = 0; j < grey.length; i += 4, j++) {
        grey[j] = luminance(od[i], od[i + 1], od[i + 2]);
      }
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          const dx = grey[i + 1] - grey[i - 1];
          const dy = grey[i + W] - grey[i - W];
          const m = Math.sqrt(dx * dx + dy * dy);
          if (m > 30) {
            const di = i * 4;
            const k = Math.min(1, m / 120) * edgeStrength;
            od[di]     = clamp(od[di]     * (1 - k), 0, 255);
            od[di + 1] = clamp(od[di + 1] * (1 - k), 0, 255);
            od[di + 2] = clamp(od[di + 2] * (1 - k), 0, 255);
          }
        }
      }
    }
    putImageData(dst, out);
  }
};
