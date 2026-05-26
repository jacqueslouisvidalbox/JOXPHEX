// ASCII / glyph map: sample brightness per block, draw mapped char.
import { ctxOf, blockAverage, luminance } from './_common.js';

const RAMPS = {
  classic: " .:-=+*#%@",
  blocks: " ░▒▓█",
  binary: " 01",
  letters: " ETAOINSHRDLU",
  numbers: " 0123456789",
  morse: " .-=",
  matrix: " 01アイウエオカキクケコサシスセソタチツテト",
  punct: " .,:;!?*&%$@"
};

export default {
  id: 'ascii',
  name: 'ASCII',
  group: 'classics',
  notes: 'Character ramps mapped by luminance. Toggle invert for dark backgrounds.',
  defaults: {
    cell: 10,
    ramp: 'classic',
    bg: '#0a0a0a',
    fg: '#ebe6dc',
    invert: false,
    colorize: false
  },
  controls: [
    { key: 'cell',     label: 'CELL PX', type: 'range', min: 4, max: 32, step: 1, pixelScale: 'distance' },
    { key: 'ramp',     label: 'RAMP', type: 'select', options: [
      { value: 'classic', label: 'Classic' },
      { value: 'blocks',  label: 'Block shades' },
      { value: 'binary',  label: 'Binary 01' },
      { value: 'letters', label: 'Letters' },
      { value: 'numbers', label: 'Numbers' },
      { value: 'morse',   label: 'Morse-ish' },
      { value: 'matrix',  label: 'Matrix' },
      { value: 'punct',   label: 'Punctuation' }
    ]},
    { key: 'invert',   label: 'INVERT', type: 'toggle', options: [
      { value: false, label: 'OFF' }, { value: true, label: 'ON' }
    ]},
    { key: 'colorize', label: 'COLOR', type: 'toggle', options: [
      { value: false, label: 'MONO' }, { value: true, label: 'RGB' }
    ]},
    { key: 'bg', label: 'BG', type: 'color' },
    { key: 'fg', label: 'FG', type: 'color' }
  ],
  apply(src, dst, params) {
    const { cell, ramp, bg, fg, invert, colorize } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const dctx = ctxOf(dst);
    const img = sctx.getImageData(0, 0, W, H);

    dctx.fillStyle = bg;
    dctx.fillRect(0, 0, W, H);

    const chars = RAMPS[ramp] || RAMPS.classic;
    const N = chars.length - 1;

    dctx.font = `${cell}px "JetBrains Mono", "Courier New", monospace`;
    dctx.textBaseline = 'top';
    dctx.textAlign = 'left';

    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        const [r, g, b] = blockAverage(img.data, W, H, x, y, cell, cell);
        let lum = luminance(r, g, b) / 255;
        if (invert) lum = 1 - lum;
        const ch = chars[Math.min(N, Math.max(0, Math.round(lum * N)))];
        dctx.fillStyle = colorize ? `rgb(${r|0},${g|0},${b|0})` : fg;
        dctx.fillText(ch, x, y);
      }
    }
  }
};
