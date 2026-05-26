# JOX PHEX

Raster image grid-distortion studio. Drop in a photo, picture of text, or
pattern, push it through a chain of grids, halftones, glitches, warps, and
experimental effects, then export at high resolution.

```
┌─────────────────────────────────────────────────────────────┐
│  JOX                                                        │
│  PHEX ▸ RASTER STUDIO                                       │
└─────────────────────────────────────────────────────────────┘
```

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (default http://localhost:5173). To build a
deployable static bundle:

```bash
npm run build
npm run preview
```

## Loading images

Four ways in, pick whichever is closest:

- Click **LOAD IMAGE**
- Drag-and-drop a file anywhere onto the window
- Paste from clipboard (`⌘V` / `Ctrl+V`)
- Click **CAMERA** to capture from webcam (HTTPS or localhost only)

## Chain model

Filters stack. Add as many as you want, reorder with ↑/↓, toggle individual
steps with the ● dot, drop steps with ✕. The preview re-renders the whole
chain on every change at up to 1100 px on the long edge so feedback stays
snappy. Export runs the same chain against the full-resolution source at
1×–4× scale.

Hold **SPACE** (or press the compare button) to peek at the original
underneath the chain.

## Recipes

Build a chain you like, type a name in the right rail, hit **SAVE**.
Recipes live in `localStorage` under `phex.recipes` and survive reloads.
Tap a saved recipe to load it back in; ✕ to delete.

## Filter catalog (42 filters across 12 groups)

**Classics** — passthrough, dither (FS/Atkinson/Bayer), pixelate, posterize,
ASCII

**Color** — threshold, channel swap, color isolation, gradient map

**Blur & smooth** — gaussian-style blur

**Halftone / print** — CMYK halftone, line screen, stipple, cross-hatch

**Warp / distort** — twirl, pinch, ripple, kaleidoscope, barrel distortion,
mirror split, slit-scan, flow field

**Tiling & mosaic** — hex pixelate, voronoi, tile, photomosaic

**Patterns** — stripes, dots

**Edges & relief** — sobel, contours, emboss

**Stylize** — sketch, watercolor, cell shading, vignette, film grain, lens
flare

**Experimental** — RGB shift, glitch

**Text-aware** — adaptive threshold, edge-preserve clean, glyph substitution

**Encryption** — passphrase-seeded block scramble + XOR keystream
(reversible visual cipher; not a real crypto primitive)

## Preview controls

- **Mouse wheel** — zoom toward cursor
- **Drag** — pan
- **AUTOCENTER** — back to 100% / centered
- **HOLD ORIGINAL** (or `SPACE`) — peek source under the chain

## Export

PNG or JPG. Scale slider goes 1×–4× off the source resolution (not the
preview). All filters annotate their pixel-scale params (`distance` or
`inverse`) so a slit-scan or dot-screen exports at the same visual
frequency you saw in the preview.

## Architecture

```
src/
  App.jsx                — top-level state, layout, upload, export
  styles.css
  components/
    PreviewCanvas.jsx    — live chain preview + zoom/pan
    ChainPanel.jsx       — chain stack UI
    FilterControls.jsx   — data-driven control rendering
    RecipesPanel.jsx     — save/load/delete chains
    CameraModal.jsx      — getUserMedia capture
  filters/
    registry.js          — central registry + group ordering
    _common.js           — shared helpers (Bayer matrices, block avg, ...)
    <id>.js              — one filter per file
  utils/
    chain.js             — ping-pong canvas chain application + scaleParams
    image.js             — file loading, PRNG, hashing
```

## Adding a filter

1. Create `src/filters/myFilter.js`:

```js
export default {
  id: 'myFilter',
  name: 'MY FILTER',
  group: 'experimental',
  notes: 'One-line description shown in the right rail.',
  defaults: { strength: 0.5 },
  controls: [
    {
      key: 'strength',
      label: 'STRENGTH',
      type: 'range',
      min: 0, max: 1, step: 0.01,
      pixelScale: 'distance'   // 'distance' | 'inverse' | undefined
    }
  ],
  apply(src, dst, params) {
    // src, dst are HTMLCanvasElement. dst is already sized to src.
    // Do work with src ctx, write to dst ctx.
  }
};
```

2. Import it in `src/filters/registry.js` and add its id to one of the
   `filterGroups`.

Control types supported by `FilterControls.jsx`: `range`, `select`,
`toggle`, `color`, `text`, `password`.

The `pixelScale` field is what makes export resolution-invariant: at
export time `chain.js` scales `distance` params up and `inverse` params
down so a 1024×1024 preview slit-scan period matches the 4096×4096 export.

## Deploy

Vercel auto-detects this as a Vite project — no `vercel.json` needed.

```bash
git init -b main
git add -A
git commit -m "init"
gh repo create jox-phex --public --source=. --push   # or push to GitHub manually
```

Then on [vercel.com](https://vercel.com): **Add New → Project → Import →
Deploy**. You get an HTTPS URL automatically, which is what the camera
capture needs.

## Known constraints

- Canvas 2D only — large images (>~6 megapixels) on heavy filters
  (voronoi, watercolor, glitch with many block swaps) can take several
  seconds.
- The encryption filter is reversible by design but is a visual cipher,
  not a substitute for real cryptography.
- Camera capture (`getUserMedia`) requires HTTPS or `localhost`. On a
  Vercel deploy this just works; opened from `file://` it won't.

## License

MIT — see [LICENSE](./LICENSE).
