// Swap or permute R/G/B channels.
import { ctxOf, putImageData } from './_common.js';

const ORDERS = {
  rgb: [0, 1, 2],
  rbg: [0, 2, 1],
  grb: [1, 0, 2],
  gbr: [1, 2, 0],
  brg: [2, 0, 1],
  bgr: [2, 1, 0]
};

export default {
  id: 'channelSwap',
  name: 'Channel Swap',
  group: 'color',
  notes: 'Permute the RGB channels. 6 possible orderings.',
  defaults: { order: 'bgr', invertR: false, invertG: false, invertB: false },
  controls: [
    { key: 'order', label: 'ORDER', type: 'select', options: [
      { value: 'rgb', label: 'RGB (identity)' },
      { value: 'rbg', label: 'RBG' },
      { value: 'grb', label: 'GRB' },
      { value: 'gbr', label: 'GBR' },
      { value: 'brg', label: 'BRG' },
      { value: 'bgr', label: 'BGR (swap R/B)' }
    ]},
    { key: 'invertR', label: 'INVERT R', type: 'toggle', options: [
      { value: false, label: 'OFF' }, { value: true, label: 'ON' }
    ]},
    { key: 'invertG', label: 'INVERT G', type: 'toggle', options: [
      { value: false, label: 'OFF' }, { value: true, label: 'ON' }
    ]},
    { key: 'invertB', label: 'INVERT B', type: 'toggle', options: [
      { value: false, label: 'OFF' }, { value: true, label: 'ON' }
    ]}
  ],
  apply(src, dst, params) {
    const { order, invertR, invertG, invertB } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const sctx = ctxOf(src);
    const sd = sctx.getImageData(0, 0, W, H).data;
    const out = sctx.createImageData(W, H);
    const od = out.data;
    const [aR, aG, aB] = ORDERS[order] || ORDERS.rgb;

    for (let i = 0; i < sd.length; i += 4) {
      let r = sd[i + aR], g = sd[i + aG], b = sd[i + aB];
      if (invertR) r = 255 - r;
      if (invertG) g = 255 - g;
      if (invertB) b = 255 - b;
      od[i] = r; od[i + 1] = g; od[i + 2] = b; od[i + 3] = 255;
    }
    putImageData(dst, out);
  }
};
