// Adaptive threshold using a fast integral-image local mean.
// Great for cleaning up scanned text / handwriting.
import { ctxOf, putImageData, luminance } from './_common.js';

export default {
  id: 'adaptiveThreshold',
  name: 'Adaptive Threshold',
  group: 'text',
  notes: 'Local mean threshold (Sauvola-lite). Best for text / scans.',
  defaults: { window: 25, bias: 8, invert: false },
  controls: [
    { key: 'window', label: 'WINDOW PX', type: 'range', min: 5, max: 81, step: 2, pixelScale: 'distance' },
    { key: 'bias',   label: 'BIAS',      type: 'range', min: -40, max: 40, step: 1 },
    { key: 'invert', label: 'INVERT', type: 'toggle', options: [
      { value: false, label: 'OFF' }, { value: true, label: 'ON' }
    ]}
  ],
  apply(src, dst, params) {
    let { window, bias, invert } = params;
    if (window % 2 === 0) window++;
    const r = (window / 2) | 0;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;

    // Greyscale
    const grey = new Float64Array(W * H);
    for (let i = 0, j = 0; j < grey.length; i += 4, j++) {
      grey[j] = luminance(sd[i], sd[i + 1], sd[i + 2]);
    }
    // Integral image
    const integ = new Float64Array((W + 1) * (H + 1));
    const stride = W + 1;
    for (let y = 0; y < H; y++) {
      let rowSum = 0;
      for (let x = 0; x < W; x++) {
        rowSum += grey[y * W + x];
        integ[(y + 1) * stride + (x + 1)] = integ[y * stride + (x + 1)] + rowSum;
      }
    }

    function areaSum(x0, y0, x1, y1) {
      // inclusive bounds, clamped
      x0 = Math.max(0, x0); y0 = Math.max(0, y0);
      x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1);
      return integ[(y1 + 1) * stride + (x1 + 1)]
           - integ[y0 * stride + (x1 + 1)]
           - integ[(y1 + 1) * stride + x0]
           + integ[y0 * stride + x0];
    }

    const out = sctx.createImageData(W, H);
    const od = out.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const x0 = x - r, y0 = y - r, x1 = x + r, y1 = y + r;
        const cnt = (Math.min(W - 1, x1) - Math.max(0, x0) + 1)
                  * (Math.min(H - 1, y1) - Math.max(0, y0) + 1);
        const mean = areaSum(x0, y0, x1, y1) / cnt;
        const v = grey[y * W + x];
        let on = v < (mean - bias);
        if (invert) on = !on;
        const val = on ? 0 : 255;
        const di = (y * W + x) * 4;
        od[di] = val; od[di + 1] = val; od[di + 2] = val; od[di + 3] = 255;
      }
    }
    putImageData(dst, out);
  }
};
