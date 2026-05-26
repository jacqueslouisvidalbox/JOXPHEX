// Mirror split: 4-quadrant mirroring from a single source quadrant.
import { ctxOf } from './_common.js';

export default {
  id: 'mirrorSplit',
  name: 'Mirror Split',
  group: 'warp',
  notes: 'Source quadrant is mirrored across both axes. Pick which quadrant feeds.',
  defaults: { source: 'TL', axis: 'both' },
  controls: [
    { key: 'source', label: 'SOURCE QUAD', type: 'select', options: [
      { value: 'TL', label: 'Top-Left' },
      { value: 'TR', label: 'Top-Right' },
      { value: 'BL', label: 'Bottom-Left' },
      { value: 'BR', label: 'Bottom-Right' }
    ]},
    { key: 'axis', label: 'AXIS', type: 'select', options: [
      { value: 'both', label: 'Both axes' },
      { value: 'h',    label: 'Horizontal only' },
      { value: 'v',    label: 'Vertical only' }
    ]}
  ],
  apply(src, dst, params) {
    const { source, axis } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const dctx = ctxOf(dst);
    dctx.clearRect(0, 0, W, H);

    const hw = W / 2, hh = H / 2;
    // Source quadrant rect in the original image:
    const sx = source.includes('R') ? hw : 0;
    const sy = source.includes('B') ? hh : 0;

    function place(tx, ty, flipX, flipY) {
      dctx.save();
      dctx.translate(tx + (flipX ? hw : 0), ty + (flipY ? hh : 0));
      dctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      dctx.drawImage(src, sx, sy, hw, hh, 0, 0, hw, hh);
      dctx.restore();
    }

    if (axis === 'both') {
      place(0,  0,  false, false);
      place(hw, 0,  true,  false);
      place(0,  hh, false, true);
      place(hw, hh, true,  true);
    } else if (axis === 'h') {
      // Mirror left/right; stretch source vertically to full height.
      dctx.drawImage(src, sx, sy, hw, hh, 0, 0, hw, H);
      dctx.save();
      dctx.translate(W, 0);
      dctx.scale(-1, 1);
      dctx.drawImage(src, sx, sy, hw, hh, 0, 0, hw, H);
      dctx.restore();
    } else {
      // 'v' — mirror top/bottom; stretch source horizontally.
      dctx.drawImage(src, sx, sy, hw, hh, 0, 0, W, hh);
      dctx.save();
      dctx.translate(0, H);
      dctx.scale(1, -1);
      dctx.drawImage(src, sx, sy, hw, hh, 0, 0, W, hh);
      dctx.restore();
    }
  }
};
