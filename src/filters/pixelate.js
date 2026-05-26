// Block-average pixelation with optional gap (grid lines) and bit-depth crush.
import { ctxOf, getImageData, putImageData, blockAverage, quantizeChannel } from './_common.js';

export default {
  id: 'pixelate',
  name: 'Pixelate',
  group: 'classics',
  notes: 'Mean-color block sampling. Set "gap" for visible grid lines.',
  defaults: { size: 12, gap: 0, levels: 256, shape: 'square' },
  controls: [
    { key: 'size',   label: 'BLOCK PX', type: 'range', min: 2, max: 80, step: 1, pixelScale: 'distance' },
    { key: 'gap',    label: 'GAP PX',   type: 'range', min: 0, max: 8,  step: 1, pixelScale: 'distance' },
    { key: 'levels', label: 'COLOR LEVELS', type: 'range', min: 2, max: 256, step: 1 },
    { key: 'shape',  label: 'CELL', type: 'select', options: [
      { value: 'square', label: 'Square' },
      { value: 'circle', label: 'Circle' },
      { value: 'diamond', label: 'Diamond' }
    ]}
  ],
  apply(src, dst, params) {
    const { size, gap, levels, shape } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const dctx = ctxOf(dst);
    const img = sctx.getImageData(0, 0, W, H);
    const data = img.data;

    dctx.fillStyle = '#000';
    dctx.fillRect(0, 0, W, H);

    for (let y = 0; y < H; y += size) {
      for (let x = 0; x < W; x += size) {
        let [r, g, b] = blockAverage(data, W, H, x, y, size, size);
        if (levels < 256) {
          r = quantizeChannel(r, levels);
          g = quantizeChannel(g, levels);
          b = quantizeChannel(b, levels);
        }
        dctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
        const cw = size - gap;
        const ch = size - gap;
        if (cw <= 0 || ch <= 0) continue;
        if (shape === 'square') {
          dctx.fillRect(x, y, cw, ch);
        } else if (shape === 'circle') {
          dctx.beginPath();
          dctx.arc(x + cw / 2, y + ch / 2, cw / 2, 0, Math.PI * 2);
          dctx.fill();
        } else if (shape === 'diamond') {
          const cx = x + cw / 2, cy = y + ch / 2, r2 = cw / 2;
          dctx.beginPath();
          dctx.moveTo(cx, cy - r2);
          dctx.lineTo(cx + r2, cy);
          dctx.lineTo(cx, cy + r2);
          dctx.lineTo(cx - r2, cy);
          dctx.closePath();
          dctx.fill();
        }
      }
    }
  }
};
