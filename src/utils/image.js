// Image loading + canvas helpers.

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FILE READ FAILED'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('DECODE FAILED'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function drawImageToCanvas(img, canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

export function exportCanvas(canvas, mime, quality, filename) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        resolve();
      },
      mime,
      quality
    );
  });
}

// Fit image dimensions within (maxW, maxH) preserving aspect ratio.
export function fitWithin(w, h, maxW, maxH) {
  const r = Math.min(maxW / w, maxH / h, 1);
  return { w: Math.round(w * r), h: Math.round(h * r) };
}

// Convert ImageData to greyscale array (Uint8ClampedArray, length = w*h)
export function toGrey(imageData) {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    out[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}

// Mulberry32: seeded PRNG. Good for reproducible scrambles.
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// String → numeric seed (FNV-1a)
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Fisher-Yates shuffle using seeded RNG. Returns permutation array.
export function shuffledIndices(n, rng) {
  const a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
