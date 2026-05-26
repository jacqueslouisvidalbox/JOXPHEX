// Polka-dot overlay (uniform — NOT brightness-driven, unlike halftone).
import { ctxOf } from './_common.js';

export default {
  id: 'dots',
  name: 'Polka Dots',
  group: 'patterns',
  notes: 'Uniform dot overlay. Distinct from halftone — dots are all one size.',
  defaults: {
    spacing: 22,
    radius: 5,
    color: '#000000',
    opacity: 1,
    blend: 'source-over',
    stagger: true
  },
  controls: [
    { key: 'spacing', label: 'SPACING PX', type: 'range', min: 6, max: 80, step: 1, pixelScale: 'distance' },
    { key: 'radius',  label: 'RADIUS PX',  type: 'range', min: 1, max: 30, step: 1, pixelScale: 'distance' },
    { key: 'opacity', label: 'OPACITY',    type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'stagger', label: 'STAGGER', type: 'toggle', options: [
      { value: true,  label: 'ON' }, { value: false, label: 'OFF' }
    ]},
    { key: 'blend',   label: 'BLEND', type: 'select', options: [
      { value: 'source-over', label: 'Normal' },
      { value: 'multiply',    label: 'Multiply' },
      { value: 'screen',      label: 'Screen' },
      { value: 'difference',  label: 'Difference' }
    ]},
    { key: 'color',   label: 'DOT', type: 'color' }
  ],
  apply(src, dst, params) {
    const { spacing, radius, color, opacity, blend, stagger } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const dctx = ctxOf(dst);
    dctx.drawImage(src, 0, 0);

    dctx.save();
    dctx.globalAlpha = opacity;
    dctx.globalCompositeOperation = blend;
    dctx.fillStyle = color;

    let row = 0;
    for (let y = -radius; y < H + radius; y += spacing, row++) {
      const xOff = stagger && row % 2 === 1 ? spacing / 2 : 0;
      for (let x = -radius + xOff; x < W + radius; x += spacing) {
        dctx.beginPath();
        dctx.arc(x, y, radius, 0, Math.PI * 2);
        dctx.fill();
      }
    }
    dctx.restore();
  }
};
