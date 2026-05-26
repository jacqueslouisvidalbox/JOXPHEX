// Repeat the image as an N×N grid. Optional mirror toggle reflects every
// other tile for a kaleidoscopic wallpaper effect.
import { ctxOf } from './_common.js';

export default {
  id: 'tile',
  name: 'Tile Repeat',
  group: 'tiling',
  notes: 'Image is repeated in an N×N grid. Mirror toggle reflects alternates.',
  defaults: { tilesX: 3, tilesY: 3, mirror: true },
  controls: [
    { key: 'tilesX', label: 'TILES X', type: 'range', min: 1, max: 10, step: 1 },
    { key: 'tilesY', label: 'TILES Y', type: 'range', min: 1, max: 10, step: 1 },
    { key: 'mirror', label: 'MIRROR', type: 'toggle', options: [
      { value: true,  label: 'ON' }, { value: false, label: 'OFF' }
    ]}
  ],
  apply(src, dst, params) {
    const { tilesX, tilesY, mirror } = params;
    const W = src.width, H = src.height;
    dst.width = W; dst.height = H;
    const dctx = ctxOf(dst);
    dctx.clearRect(0, 0, W, H);

    const cw = W / tilesX;
    const ch = H / tilesY;

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        dctx.save();
        dctx.translate(tx * cw, ty * ch);
        let sx = 1, sy = 1;
        if (mirror) {
          if (tx % 2 === 1) sx = -1;
          if (ty % 2 === 1) sy = -1;
        }
        dctx.scale(sx, sy);
        const dx = sx < 0 ? -cw : 0;
        const dy = sy < 0 ? -ch : 0;
        dctx.drawImage(src, 0, 0, W, H, dx, dy, cw, ch);
        dctx.restore();
      }
    }
  }
};
