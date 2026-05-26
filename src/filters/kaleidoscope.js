// Kaleidoscope: rotational symmetry. Pick N segments; everything outside
// one slice is reflected from inside.
import { ctxOf, putImageData } from './_common.js';

export default {
  id: 'kaleidoscope',
  name: 'Kaleidoscope',
  group: 'warp',
  notes: 'N-segment radial symmetry. Toggle mirror for alternating reflections.',
  defaults: { segments: 8, rotation: 0, mirror: true, cx: 0.5, cy: 0.5 },
  controls: [
    { key: 'segments', label: 'SEGMENTS', type: 'range', min: 2, max: 24, step: 1 },
    { key: 'rotation', label: 'ROTATION °', type: 'range', min: 0, max: 360, step: 1 },
    { key: 'mirror',   label: 'MIRROR',  type: 'toggle', options: [
      { value: true,  label: 'ON' }, { value: false, label: 'OFF' }
    ]},
    { key: 'cx',       label: 'CENTER X', type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'cy',       label: 'CENTER Y', type: 'range', min: 0, max: 1, step: 0.01 }
  ],
  apply(src, dst, params) {
    const { segments, rotation, mirror, cx, cy } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;

    const ox = cx * W, oy = cy * H;
    const N = Math.max(2, segments | 0);
    const slice = (2 * Math.PI) / N;
    const rot = (rotation * Math.PI) / 180;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - ox, dy = y - oy;
        const r = Math.sqrt(dx * dx + dy * dy);
        let ang = Math.atan2(dy, dx) - rot;
        // wrap into [0, 2π)
        ang = ((ang % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        // fold into one slice
        let a = ang % slice;
        if (mirror) {
          const k = Math.floor(ang / slice);
          if (k % 2 === 1) a = slice - a; // alternate slice reflects
        }
        a += rot;
        const sx = ox + r * Math.cos(a);
        const sy = oy + r * Math.sin(a);
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
