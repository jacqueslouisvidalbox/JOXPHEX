// Reversible image "encryption": permute pixel blocks + XOR keystream.
// Same passphrase + same block size + same XOR setting reverses the operation.
//
// NOTE: This is a creative visual cipher, not cryptographic security. It is
// reversible by anyone who knows the parameters. For real secrecy, use a real
// cipher on the file bytes.
import { ctxOf, putImageData } from './_common.js';
import { mulberry32, hashSeed, shuffledIndices } from '../utils/image.js';

function makeKeystream(seed, length) {
  const rng = mulberry32(seed ^ 0xA5A5A5A5);
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = (rng() * 256) | 0;
  return out;
}

function xorCanvas(canvas, seed) {
  const c = canvas.getContext('2d', { willReadFrequently: true });
  const img = c.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const ks = makeKeystream(seed, d.length);
  for (let i = 0; i < d.length; i += 4) {
    d[i]     ^= ks[i];
    d[i + 1] ^= ks[i + 1];
    d[i + 2] ^= ks[i + 2];
    // leave alpha
  }
  c.putImageData(img, 0, 0);
}

// We only permute the full-block region so that source/destination block
// dimensions always match (otherwise partial-block swaps would lose data).
// The right/bottom edge strip is copied through unchanged.
function permuteBlocks({ src, dst, W, H, block, perm, invert }) {
  const cols = Math.floor(W / block);
  const rows = Math.floor(H / block);
  const fullW = cols * block;
  const fullH = rows * block;
  const dctx = ctxOf(dst);
  dctx.clearRect(0, 0, W, H);

  // Copy through the right and bottom remainder strips unchanged.
  if (fullW < W) {
    dctx.drawImage(src, fullW, 0, W - fullW, H, fullW, 0, W - fullW, H);
  }
  if (fullH < H) {
    dctx.drawImage(src, 0, fullH, fullW, H - fullH, 0, fullH, fullW, H - fullH);
  }

  // Snapshot the source so reads aren't affected by partial writes to dst.
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = W; srcCanvas.height = H;
  srcCanvas.getContext('2d').drawImage(src, 0, 0);

  for (let i = 0; i < perm.length; i++) {
    const fromIdx = invert ? i : perm[i];
    const toIdx   = invert ? perm[i] : i;
    const fr = Math.floor(fromIdx / cols), fc = fromIdx % cols;
    const tr = Math.floor(toIdx / cols),   tc = toIdx % cols;
    dctx.drawImage(
      srcCanvas,
      fc * block, fr * block, block, block,
      tc * block, tr * block, block, block
    );
  }
}

export default {
  id: 'encrypt',
  name: 'Encrypt / Decrypt',
  group: 'encryption',
  notes: 'Passphrase-keyed block scramble + optional XOR. Run twice with the same key to reverse.',
  defaults: {
    passphrase: 'stargate',
    block: 12,
    mode: 'encrypt',
    xor: true
  },
  controls: [
    { key: 'passphrase', label: 'KEY', type: 'password', placeholder: 'shared secret' },
    { key: 'block',      label: 'BLOCK PX', type: 'range', min: 4, max: 64, step: 1, pixelScale: 'distance' },
    { key: 'mode',       label: 'MODE', type: 'toggle', options: [
      { value: 'encrypt', label: 'ENC' },
      { value: 'decrypt', label: 'DEC' }
    ]},
    { key: 'xor',        label: 'XOR KEYSTREAM', type: 'toggle', options: [
      { value: true,  label: 'ON' },
      { value: false, label: 'OFF' }
    ]}
  ],
  apply(src, dst, params) {
    const { passphrase = '', block, mode, xor } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;

    const seed = hashSeed(passphrase || ' ');
    const cols = Math.floor(W / block);
    const rows = Math.floor(H / block);
    const N = cols * rows;
    const rng = mulberry32(seed);
    const perm = shuffledIndices(N, rng);
    const decrypt = mode === 'decrypt';

    // Encryption order: permute -> XOR.
    // Decryption order: XOR (undo) -> inverse permute.
    if (decrypt && xor) {
      // XOR the source first, into a working canvas, then permute that.
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      tmp.getContext('2d').drawImage(src, 0, 0);
      xorCanvas(tmp, seed);
      permuteBlocks({
        src: tmp, dst, W, H, block, perm, invert: true
      });
    } else if (decrypt) {
      permuteBlocks({ src, dst, W, H, block, perm, invert: true });
    } else {
      permuteBlocks({ src, dst, W, H, block, perm, invert: false });
      if (xor) xorCanvas(dst, seed);
    }
  }
};
