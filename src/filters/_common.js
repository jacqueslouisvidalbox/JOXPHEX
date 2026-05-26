// Shared filter helpers.

export function ctxOf(canvas) {
  return canvas.getContext('2d', { willReadFrequently: true });
}

export function copySource(src, dst) {
  const dctx = ctxOf(dst);
  dctx.clearRect(0, 0, dst.width, dst.height);
  dctx.drawImage(src, 0, 0, dst.width, dst.height);
}

export function getImageData(canvas) {
  const c = ctxOf(canvas);
  return c.getImageData(0, 0, canvas.width, canvas.height);
}

export function putImageData(canvas, data) {
  const c = ctxOf(canvas);
  c.putImageData(data, 0, 0);
}

// Sample the average color of a square block from imageData.
export function blockAverage(data, w, h, x0, y0, bw, bh) {
  let r = 0, g = 0, b = 0, count = 0;
  const x1 = Math.min(x0 + bw, w);
  const y1 = Math.min(y0 + bh, h);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      r += data[i]; g += data[i + 1]; b += data[i + 2];
      count++;
    }
  }
  if (count === 0) return [0, 0, 0];
  return [r / count, g / count, b / count];
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// 4x4 Bayer matrix (normalized 0..1)
export const BAYER_4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5]
].map(row => row.map(v => (v + 0.5) / 16));

// 8x8 Bayer matrix
export const BAYER_8 = (() => {
  const m = Array.from({length: 8}, () => new Array(8).fill(0));
  const base = [
    [ 0, 32,  8, 40,  2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44,  4, 36, 14, 46,  6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [ 3, 35, 11, 43,  1, 33,  9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47,  7, 39, 13, 45,  5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      m[y][x] = (base[y][x] + 0.5) / 64;
  return m;
})();

// Quantize a single channel value to N levels.
export function quantizeChannel(v, levels) {
  const step = 255 / (levels - 1);
  return Math.round(Math.round(v / step) * step);
}
