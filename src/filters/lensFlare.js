// Lens flare: radial glow + scattered ghost discs along the center-flare axis.
import { ctxOf, clamp } from './_common.js';

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [255, 230, 180];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default {
  id: 'lensFlare',
  name: 'Lens Flare',
  group: 'stylize',
  notes: 'Bright radial glow plus ghost discs along the line through center.',
  defaults: {
    cx: 0.3,
    cy: 0.3,
    intensity: 0.9,
    radius: 0.4,
    ghosts: 5,
    color: '#ffe0b2'
  },
  controls: [
    { key: 'cx',        label: 'LIGHT X',  type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'cy',        label: 'LIGHT Y',  type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'intensity', label: 'INTENSITY', type: 'range', min: 0, max: 2, step: 0.05 },
    { key: 'radius',    label: 'RADIUS',   type: 'range', min: 0.05, max: 1, step: 0.01 },
    { key: 'ghosts',    label: 'GHOSTS',   type: 'range', min: 0, max: 10, step: 1 },
    { key: 'color',     label: 'TINT', type: 'color' }
  ],
  apply(src, dst, params) {
    const { cx, cy, intensity, radius, ghosts, color } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const dctx = ctxOf(dst);
    dctx.clearRect(0, 0, W, H);
    dctx.drawImage(src, 0, 0);

    const lx = cx * W, ly = cy * H;
    const mx = W / 2, my = H / 2;
    const R = Math.min(W, H) * radius;
    const tint = hexToRgb(color);
    const tintCss = `rgba(${tint[0]},${tint[1]},${tint[2]}`;

    // Main glow
    dctx.save();
    dctx.globalCompositeOperation = 'screen';
    const g = dctx.createRadialGradient(lx, ly, 0, lx, ly, R);
    g.addColorStop(0, `${tintCss},${intensity})`);
    g.addColorStop(0.4, `${tintCss},${intensity * 0.5})`);
    g.addColorStop(1, `${tintCss},0)`);
    dctx.fillStyle = g;
    dctx.fillRect(0, 0, W, H);

    // Ghosts along axis through center.
    const ax = mx - lx, ay = my - ly;
    for (let i = 1; i <= ghosts; i++) {
      const t = (i / (ghosts + 1)) * 2; // 0 → 2, passes through center at 1
      const gx = lx + ax * t;
      const gy = ly + ay * t;
      const gr = R * (0.15 + (i / (ghosts + 1)) * 0.35);
      const grad = dctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      const a = intensity * (0.18 + (1 - Math.abs(t - 1)) * 0.25);
      grad.addColorStop(0, `${tintCss},${a})`);
      grad.addColorStop(1, `${tintCss},0)`);
      dctx.fillStyle = grad;
      dctx.fillRect(0, 0, W, H);
    }
    dctx.restore();
  }
};
