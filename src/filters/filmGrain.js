// Per-pixel additive noise. Deterministic via seed.
import { ctxOf, putImageData, clamp, luminance } from './_common.js';
import { mulberry32 } from '../utils/image.js';

export default {
  id: 'filmGrain',
  name: 'Film Grain',
  group: 'stylize',
  notes: 'Seeded additive noise. SHADOW BIAS concentrates grain in dark areas.',
  defaults: { amount: 20, seed: 42, shadowBias: 0.4, monochrome: true },
  controls: [
    { key: 'amount',     label: 'AMOUNT',      type: 'range', min: 0, max: 80, step: 1 },
    { key: 'shadowBias', label: 'SHADOW BIAS', type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'seed',       label: 'SEED',        type: 'range', min: 1, max: 99999, step: 1 },
    { key: 'monochrome', label: 'MODE', type: 'toggle', options: [
      { value: true,  label: 'MONO' },
      { value: false, label: 'COLOR' }
    ]}
  ],
  apply(src, dst, params) {
    const { amount, seed, shadowBias, monochrome } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const img = sctx.getImageData(0, 0, W, H);
    const d = img.data;
    const rng = mulberry32(seed);

    for (let i = 0; i < d.length; i += 4) {
      const lum = luminance(d[i], d[i + 1], d[i + 2]) / 255;
      // Bias: more grain in darker areas when shadowBias > 0
      const bias = 1 - shadowBias * (1 - lum);
      // Bias inversion (the comment above is intentionally for "more in shadows");
      // here we use (shadowBias)*(1-lum) + (1-shadowBias)*1 form for clarity
      const mult = (1 - shadowBias) + shadowBias * (1 - lum);
      const eff = amount * mult;
      if (monochrome) {
        const n = (rng() - 0.5) * 2 * eff;
        d[i]     = clamp(d[i]     + n, 0, 255);
        d[i + 1] = clamp(d[i + 1] + n, 0, 255);
        d[i + 2] = clamp(d[i + 2] + n, 0, 255);
      } else {
        d[i]     = clamp(d[i]     + (rng() - 0.5) * 2 * eff, 0, 255);
        d[i + 1] = clamp(d[i + 1] + (rng() - 0.5) * 2 * eff, 0, 255);
        d[i + 2] = clamp(d[i + 2] + (rng() - 0.5) * 2 * eff, 0, 255);
      }
    }
    putImageData(dst, img);
  }
};
