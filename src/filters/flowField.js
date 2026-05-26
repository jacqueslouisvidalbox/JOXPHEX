// Flow-field warp: each pixel is sampled from a position offset by a
// Perlin-ish flow field. Produces dreamy, smoke-like distortion.
import { ctxOf, putImageData } from './_common.js';
import { mulberry32 } from '../utils/image.js';

// Cheap value-noise: hashed grid + smoothstep.
function buildNoise(seed, size) {
  const rng = mulberry32(seed);
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  return function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    function g(i, j) {
      const ii = ((i % size) + size) % size;
      const jj = ((j % size) + size) % size;
      return grid[jj * size + ii];
    }
    const a = g(ix, iy), b = g(ix + 1, iy);
    const c = g(ix, iy + 1), d = g(ix + 1, iy + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
}

export default {
  id: 'flowField',
  name: 'Flow Warp',
  group: 'experimental',
  notes: 'Perlin-style flow field offsets each pixel for a smoky warp.',
  defaults: { amp: 18, scale: 0.012, seed: 9 },
  controls: [
    { key: 'amp',   label: 'AMP PX', type: 'range', min: 0, max: 80, step: 1, pixelScale: 'distance' },
    { key: 'scale', label: 'SCALE',  type: 'range', min: 0.001, max: 0.1, step: 0.001, pixelScale: 'inverse' },
    { key: 'seed',  label: 'SEED',   type: 'range', min: 1, max: 99999, step: 1 }
  ],
  apply(src, dst, params) {
    const { amp, scale, seed } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;

    const nX = buildNoise(seed, 64);
    const nY = buildNoise(seed + 9001, 64);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ang = nX(x * scale, y * scale) * Math.PI * 2;
        const mag = nY(x * scale, y * scale) * amp;
        const sx = Math.max(0, Math.min(W - 1, Math.round(x + Math.cos(ang) * mag)));
        const sy = Math.max(0, Math.min(H - 1, Math.round(y + Math.sin(ang) * mag)));
        const si = (sy * W + sx) * 4;
        const di = (y * W + x) * 4;
        od[di] = sd[si];
        od[di + 1] = sd[si + 1];
        od[di + 2] = sd[si + 2];
        od[di + 3] = 255;
      }
    }
    putImageData(dst, out);
  }
};
