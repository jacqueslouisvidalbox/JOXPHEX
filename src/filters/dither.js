// Floyd-Steinberg / Atkinson / Bayer ordered dithering.
import { ctxOf, getImageData, putImageData, BAYER_4, BAYER_8, clamp } from './_common.js';

function quantize(v, levels) {
  const step = 255 / (levels - 1);
  return Math.round(v / step) * step;
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function applyDuotone(out, dark, light) {
  // out is [r,g,b] from grayscale dither path — but we get there by mapping
  // the quantized luminance back into a duotone palette.
  // Here we treat r==g==b as the luminance value to remap.
  const t = out[0] / 255;
  return [
    Math.round(dark[0] + (light[0] - dark[0]) * t),
    Math.round(dark[1] + (light[1] - dark[1]) * t),
    Math.round(dark[2] + (light[2] - dark[2]) * t)
  ];
}

export default {
  id: 'dither',
  name: 'Dither',
  group: 'classics',
  notes: 'Error-diffusion or ordered dithering. Tunable level count.',
  defaults: {
    method: 'floyd',
    levels: 2,
    monochrome: true,
    dark: '#0a0a0a',
    light: '#ebe6dc',
    serpentine: true
  },
  controls: [
    { key: 'method', label: 'METHOD', type: 'select', options: [
      { value: 'floyd', label: 'Floyd-Steinberg' },
      { value: 'atkinson', label: 'Atkinson' },
      { value: 'bayer4', label: 'Bayer 4×4' },
      { value: 'bayer8', label: 'Bayer 8×8' },
      { value: 'threshold', label: 'Threshold (no error)' }
    ]},
    { key: 'levels', label: 'LEVELS', type: 'range', min: 2, max: 16, step: 1 },
    { key: 'monochrome', label: 'MODE', type: 'toggle', options: [
      { value: true, label: 'MONO' }, { value: false, label: 'RGB' }
    ]},
    { key: 'serpentine', label: 'SERPENTINE', type: 'toggle', options: [
      { value: true, label: 'ON' }, { value: false, label: 'OFF' }
    ]},
    { key: 'dark', label: 'DARK', type: 'color' },
    { key: 'light', label: 'LIGHT', type: 'color' }
  ],
  apply(src, dst, params) {
    const { method, levels, monochrome, serpentine, dark, light } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const img = sctx.getImageData(0, 0, W, H);
    const d = img.data;

    // To monochrome buffer if needed
    const channels = monochrome ? 1 : 3;
    const buf = monochrome
      ? new Float32Array(W * H)
      : new Float32Array(W * H * 3);

    if (monochrome) {
      for (let i = 0, j = 0; j < buf.length; i += 4, j++) {
        buf[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      }
    } else {
      for (let i = 0, j = 0; i < d.length; i += 4, j += 3) {
        buf[j] = d[i]; buf[j + 1] = d[i + 1]; buf[j + 2] = d[i + 2];
      }
    }

    const darkRGB = hexToRgb(dark);
    const lightRGB = hexToRgb(light);

    const matrix = method === 'bayer4' ? BAYER_4 : method === 'bayer8' ? BAYER_8 : null;
    const mSize = method === 'bayer4' ? 4 : method === 'bayer8' ? 8 : 0;
    const isOrdered = !!matrix;
    const isThreshold = method === 'threshold';

    // Error-diffusion neighbors:
    // Floyd-Steinberg: [(+1,0) 7/16] [(-1,+1) 3/16] [(0,+1) 5/16] [(+1,+1) 1/16]
    // Atkinson: spread 1/8 to (+1,0),(+2,0),(-1,+1),(0,+1),(+1,+1),(0,+2)
    const FS = [
      [+1, 0, 7 / 16],
      [-1, 1, 3 / 16],
      [ 0, 1, 5 / 16],
      [+1, 1, 1 / 16]
    ];
    const ATK = [
      [+1, 0, 1 / 8],
      [+2, 0, 1 / 8],
      [-1, 1, 1 / 8],
      [ 0, 1, 1 / 8],
      [+1, 1, 1 / 8],
      [ 0, 2, 1 / 8]
    ];
    const diffusion = method === 'atkinson' ? ATK : FS;

    function idx(x, y, c) {
      if (channels === 1) return y * W + x;
      return (y * W + x) * 3 + c;
    }

    for (let y = 0; y < H; y++) {
      const lToR = !serpentine || (y % 2 === 0);
      const xStart = lToR ? 0 : W - 1;
      const xEnd = lToR ? W : -1;
      const dx = lToR ? 1 : -1;
      for (let x = xStart; x !== xEnd; x += dx) {
        for (let c = 0; c < channels; c++) {
          const i = idx(x, y, c);
          let oldVal = buf[i];

          if (isOrdered) {
            const m = matrix[y % mSize][x % mSize];
            // Shift the value by (m - 0.5) * (step) to bias quantization.
            const step = 255 / (levels - 1);
            oldVal = clamp(oldVal + (m - 0.5) * step, 0, 255);
          }

          const newVal = isThreshold || isOrdered
            ? quantize(oldVal, levels)
            : quantize(clamp(oldVal, 0, 255), levels);

          buf[i] = newVal;

          if (!isOrdered && !isThreshold) {
            const err = oldVal - newVal;
            for (const [ox, oy, w] of diffusion) {
              const nx = x + ox * dx;
              const ny = y + oy;
              if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                buf[idx(nx, ny, c)] += err * w;
              }
            }
          }
        }
      }
    }

    const outImg = sctx.createImageData(W, H);
    const o = outImg.data;
    if (monochrome) {
      for (let j = 0, i = 0; j < buf.length; j++, i += 4) {
        const lum = clamp(Math.round(buf[j]), 0, 255);
        const [R, G, B] = applyDuotone([lum], darkRGB, lightRGB);
        o[i] = R; o[i + 1] = G; o[i + 2] = B; o[i + 3] = 255;
      }
    } else {
      for (let j = 0, i = 0; i < o.length; j += 3, i += 4) {
        o[i] = clamp(buf[j], 0, 255);
        o[i + 1] = clamp(buf[j + 1], 0, 255);
        o[i + 2] = clamp(buf[j + 2], 0, 255);
        o[i + 3] = 255;
      }
    }
    putImageData(dst, outImg);
  }
};
