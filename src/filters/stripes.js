// Stripe overlay: parallel bands of a chosen color blended on top of the
// source. Tunable spacing, thickness, angle, blend mode, opacity.
import { ctxOf } from './_common.js';

export default {
  id: 'stripes',
  name: 'Stripes',
  group: 'patterns',
  notes: 'Parallel stripe overlay. Adjust spacing, angle, and blend.',
  defaults: {
    spacing: 14,
    thickness: 5,
    angle: 45,
    color: '#000000',
    opacity: 1,
    blend: 'source-over'
  },
  controls: [
    { key: 'spacing',   label: 'SPACING PX', type: 'range', min: 4, max: 80, step: 1, pixelScale: 'distance' },
    { key: 'thickness', label: 'THICK PX',   type: 'range', min: 1, max: 40, step: 1, pixelScale: 'distance' },
    { key: 'angle',     label: 'ANGLE °',    type: 'range', min: 0, max: 180, step: 1 },
    { key: 'opacity',   label: 'OPACITY',    type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'blend',     label: 'BLEND', type: 'select', options: [
      { value: 'source-over', label: 'Normal' },
      { value: 'multiply',    label: 'Multiply' },
      { value: 'screen',      label: 'Screen' },
      { value: 'overlay',     label: 'Overlay' },
      { value: 'difference',  label: 'Difference' },
      { value: 'exclusion',   label: 'Exclusion' }
    ]},
    { key: 'color', label: 'STRIPE', type: 'color' }
  ],
  apply(src, dst, params) {
    const { spacing, thickness, angle, color, opacity, blend } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const dctx = ctxOf(dst);
    dctx.clearRect(0, 0, W, H);
    dctx.drawImage(src, 0, 0);

    dctx.save();
    dctx.globalAlpha = opacity;
    dctx.globalCompositeOperation = blend;
    dctx.fillStyle = color;

    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const diag = Math.ceil(Math.sqrt(W * W + H * H)) + spacing;
    dctx.translate(W / 2, H / 2);
    dctx.rotate(rad);
    for (let v = -diag; v < diag; v += spacing) {
      dctx.fillRect(-diag, v, 2 * diag, thickness);
    }
    dctx.restore();
  }
};
