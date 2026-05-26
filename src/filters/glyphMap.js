// Glyph substitution: tile the image with user-supplied text. Each glyph's
// transparency is set by the local block's lightness, producing a typographic
// translation of the image.
import { ctxOf, blockAverage, luminance } from './_common.js';

export default {
  id: 'glyphMap',
  name: 'Glyph Substitution',
  group: 'text',
  notes: 'Tiles your text across the image, brightness drives glyph opacity.',
  defaults: {
    cell: 14,
    text: 'JOX PHEX',
    bg: '#0a0a0a',
    fg: '#ebe6dc',
    colorize: false
  },
  controls: [
    { key: 'cell', label: 'CELL PX', type: 'range', min: 6, max: 40, step: 1, pixelScale: 'distance' },
    { key: 'text', label: 'TEXT', type: 'text', placeholder: 'JOX PHEX' },
    { key: 'colorize', label: 'COLOR', type: 'toggle', options: [
      { value: false, label: 'MONO' }, { value: true, label: 'RGB' }
    ]},
    { key: 'bg', label: 'BG', type: 'color' },
    { key: 'fg', label: 'INK', type: 'color' }
  ],
  apply(src, dst, params) {
    const { cell, text, bg, fg, colorize } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const dctx = ctxOf(dst);
    const data = sctx.getImageData(0, 0, W, H).data;

    dctx.fillStyle = bg;
    dctx.fillRect(0, 0, W, H);

    const t = (text && text.length) ? text : ' ';
    dctx.font = `bold ${cell}px "JetBrains Mono", monospace`;
    dctx.textBaseline = 'top';

    let ti = 0;
    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        const [r, g, b] = blockAverage(data, W, H, x, y, cell, cell);
        const lum = luminance(r, g, b) / 255;
        const dark = 1 - lum;
        const ch = t[ti % t.length];
        ti++;
        if (dark < 0.05) continue;
        dctx.globalAlpha = dark;
        dctx.fillStyle = colorize ? `rgb(${r|0},${g|0},${b|0})` : fg;
        dctx.fillText(ch, x, y);
      }
    }
    dctx.globalAlpha = 1;
  }
};
