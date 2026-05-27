// Photo brush: stamps a user-supplied brush image many times across the
// source. The brush is loaded into the global BRUSH slot in the right rail
// and passed in via the chain's `context.brush`. Controls govern density,
// scale, rotation, position jitter, opacity, and three colorize modes
// (native brush colors, tinted by the underlying source pixel, or
// flat-tinted with a chosen color).
import { ctxOf } from './_common.js';
import { mulberry32 } from '../utils/image.js';

export default {
  id: 'photoBrush',
  name: 'Photo Brush',
  group: 'patterns',
  notes: 'Stamps the loaded BRUSH image across the source. Load a brush in the right rail.',
  defaults: {
    spacing: 32,
    scale: 0.3,
    rotation: 30,
    jitter: 4,
    opacity: 1,
    colorize: 'native',
    color: '#000000',
    seed: 4242,
    base: 'image',
    bgColor: '#ffffff'
  },
  controls: [
    { key: 'spacing',  label: 'SPACING PX', type: 'range', min: 4,    max: 200, step: 1,    pixelScale: 'distance' },
    { key: 'scale',    label: 'BRUSH SCALE',type: 'range', min: 0.02, max: 3,   step: 0.02, pixelScale: 'distance' },
    { key: 'rotation', label: 'ROT JITTER°',type: 'range', min: 0,    max: 180, step: 1 },
    { key: 'jitter',   label: 'POS JITTER', type: 'range', min: 0,    max: 60,  step: 1,    pixelScale: 'distance' },
    { key: 'opacity',  label: 'OPACITY',    type: 'range', min: 0,    max: 1,   step: 0.05 },
    { key: 'colorize', label: 'COLORIZE', type: 'select', options: [
      { value: 'native', label: 'Brush colors' },
      { value: 'source', label: 'Source-tinted' },
      { value: 'mono',   label: 'Mono (color)' }
    ]},
    { key: 'base', label: 'BASE', type: 'select', options: [
      { value: 'image',       label: 'Source image' },
      { value: 'color',       label: 'BG color' },
      { value: 'transparent', label: 'Transparent' }
    ]},
    { key: 'seed',    label: 'SEED',    type: 'range', min: 1, max: 999999, step: 1 },
    { key: 'color',   label: 'MONO',    type: 'color' },
    { key: 'bgColor', label: 'BG',      type: 'color' }
  ],
  apply(src, dst, params, context) {
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const dctx = ctxOf(dst);

    const {
      spacing, scale, rotation, jitter, opacity,
      colorize = 'native', color = '#000000',
      base = 'image', bgColor = '#ffffff',
      seed = 1
    } = params;

    // ----- 1. Paint the base layer -----
    dctx.clearRect(0, 0, W, H);
    if (base === 'image') {
      dctx.drawImage(src, 0, 0);
    } else if (base === 'color') {
      dctx.fillStyle = bgColor;
      dctx.fillRect(0, 0, W, H);
    }
    // 'transparent' → leave it cleared

    // ----- 2. Need a brush to stamp -----
    const brush = context && context.brush;
    if (!brush) return;

    const brushW = brush.naturalWidth || brush.width;
    const brushH = brush.naturalHeight || brush.height;
    if (!brushW || !brushH) return;

    const stampW = Math.max(1, brushW * scale);
    const stampH = Math.max(1, brushH * scale);
    const halfW = stampW / 2;
    const halfH = stampH / 2;

    // ----- 3. Prepare tinting helpers (if needed) -----
    // We use a single offscreen "stamp canvas" for any colorize work so we
    // don't allocate per stamp. For 'mono' it's filled once and reused.
    // For 'source' it's redrawn per stamp with the underlying pixel color.
    let stampCanvas = null, stampCtx = null;
    if (colorize !== 'native') {
      stampCanvas = document.createElement('canvas');
      stampCanvas.width = brushW;
      stampCanvas.height = brushH;
      stampCtx = stampCanvas.getContext('2d');
    }

    let monoStamp = null;
    if (colorize === 'mono') {
      stampCtx.drawImage(brush, 0, 0);
      stampCtx.globalCompositeOperation = 'source-in';
      stampCtx.fillStyle = color;
      stampCtx.fillRect(0, 0, brushW, brushH);
      monoStamp = stampCanvas;
    }

    // Sample pixels from the source for 'source' colorize mode.
    let srcData = null;
    if (colorize === 'source') {
      const sctx = src.getContext('2d', { willReadFrequently: true });
      srcData = sctx.getImageData(0, 0, W, H).data;
    }

    const rnd = mulberry32((seed >>> 0) || 1);
    const rotRad = (rotation * Math.PI) / 180;

    // ----- 4. Stamp pass — staggered grid -----
    dctx.save();
    dctx.globalAlpha = opacity;

    let row = 0;
    for (let cy = 0; cy < H + spacing; cy += spacing, row++) {
      const xOff = row % 2 === 1 ? spacing / 2 : 0;
      for (let cx = xOff; cx < W + spacing; cx += spacing) {
        // jitter
        const jx = (rnd() - 0.5) * 2 * jitter;
        const jy = (rnd() - 0.5) * 2 * jitter;
        const x  = cx + jx;
        const y  = cy + jy;
        const rot = (rnd() - 0.5) * 2 * rotRad;

        // Pick the image to draw for this stamp
        let stampImg;
        if (colorize === 'native') {
          stampImg = brush;
        } else if (colorize === 'mono') {
          stampImg = monoStamp;
        } else {
          // 'source' — tint with the source pixel at (x, y)
          const sxi = Math.max(0, Math.min(W - 1, Math.round(x)));
          const syi = Math.max(0, Math.min(H - 1, Math.round(y)));
          const i = (syi * W + sxi) * 4;
          const r = srcData[i], g = srcData[i + 1], b = srcData[i + 2];
          stampCtx.globalCompositeOperation = 'source-over';
          stampCtx.clearRect(0, 0, brushW, brushH);
          stampCtx.drawImage(brush, 0, 0);
          stampCtx.globalCompositeOperation = 'source-in';
          stampCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          stampCtx.fillRect(0, 0, brushW, brushH);
          stampImg = stampCanvas;
        }

        dctx.save();
        dctx.translate(x, y);
        if (rot !== 0) dctx.rotate(rot);
        dctx.drawImage(stampImg, -halfW, -halfH, stampW, stampH);
        dctx.restore();
      }
    }

    dctx.restore();
  }
};
