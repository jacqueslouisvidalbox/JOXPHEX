// Emboss: directional gradient of luminance, remapped to mid-grey + signed
// shading. Adjustable light angle and depth.
import { ctxOf, putImageData, luminance, clamp } from './_common.js';

export default {
  id: 'emboss',
  name: 'Emboss',
  group: 'edges',
  notes: 'Directional gradient as relief shading. Adjust light angle and depth.',
  defaults: { angle: 135, depth: 3, monochrome: true },
  controls: [
    { key: 'angle',      label: 'LIGHT °', type: 'range', min: 0, max: 360, step: 5 },
    { key: 'depth',      label: 'DEPTH',   type: 'range', min: 1, max: 8, step: 1, pixelScale: 'distance' },
    { key: 'monochrome', label: 'MODE',    type: 'toggle', options: [
      { value: true,  label: 'MONO' },
      { value: false, label: 'COLOR' }
    ]}
  ],
  apply(src, dst, params) {
    const { angle, depth, monochrome } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;

    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * depth;
    const dy = Math.sin(rad) * depth;

    // Greyscale for gradient direction.
    const grey = new Uint8ClampedArray(W * H);
    for (let i = 0, j = 0; j < grey.length; i += 4, j++) {
      grey[j] = luminance(sd[i], sd[i + 1], sd[i + 2]);
    }

    function gAt(x, y) {
      const cx = Math.max(0, Math.min(W - 1, x | 0));
      const cy = Math.max(0, Math.min(H - 1, y | 0));
      return grey[cy * W + cx];
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // gradient projected along light direction
        const a = gAt(x - dx, y - dy);
        const b = gAt(x + dx, y + dy);
        const diff = (b - a) * 0.5;        // -127..+127 typical
        const v = clamp(128 + diff, 0, 255);
        const di = (y * W + x) * 4;
        if (monochrome) {
          od[di] = od[di + 1] = od[di + 2] = v;
        } else {
          // Tint the relief with source color, normalized around mid-grey.
          const si = (y * W + x) * 4;
          const adj = (v - 128) / 128; // -1..+1
          od[di]     = clamp(sd[si]     + adj * 80, 0, 255);
          od[di + 1] = clamp(sd[si + 1] + adj * 80, 0, 255);
          od[di + 2] = clamp(sd[si + 2] + adj * 80, 0, 255);
        }
        od[di + 3] = 255;
      }
    }
    putImageData(dst, out);
  }
};
