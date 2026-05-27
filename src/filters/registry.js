// Central filter registry. To add a new filter:
//   1. Create src/filters/<id>.js that default-exports a filter descriptor
//   2. Import it here and add its id to the appropriate group below.

import passthrough from './passthrough.js';

// Classics
import dither from './dither.js';
import pixelate from './pixelate.js';
import posterize from './posterize.js';
import ascii from './ascii.js';

// Color
import threshold from './threshold.js';
import channelSwap from './channelSwap.js';
import colorIsolation from './colorIsolation.js';
import gradientMap from './gradientMap.js';

// Blur / smooth
import blur from './blur.js';

// Halftone & print
import halftone from './halftone.js';
import lineScreen from './lineScreen.js';
import stipple from './stipple.js';
import crosshatch from './crosshatch.js';

// Warp / distort
import twirl from './twirl.js';
import pinch from './pinch.js';
import ripple from './ripple.js';
import kaleidoscope from './kaleidoscope.js';
import barrelDistortion from './barrelDistortion.js';
import mirrorSplit from './mirrorSplit.js';
import slitScan from './slitScan.js';
import flowField from './flowField.js';

// Tiling & mosaic
import hexPixelate from './hexPixelate.js';
import voronoi from './voronoi.js';
import tile from './tile.js';
import photomosaic from './photomosaic.js';

// Patterns
import stripes from './stripes.js';
import dots from './dots.js';
import photoBrush from './photoBrush.js';

// Edges & relief
import sobel from './sobel.js';
import contours from './contours.js';
import emboss from './emboss.js';

// Stylize
import sketch from './sketch.js';
import watercolor from './watercolor.js';
import cellShading from './cellShading.js';
import vignette from './vignette.js';
import filmGrain from './filmGrain.js';
import lensFlare from './lensFlare.js';

// Experimental
import rgbShift from './rgbShift.js';
import glitch from './glitch.js';

// Text-aware
import adaptiveThreshold from './adaptiveThreshold.js';
import edgeClean from './edgeClean.js';
import glyphMap from './glyphMap.js';

// Encryption
import encrypt from './encrypt.js';

const all = [
  passthrough,
  dither, pixelate, posterize, ascii,
  threshold, channelSwap, colorIsolation, gradientMap,
  blur,
  halftone, lineScreen, stipple, crosshatch,
  twirl, pinch, ripple, kaleidoscope, barrelDistortion, mirrorSplit, slitScan, flowField,
  hexPixelate, voronoi, tile, photomosaic,
  stripes, dots, photoBrush,
  sobel, contours, emboss,
  sketch, watercolor, cellShading, vignette, filmGrain, lensFlare,
  rgbShift, glitch,
  adaptiveThreshold, edgeClean, glyphMap,
  encrypt
];

export const filters = Object.fromEntries(all.map((f) => [f.id, f]));

export const filterGroups = [
  {
    id: 'classics',
    label: 'CLASSICS',
    filters: ['passthrough', 'dither', 'pixelate', 'posterize', 'ascii']
  },
  {
    id: 'color',
    label: 'COLOR',
    filters: ['threshold', 'channelSwap', 'colorIsolation', 'gradientMap']
  },
  {
    id: 'blur',
    label: 'BLUR & SMOOTH',
    filters: ['blur']
  },
  {
    id: 'halftone',
    label: 'HALFTONE / PRINT',
    filters: ['halftone', 'lineScreen', 'stipple', 'crosshatch']
  },
  {
    id: 'warp',
    label: 'WARP / DISTORT',
    filters: ['twirl', 'pinch', 'ripple', 'kaleidoscope', 'barrelDistortion', 'mirrorSplit', 'slitScan', 'flowField']
  },
  {
    id: 'tiling',
    label: 'TILING & MOSAIC',
    filters: ['hexPixelate', 'voronoi', 'tile', 'photomosaic']
  },
  {
    id: 'patterns',
    label: 'PATTERNS',
    filters: ['stripes', 'dots', 'photoBrush']
  },
  {
    id: 'edges',
    label: 'EDGES & RELIEF',
    filters: ['sobel', 'contours', 'emboss']
  },
  {
    id: 'stylize',
    label: 'STYLIZE',
    filters: ['sketch', 'watercolor', 'cellShading', 'vignette', 'filmGrain', 'lensFlare']
  },
  {
    id: 'experimental',
    label: 'EXPERIMENTAL',
    filters: ['rgbShift', 'glitch']
  },
  {
    id: 'text',
    label: 'TEXT-AWARE',
    filters: ['adaptiveThreshold', 'edgeClean', 'glyphMap']
  },
  {
    id: 'encryption',
    label: 'ENCRYPTION',
    filters: ['encrypt']
  }
];
