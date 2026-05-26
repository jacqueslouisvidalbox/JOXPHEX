// Crosshatch: 1–4 layers of perpendicular line strokes, added as darkness deepens.
import { ctxOf, luminance } from './_common.js';

export default {
  id: 'crosshatch',
  name: 'Cross-hatch',
  group: 'halftone',
  notes: 'Engraving-style. Each darkness threshold unlocks another hatch direction.',
  defaults: { spacing: 5, layers: 4, bg: '#f5f1e8', fg: '#0a0a0a' },
  controls: [
    { key: 'spacing', label: 'SPACING', type: 'range', min: 2, max: 16, step: 1, pixelScale: 'distance' },
    { key: 'layers',  label: 'LAYERS', type: 'range', min: 1, max: 4, step: 1 },
    { key: 'bg', label: 'PAPER', type: 'color' },
    { key: 'fg', label: 'INK',   type: 'color' }
  ],
  apply(src, dst, params) {
    const { spacing, layers, bg, fg } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const dctx = ctxOf(dst);
    const data = sctx.getImageData(0, 0, W, H).data;

    dctx.fillStyle = bg;
    dctx.fillRect(0, 0, W, H);
    dctx.strokeStyle = fg;
    dctx.lineWidth = 1;

    const angles = [Math.PI / 4, -Math.PI / 4, 0, Math.PI / 2];
    const thresholds = [0.75, 0.55, 0.35, 0.18];

    for (let l = 0; l < layers; l++) {
      const angle = angles[l];
      const thresh = thresholds[l];
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const diag = Math.ceil(Math.sqrt(W * W + H * H)) + spacing;
      const step = 2;
      for (let v = -diag; v < diag; v += spacing) {
        let drawing = false;
        let segStart = null;
        for (let u = -diag; u <= diag; u += step) {
          const x = W / 2 + u * cos - v * sin;
          const y = H / 2 + u * sin + v * cos;
          let lum = 1;
          if (x >= 0 && x < W && y >= 0 && y < H) {
            const i = ((y | 0) * W + (x | 0)) * 4;
            lum = luminance(data[i], data[i + 1], data[i + 2]) / 255;
          }
          const dark = 1 - lum;
          const on = dark > thresh;
          if (on && !drawing) { drawing = true; segStart = { x, y }; }
          else if (!on && drawing) {
            dctx.beginPath();
            dctx.moveTo(segStart.x, segStart.y);
            dctx.lineTo(x, y);
            dctx.stroke();
            drawing = false;
          }
        }
        if (drawing) {
          dctx.beginPath();
          dctx.moveTo(segStart.x, segStart.y);
          dctx.lineTo(W / 2 + diag * cos - v * sin, H / 2 + diag * sin + v * cos);
          dctx.stroke();
        }
      }
    }
  }
};
