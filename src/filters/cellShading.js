// Cell shading / toon: quantize colors into flat regions + dark outlines.
import { ctxOf, putImageData, luminance, quantizeChannel, clamp } from './_common.js';

export default {
  id: 'cellShading',
  name: 'Cell Shade',
  group: 'stylize',
  notes: 'Flat color regions + dark outlines for a toon / comic look.',
  defaults: { levels: 4, edgeThresh: 30, edgeStrength: 0.85 },
  controls: [
    { key: 'levels',       label: 'LEVELS',     type: 'range', min: 2, max: 8, step: 1 },
    { key: 'edgeThresh',   label: 'EDGE THR',   type: 'range', min: 5, max: 120, step: 1 },
    { key: 'edgeStrength', label: 'EDGE',       type: 'range', min: 0, max: 1, step: 0.05 }
  ],
  apply(src, dst, params) {
    const { levels, edgeThresh, edgeStrength } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;

    // First pass: quantize colors
    for (let i = 0; i < sd.length; i += 4) {
      od[i]     = quantizeChannel(sd[i],     levels);
      od[i + 1] = quantizeChannel(sd[i + 1], levels);
      od[i + 2] = quantizeChannel(sd[i + 2], levels);
      od[i + 3] = 255;
    }

    // Second pass: Sobel edges over original luminance, darken those pixels.
    const grey = new Uint8ClampedArray(W * H);
    for (let i = 0, j = 0; j < grey.length; i += 4, j++) {
      grey[j] = luminance(sd[i], sd[i + 1], sd[i + 2]);
    }
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const gx = -grey[i - W - 1] - 2 * grey[i - 1] - grey[i + W - 1]
                 + grey[i - W + 1] + 2 * grey[i + 1] + grey[i + W + 1];
        const gy = -grey[i - W - 1] - 2 * grey[i - W] - grey[i - W + 1]
                 + grey[i + W - 1] + 2 * grey[i + W] + grey[i + W + 1];
        const m = Math.sqrt(gx * gx + gy * gy);
        if (m >= edgeThresh) {
          const di = i * 4;
          const k = edgeStrength;
          od[di]     = clamp(od[di]     * (1 - k), 0, 255);
          od[di + 1] = clamp(od[di + 1] * (1 - k), 0, 255);
          od[di + 2] = clamp(od[di + 2] * (1 - k), 0, 255);
        }
      }
    }
    putImageData(dst, out);
  }
};
