// Voronoi cell mosaic: scatter N seeded sites, paint each pixel with the
// average color around its nearest site. Uses jump-flood-like brute force
// with grid acceleration for reasonable speed.
import { ctxOf, putImageData } from './_common.js';
import { mulberry32 } from '../utils/image.js';

export default {
  id: 'voronoi',
  name: 'Voronoi Cells',
  group: 'experimental',
  notes: 'Organic mosaic. Increase site count for finer detail (slower).',
  defaults: { sites: 1200, seed: 7, edges: 0 },
  controls: [
    { key: 'sites', label: 'SITES', type: 'range', min: 100, max: 5000, step: 50 },
    { key: 'seed',  label: 'SEED', type: 'range', min: 1, max: 99999, step: 1 },
    { key: 'edges', label: 'EDGE PX', type: 'range', min: 0, max: 3, step: 0.5 }
  ],
  apply(src, dst, params) {
    const { sites, seed, edges } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const dctx = ctxOf(dst);
    const img = sctx.getImageData(0, 0, W, H);
    const sd = img.data;

    const rng = mulberry32(seed);
    const N = Math.max(50, sites | 0);

    // Generate sites
    const sx = new Float32Array(N), sy = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      sx[i] = rng() * W;
      sy[i] = rng() * H;
    }

    // Spatial grid for nearest-site lookup
    const gridSize = Math.max(1, Math.sqrt((W * H) / N) | 0);
    const cols = Math.ceil(W / gridSize);
    const rows = Math.ceil(H / gridSize);
    const grid = Array.from({ length: cols * rows }, () => []);
    for (let i = 0; i < N; i++) {
      const gx = Math.min(cols - 1, Math.max(0, (sx[i] / gridSize) | 0));
      const gy = Math.min(rows - 1, Math.max(0, (sy[i] / gridSize) | 0));
      grid[gy * cols + gx].push(i);
    }
    function nearest(px, py) {
      const gx = Math.min(cols - 1, Math.max(0, (px / gridSize) | 0));
      const gy = Math.min(rows - 1, Math.max(0, (py / gridSize) | 0));
      let best = -1, bd = Infinity;
      for (let radius = 1; radius <= Math.max(cols, rows); radius++) {
        const xs = Math.max(0, gx - radius), xe = Math.min(cols - 1, gx + radius);
        const ys = Math.max(0, gy - radius), ye = Math.min(rows - 1, gy + radius);
        for (let y = ys; y <= ye; y++) {
          for (let x = xs; x <= xe; x++) {
            // Only fringe cells on subsequent rings
            if (radius > 1 && x > xs && x < xe && y > ys && y < ye) continue;
            for (const i of grid[y * cols + x]) {
              const dx = sx[i] - px, dy = sy[i] - py;
              const d = dx * dx + dy * dy;
              if (d < bd) { bd = d; best = i; }
            }
          }
        }
        if (best >= 0 && (radius * gridSize) * (radius * gridSize) > bd) break;
      }
      return best;
    }

    // First pass: assign each pixel to nearest site index. Accumulate avg color.
    const ownerArr = new Int32Array(W * H);
    const sumR = new Float64Array(N);
    const sumG = new Float64Array(N);
    const sumB = new Float64Array(N);
    const cnt  = new Uint32Array(N);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const owner = nearest(x + 0.5, y + 0.5);
        ownerArr[idx] = owner;
        const di = idx * 4;
        sumR[owner] += sd[di];
        sumG[owner] += sd[di + 1];
        sumB[owner] += sd[di + 2];
        cnt[owner]++;
      }
    }

    const out = sctx.createImageData(W, H);
    const od = out.data;
    for (let i = 0; i < W * H; i++) {
      const o = ownerArr[i];
      const c = cnt[o] || 1;
      const di = i * 4;
      od[di]     = sumR[o] / c;
      od[di + 1] = sumG[o] / c;
      od[di + 2] = sumB[o] / c;
      od[di + 3] = 255;
    }
    putImageData(dst, out);

    // Optional cell edges
    if (edges > 0) {
      dctx.strokeStyle = '#000';
      dctx.lineWidth = edges;
      const edgeImg = sctx.createImageData(W, H);
      const ed = edgeImg.data;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const o = ownerArr[y * W + x];
          if (o !== ownerArr[y * W + (x + 1)] || o !== ownerArr[(y + 1) * W + x]) {
            const i = (y * W + x) * 4;
            ed[i] = 0; ed[i + 1] = 0; ed[i + 2] = 0; ed[i + 3] = 255;
          }
        }
      }
      // Composite edges on top
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      tmp.getContext('2d').putImageData(edgeImg, 0, 0);
      dctx.drawImage(tmp, 0, 0);
    }
  }
};
