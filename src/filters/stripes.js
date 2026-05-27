// Stripe overlay: parallel bands of a chosen color blended on top of the
// source — or, optionally, bands filled with the sampled source image
// itself (with optional pixel offset, for a "displacement" effect, or on
// top of a flat background for a stencil look).
import { ctxOf } from './_common.js';

export default {
  id: 'stripes',
  name: 'Stripes',
  group: 'patterns',
  notes: 'Parallel stripe overlay. Fill with solid color, with the image at the same spot, or with the image over a background.',
  defaults: {
    spacing: 14,
    thickness: 5,
    angle: 45,
    color: '#000000',
    opacity: 1,
    blend: 'source-over',
    sample: 'color',
    bgColor: '#ffffff',
    offsetX: 0,
    offsetY: 0
  },
  controls: [
    { key: 'spacing',   label: 'SPACING PX', type: 'range', min: 4, max: 80, step: 1, pixelScale: 'distance' },
    { key: 'thickness', label: 'THICK PX',   type: 'range', min: 1, max: 40, step: 1, pixelScale: 'distance' },
    { key: 'angle',     label: 'ANGLE °',    type: 'range', min: 0, max: 180, step: 1 },
    { key: 'opacity',   label: 'OPACITY',    type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'sample',    label: 'FILL', type: 'select', options: [
      { value: 'color',         label: 'Solid color' },
      { value: 'image',         label: 'Image (over image)' },
      { value: 'image-cutout',  label: 'Image (over bg)' }
    ]},
    { key: 'offsetX', label: 'SAMPLE OFFSET X', type: 'range', min: -100, max: 100, step: 1, pixelScale: 'distance' },
    { key: 'offsetY', label: 'SAMPLE OFFSET Y', type: 'range', min: -100, max: 100, step: 1, pixelScale: 'distance' },
    { key: 'blend',     label: 'BLEND', type: 'select', options: [
      { value: 'source-over', label: 'Normal' },
      { value: 'multiply',    label: 'Multiply' },
      { value: 'screen',      label: 'Screen' },
      { value: 'overlay',     label: 'Overlay' },
      { value: 'difference',  label: 'Difference' },
      { value: 'exclusion',   label: 'Exclusion' }
    ]},
    { key: 'color',   label: 'STRIPE',     type: 'color' },
    { key: 'bgColor', label: 'BG (cutout)', type: 'color' }
  ],
  apply(src, dst, params) {
    const {
      spacing, thickness, angle, color, opacity, blend,
      sample = 'color', bgColor = '#ffffff',
      offsetX = 0, offsetY = 0
    } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const dctx = ctxOf(dst);

    const rad = (angle * Math.PI) / 180;
    const diag = Math.ceil(Math.sqrt(W * W + H * H)) + spacing;

    // ----- 1. Paint the base -----
    dctx.clearRect(0, 0, W, H);
    if (sample === 'image-cutout') {
      dctx.fillStyle = bgColor;
      dctx.fillRect(0, 0, W, H);
    } else {
      // 'color' and 'image' both sit on top of the source image
      dctx.drawImage(src, 0, 0);
    }

    // ----- 2. Paint the stripe overlay -----
    if (sample === 'color') {
      // Original fast path: fill stripes directly on dst with the chosen blend.
      dctx.save();
      dctx.globalAlpha = opacity;
      dctx.globalCompositeOperation = blend;
      dctx.fillStyle = color;
      dctx.translate(W / 2, H / 2);
      dctx.rotate(rad);
      for (let v = -diag; v < diag; v += spacing) {
        dctx.fillRect(-diag, v, 2 * diag, thickness);
      }
      dctx.restore();
    } else {
      // Image-sampled stripes: build the stripe shape on an offscreen canvas,
      // mask it with the source image (source-in), then composite onto dst.
      const overlay = document.createElement('canvas');
      overlay.width = W; overlay.height = H;
      const octx = overlay.getContext('2d');

      octx.save();
      octx.translate(W / 2, H / 2);
      octx.rotate(rad);
      octx.fillStyle = '#ffffff'; // color is irrelevant — only the alpha matters
      for (let v = -diag; v < diag; v += spacing) {
        octx.fillRect(-diag, v, 2 * diag, thickness);
      }
      octx.restore();

      // Keep only the parts of the source image that overlap stripe pixels.
      octx.globalCompositeOperation = 'source-in';
      octx.drawImage(src, offsetX, offsetY);

      dctx.save();
      dctx.globalAlpha = opacity;
      dctx.globalCompositeOperation = blend;
      dctx.drawImage(overlay, 0, 0);
      dctx.restore();
    }
  }
};
