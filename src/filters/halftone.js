// CMYK halftone: separate into CMYK channels, draw dots at angles.
import { ctxOf, blockAverage } from './_common.js';

function rgbToCmyk(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const k = 1 - Math.max(R, G, B);
  if (k >= 1) return [0, 0, 0, 1];
  const c = (1 - R - k) / (1 - k);
  const m = (1 - G - k) / (1 - k);
  const y = (1 - B - k) / (1 - k);
  return [c, m, y, k];
}

function drawScreen(dctx, sctx, W, H, cell, angle, color, channelIdx, srcData) {
  // Rotate a virtual grid: walk over the bounding box of the rotated grid,
  // for each cell center sample the source at the un-rotated point.
  dctx.save();
  dctx.fillStyle = color;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  // The diagonal of (W,H) bounds the rotated grid extent.
  const diag = Math.ceil(Math.sqrt(W * W + H * H)) + cell;
  for (let v = -diag; v < diag; v += cell) {
    for (let u = -diag; u < diag; u += cell) {
      // Rotate (u, v) back into source space, centered at (W/2, H/2).
      const sx = W / 2 + u * cos - v * sin;
      const sy = H / 2 + u * sin + v * cos;
      if (sx < -cell || sx > W + cell || sy < -cell || sy > H + cell) continue;
      const ix = Math.max(0, Math.min(W - 1, Math.round(sx)));
      const iy = Math.max(0, Math.min(H - 1, Math.round(sy)));
      const idx = (iy * W + ix) * 4;
      const r = srcData[idx], g = srcData[idx + 1], b = srcData[idx + 2];
      const cmyk = rgbToCmyk(r, g, b);
      const v01 = cmyk[channelIdx];
      const radius = Math.sqrt(v01) * (cell * 0.7) / 2;
      if (radius <= 0.2) continue;
      dctx.beginPath();
      dctx.arc(sx, sy, radius, 0, Math.PI * 2);
      dctx.fill();
    }
  }
  dctx.restore();
}

export default {
  id: 'halftone',
  name: 'CMYK Halftone',
  group: 'halftone',
  notes: 'Four-color process screen. Mode "mono" suppresses CMY and uses black only.',
  defaults: { cell: 8, mode: 'cmyk', bg: '#f5f1e8' },
  controls: [
    { key: 'cell', label: 'CELL PX', type: 'range', min: 4, max: 32, step: 1, pixelScale: 'distance' },
    { key: 'mode', label: 'MODE', type: 'toggle', options: [
      { value: 'cmyk', label: 'CMYK' }, { value: 'mono', label: 'K ONLY' }
    ]},
    { key: 'bg', label: 'PAPER', type: 'color' }
  ],
  apply(src, dst, params) {
    const { cell, mode, bg } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const dctx = ctxOf(dst);
    const img = sctx.getImageData(0, 0, W, H);
    const data = img.data;

    dctx.fillStyle = bg;
    dctx.fillRect(0, 0, W, H);

    // Use multiply-like composite so overlapping dots darken.
    dctx.globalCompositeOperation = 'multiply';

    if (mode === 'cmyk') {
      // Standard print angles: C 15°, M 75°, Y 0°, K 45°.
      drawScreen(dctx, sctx, W, H, cell, 15 * Math.PI / 180, 'rgb(0,180,200)', 0, data);
      drawScreen(dctx, sctx, W, H, cell, 75 * Math.PI / 180, 'rgb(220,30,160)', 1, data);
      drawScreen(dctx, sctx, W, H, cell, 0,                  'rgb(245,210,30)', 2, data);
      drawScreen(dctx, sctx, W, H, cell, 45 * Math.PI / 180, 'rgb(10,10,10)',   3, data);
    } else {
      // Mono: convert to grayscale → use as K
      const monoData = new Uint8ClampedArray(data.length);
      for (let i = 0; i < data.length; i += 4) {
        const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const k = 1 - l / 255;
        monoData[i] = 255; monoData[i + 1] = 255; monoData[i + 2] = 255;
        monoData[i + 3] = 255;
        // Reuse channel idx 3 with synthetic data:
        // pack k * 255 into r so rgbToCmyk gets a black-derived k.
        monoData[i] = 255 - Math.round(k * 255);
        monoData[i + 1] = 255 - Math.round(k * 255);
        monoData[i + 2] = 255 - Math.round(k * 255);
      }
      drawScreen(dctx, sctx, W, H, cell, 45 * Math.PI / 180, 'rgb(10,10,10)', 3, monoData);
    }
    dctx.globalCompositeOperation = 'source-over';
  }
};
