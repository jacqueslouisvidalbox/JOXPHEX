// Line-screen: parallel lines whose width is driven by local darkness.
import { ctxOf, luminance } from './_common.js';

export default {
  id: 'lineScreen',
  name: 'Line Screen',
  group: 'halftone',
  notes: 'Parallel-rule print effect. Line thickness encodes brightness.',
  defaults: { spacing: 6, angle: 45, bg: '#f5f1e8', fg: '#0a0a0a' },
  controls: [
    { key: 'spacing', label: 'SPACING PX', type: 'range', min: 2, max: 30, step: 1, pixelScale: 'distance' },
    { key: 'angle',   label: 'ANGLE °', type: 'range', min: 0, max: 180, step: 5 },
    { key: 'bg', label: 'PAPER', type: 'color' },
    { key: 'fg', label: 'INK',   type: 'color' }
  ],
  apply(src, dst, params) {
    const { spacing, angle, bg, fg } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const dctx = ctxOf(dst);
    const data = sctx.getImageData(0, 0, W, H).data;

    dctx.fillStyle = bg;
    dctx.fillRect(0, 0, W, H);
    dctx.strokeStyle = fg;
    dctx.lineCap = 'butt';

    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const diag = Math.ceil(Math.sqrt(W * W + H * H)) + spacing;

    for (let v = -diag; v < diag; v += spacing) {
      // For each line along v (perpendicular axis), step along u sampling brightness.
      let prevU = -diag;
      const step = 2;
      let path = [];
      for (let u = -diag; u <= diag; u += step) {
        const x = W / 2 + u * cos - v * sin;
        const y = H / 2 + u * sin + v * cos;
        if (x < 0 || x >= W || y < 0 || y >= H) {
          path.push({ x, y, t: 0 });
          continue;
        }
        const idx = ((y | 0) * W + (x | 0)) * 4;
        const lum = luminance(data[idx], data[idx + 1], data[idx + 2]) / 255;
        path.push({ x, y, t: 1 - lum }); // darker → thicker
      }
      // Render the path as variable-width strokes (segments).
      for (let k = 1; k < path.length; k++) {
        const a = path[k - 1], b = path[k];
        const t = (a.t + b.t) / 2;
        if (t < 0.05) continue;
        dctx.lineWidth = t * (spacing * 0.9);
        dctx.beginPath();
        dctx.moveTo(a.x, a.y);
        dctx.lineTo(b.x, b.y);
        dctx.stroke();
      }
    }
  }
};
