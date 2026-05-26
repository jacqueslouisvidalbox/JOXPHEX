// Photomosaic: replicate the image as a grid of tiny self-images, each
// tinted/dimmed to match the brightness of that region of the original.
import { ctxOf, blockAverage, luminance } from './_common.js';

export default {
  id: 'photomosaic',
  name: 'Photomosaic',
  group: 'tiling',
  notes: 'Each tile is the source itself, tinted to match its underlying area.',
  defaults: { cell: 32, contrast: 0.7, colorize: true },
  controls: [
    { key: 'cell',     label: 'TILE PX', type: 'range', min: 8, max: 120, step: 1, pixelScale: 'distance' },
    { key: 'contrast', label: 'TINT MIX', type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'colorize', label: 'COLOR', type: 'toggle', options: [
      { value: true,  label: 'COLOR' }, { value: false, label: 'MONO' }
    ]}
  ],
  apply(src, dst, params) {
    const { cell, contrast, colorize } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const dctx = ctxOf(dst);
    const data = sctx.getImageData(0, 0, W, H).data;

    dctx.clearRect(0, 0, W, H);

    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        const cw = Math.min(cell, W - x);
        const ch = Math.min(cell, H - y);
        // 1) draw a tiny version of the whole source into this tile
        dctx.drawImage(src, 0, 0, W, H, x, y, cw, ch);

        // 2) overlay an average-color tint with `contrast` opacity
        if (contrast > 0) {
          const [r, g, b] = blockAverage(data, W, H, x, y, cell, cell);
          const lum = luminance(r, g, b);
          if (colorize) {
            dctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${contrast})`;
          } else {
            dctx.fillStyle = `rgba(${lum | 0},${lum | 0},${lum | 0},${contrast})`;
          }
          dctx.fillRect(x, y, cw, ch);
        }
      }
    }
  }
};
