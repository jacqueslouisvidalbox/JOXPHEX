// Edge-preserving cleanup: blur except where local edges are strong.
// Useful for de-noising photos of text without smearing strokes.
import { ctxOf, putImageData, luminance } from './_common.js';

export default {
  id: 'edgeClean',
  name: 'Edge-preserve Clean',
  group: 'text',
  notes: 'Soft denoise that respects strong edges. Tunable threshold.',
  defaults: { radius: 2, edgeThresh: 28 },
  controls: [
    { key: 'radius',     label: 'RADIUS PX', type: 'range', min: 1, max: 6, step: 1, pixelScale: 'distance' },
    { key: 'edgeThresh', label: 'EDGE THRESH', type: 'range', min: 0, max: 80, step: 1 }
  ],
  apply(src, dst, params) {
    const { radius, edgeThresh } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const grey = new Uint8ClampedArray(W * H);
    for (let i = 0, j = 0; j < grey.length; i += 4, j++) {
      grey[j] = luminance(sd[i], sd[i + 1], sd[i + 2]);
    }
    const out = sctx.createImageData(W, H);
    const od = out.data;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let r = 0, g = 0, b = 0, n = 0;
        const cl = grey[y * W + x];
        for (let oy = -radius; oy <= radius; oy++) {
          for (let ox = -radius; ox <= radius; ox++) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            if (Math.abs(grey[ny * W + nx] - cl) > edgeThresh) continue;
            const i = (ny * W + nx) * 4;
            r += sd[i]; g += sd[i + 1]; b += sd[i + 2]; n++;
          }
        }
        const di = (y * W + x) * 4;
        od[di]     = n ? r / n : sd[di];
        od[di + 1] = n ? g / n : sd[di + 1];
        od[di + 2] = n ? b / n : sd[di + 2];
        od[di + 3] = 255;
      }
    }
    putImageData(dst, out);
  }
};
