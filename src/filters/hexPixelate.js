// Hexagonal pixelation: sample average color into pointy-top hex cells.
import { ctxOf, blockAverage } from './_common.js';

function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export default {
  id: 'hexPixelate',
  name: 'Hex Pixelate',
  group: 'experimental',
  notes: 'Pointy-top hexagonal grid. Optional stroke draws cell borders.',
  defaults: { size: 14, stroke: 0, bg: '#0a0a0a' },
  controls: [
    { key: 'size',   label: 'CELL RADIUS', type: 'range', min: 4, max: 60, step: 1, pixelScale: 'distance' },
    { key: 'stroke', label: 'STROKE',      type: 'range', min: 0, max: 4, step: 0.5, pixelScale: 'distance' },
    { key: 'bg',     label: 'BACKING', type: 'color' }
  ],
  apply(src, dst, params) {
    const { size, stroke, bg } = params;
    const r = size;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const dctx = ctxOf(dst);
    const data = sctx.getImageData(0, 0, W, H).data;

    dctx.fillStyle = bg;
    dctx.fillRect(0, 0, W, H);
    if (stroke > 0) {
      dctx.lineWidth = stroke;
      dctx.strokeStyle = bg;
    }

    // Pointy-top spacing
    const hStep = r * Math.sqrt(3);
    const vStep = r * 1.5;
    const cellSample = Math.max(2, Math.round(r));

    for (let row = -1, y = -r; y < H + r; y += vStep, row++) {
      const xOffset = (row % 2 === 0) ? 0 : hStep / 2;
      for (let x = -hStep + xOffset; x < W + hStep; x += hStep) {
        const cx = x + hStep / 2;
        const cy = y + vStep;
        const ix = Math.max(0, Math.min(W - 1, Math.round(cx)));
        const iy = Math.max(0, Math.min(H - 1, Math.round(cy)));
        const [R, G, B] = blockAverage(
          data, W, H,
          Math.max(0, ix - cellSample / 2 | 0),
          Math.max(0, iy - cellSample / 2 | 0),
          cellSample, cellSample
        );
        dctx.fillStyle = `rgb(${R|0},${G|0},${B|0})`;
        hexPath(dctx, cx, cy, r);
        dctx.fill();
        if (stroke > 0) dctx.stroke();
      }
    }
  }
};
