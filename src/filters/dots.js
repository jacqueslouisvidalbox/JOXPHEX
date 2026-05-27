// Polka-dot overlay (uniform — NOT brightness-driven, unlike halftone).
// Dots can be solid color or filled with the sampled source image at the
// dot's position (with optional offset), or used as a "stencil" where the
// image shows only through the dots.
import { ctxOf } from './_common.js';

export default {
  id: 'dots',
  name: 'Polka Dots',
  group: 'patterns',
  notes: 'Uniform dot overlay. Fill with solid color, with the image at the same spot, or with the image over a background.',
  defaults: {
    spacing: 22,
    radius: 5,
    color: '#000000',
    opacity: 1,
    blend: 'source-over',
    stagger: true,
    sample: 'color',
    bgColor: '#ffffff',
    offsetX: 0,
    offsetY: 0
  },
  controls: [
    { key: 'spacing', label: 'SPACING PX', type: 'range', min: 6, max: 80, step: 1, pixelScale: 'distance' },
    { key: 'radius',  label: 'RADIUS PX',  type: 'range', min: 1, max: 30, step: 1, pixelScale: 'distance' },
    { key: 'opacity', label: 'OPACITY',    type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'stagger', label: 'STAGGER', type: 'toggle', options: [
      { value: true,  label: 'ON' }, { value: false, label: 'OFF' }
    ]},
    { key: 'sample', label: 'FILL', type: 'select', options: [
      { value: 'color',         label: 'Solid color' },
      { value: 'image',         label: 'Image (over image)' },
      { value: 'image-cutout',  label: 'Image (over bg)' }
    ]},
    { key: 'offsetX', label: 'SAMPLE OFFSET X', type: 'range', min: -100, max: 100, step: 1, pixelScale: 'distance' },
    { key: 'offsetY', label: 'SAMPLE OFFSET Y', type: 'range', min: -100, max: 100, step: 1, pixelScale: 'distance' },
    { key: 'blend',   label: 'BLEND', type: 'select', options: [
      { value: 'source-over', label: 'Normal' },
      { value: 'multiply',    label: 'Multiply' },
      { value: 'screen',      label: 'Screen' },
      { value: 'difference',  label: 'Difference' }
    ]},
    { key: 'color',   label: 'DOT',         type: 'color' },
    { key: 'bgColor', label: 'BG (cutout)', type: 'color' }
  ],
  apply(src, dst, params) {
    const {
      spacing, radius, color, opacity, blend, stagger,
      sample = 'color', bgColor = '#ffffff',
      offsetX = 0, offsetY = 0
    } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const dctx = ctxOf(dst);

    const drawDots = (ctx, fillStyle) => {
      ctx.fillStyle = fillStyle;
      let row = 0;
      for (let y = -radius; y < H + radius; y += spacing, row++) {
        const xOff = stagger && row % 2 === 1 ? spacing / 2 : 0;
        for (let x = -radius + xOff; x < W + radius; x += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // ----- 1. Paint the base -----
    dctx.clearRect(0, 0, W, H);
    if (sample === 'image-cutout') {
      dctx.fillStyle = bgColor;
      dctx.fillRect(0, 0, W, H);
    } else {
      dctx.drawImage(src, 0, 0);
    }

    // ----- 2. Paint the dot overlay -----
    if (sample === 'color') {
      dctx.save();
      dctx.globalAlpha = opacity;
      dctx.globalCompositeOperation = blend;
      drawDots(dctx, color);
      dctx.restore();
    } else {
      const overlay = document.createElement('canvas');
      overlay.width = W; overlay.height = H;
      const octx = overlay.getContext('2d');

      // Draw dot mask (color irrelevant, only alpha matters).
      drawDots(octx, '#ffffff');

      // Mask the source image with the dot shapes.
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
