import { copySource } from './_common.js';

export default {
  id: 'passthrough',
  name: 'Original',
  group: 'classics',
  notes: 'No-op. Useful as a baseline.',
  defaults: {},
  controls: [],
  apply(src, dst) {
    copySource(src, dst);
  }
};
