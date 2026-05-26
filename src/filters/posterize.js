// Per-channel quantization with optional palette snapping.
import { ctxOf, getImageData, putImageData, quantizeChannel } from './_common.js';

const PALETTES = {
  none: null,
  gameboy: [[15,56,15],[48,98,48],[139,172,15],[155,188,15]],
  cga: [[0,0,0],[85,255,255],[255,85,255],[255,255,255]],
  ega: [[0,0,0],[0,0,170],[0,170,0],[0,170,170],[170,0,0],[170,0,170],[170,85,0],[170,170,170],
        [85,85,85],[85,85,255],[85,255,85],[85,255,255],[255,85,85],[255,85,255],[255,255,85],[255,255,255]],
  sunset: [[31,12,33],[78,28,57],[193,56,72],[238,108,77],[247,201,93],[244,241,222]],
  duotone: [[10,10,10],[235,230,220],[255,59,0]]
};

function snap(r, g, b, pal) {
  let best = pal[0], bd = Infinity;
  for (const p of pal) {
    const dr = r - p[0], dg = g - p[1], db = b - p[2];
    const d = dr*dr + dg*dg + db*db;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export default {
  id: 'posterize',
  name: 'Posterize',
  group: 'classics',
  notes: 'Channel quantization, optional palette snap (GB, CGA, EGA, sunset).',
  defaults: { levels: 4, palette: 'none', gamma: 1.0 },
  controls: [
    { key: 'levels',  label: 'LEVELS/CH', type: 'range', min: 2, max: 8, step: 1 },
    { key: 'gamma',   label: 'GAMMA', type: 'range', min: 0.3, max: 3, step: 0.05 },
    { key: 'palette', label: 'PALETTE', type: 'select', options: [
      { value: 'none', label: 'None (levels only)' },
      { value: 'duotone', label: 'Duotone' },
      { value: 'gameboy', label: 'Game Boy' },
      { value: 'cga', label: 'CGA' },
      { value: 'ega', label: 'EGA 16' },
      { value: 'sunset', label: 'Sunset' }
    ]}
  ],
  apply(src, dst, params) {
    const { levels, palette, gamma } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const img = sctx.getImageData(0, 0, W, H);
    const d = img.data;
    const pal = PALETTES[palette];
    const gInv = 1 / gamma;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];

      if (gamma !== 1) {
        r = 255 * Math.pow(r / 255, gInv);
        g = 255 * Math.pow(g / 255, gInv);
        b = 255 * Math.pow(b / 255, gInv);
      }

      if (pal) {
        const p = snap(r, g, b, pal);
        d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2];
      } else {
        d[i]     = quantizeChannel(r, levels);
        d[i + 1] = quantizeChannel(g, levels);
        d[i + 2] = quantizeChannel(b, levels);
      }
    }
    putImageData(dst, img);
  }
};
