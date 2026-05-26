// Slit-scan: smear each row (or column) by an amount tied to a sine/saw wave
// or to image brightness. Produces a static, time-frozen distortion.
import { ctxOf, putImageData, luminance } from './_common.js';

export default {
  id: 'slitScan',
  name: 'Slit-scan',
  group: 'experimental',
  notes: 'Per-row shift driven by sine wave or by row brightness.',
  defaults: { amplitude: 40, frequency: 0.02, mode: 'sine', axis: 'x' },
  controls: [
    { key: 'amplitude', label: 'AMP PX',  type: 'range', min: 0, max: 200, step: 1, pixelScale: 'distance' },
    { key: 'frequency', label: 'FREQ',    type: 'range', min: 0.001, max: 0.2, step: 0.001, pixelScale: 'inverse' },
    { key: 'mode', label: 'DRIVER', type: 'select', options: [
      { value: 'sine', label: 'Sine wave' },
      { value: 'saw',  label: 'Sawtooth' },
      { value: 'bright', label: 'Image brightness' }
    ]},
    { key: 'axis', label: 'AXIS', type: 'toggle', options: [
      { value: 'x', label: 'HORZ' },
      { value: 'y', label: 'VERT' }
    ]}
  ],
  apply(src, dst, params) {
    const { amplitude, frequency, mode, axis } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;

    function offsetForRow(y) {
      if (mode === 'sine') return Math.sin(y * frequency * Math.PI * 2) * amplitude;
      if (mode === 'saw')  return (((y * frequency) % 1) * 2 - 1) * amplitude;
      // brightness mode: avg lum of that row
      let acc = 0;
      const stride = Math.max(1, (W / 64) | 0);
      let cnt = 0;
      for (let x = 0; x < W; x += stride) {
        const i = (y * W + x) * 4;
        acc += luminance(sd[i], sd[i + 1], sd[i + 2]);
        cnt++;
      }
      const avg = (acc / cnt) / 255;
      return (avg - 0.5) * 2 * amplitude;
    }

    if (axis === 'x') {
      for (let y = 0; y < H; y++) {
        const off = Math.round(offsetForRow(y));
        for (let x = 0; x < W; x++) {
          const sx = ((x - off) % W + W) % W;
          const sIdx = (y * W + sx) * 4;
          const dIdx = (y * W + x) * 4;
          od[dIdx]     = sd[sIdx];
          od[dIdx + 1] = sd[sIdx + 1];
          od[dIdx + 2] = sd[sIdx + 2];
          od[dIdx + 3] = 255;
        }
      }
    } else {
      for (let x = 0; x < W; x++) {
        const off = Math.round(offsetForRow(x)); // reuse: drive by column index
        for (let y = 0; y < H; y++) {
          const sy = ((y - off) % H + H) % H;
          const sIdx = (sy * W + x) * 4;
          const dIdx = (y * W + x) * 4;
          od[dIdx]     = sd[sIdx];
          od[dIdx + 1] = sd[sIdx + 1];
          od[dIdx + 2] = sd[sIdx + 2];
          od[dIdx + 3] = 255;
        }
      }
    }
    putImageData(dst, out);
  }
};
