// Run a sequence of filter steps using two ping-pong canvases.
// Each step writes into the destination canvas; we swap and feed forward.
//
// `scale` is the ratio of (this render's long edge) / (preview's long edge).
// Filters declare which of their params are pixel-distance ('distance') or
// per-pixel-rate ('inverse'). We pre-scale them so the same params produce
// visually equivalent output at preview and export resolutions.

export function scaleParams(filter, params, scale) {
  if (!filter || !filter.controls || scale === 1) return params;
  const out = { ...params };
  for (const c of filter.controls) {
    const v = out[c.key];
    if (typeof v !== 'number') continue;
    if (c.pixelScale === 'distance') {
      let s = v * scale;
      // Snap to integer when the control granularity is integer.
      if ((c.step ?? 1) >= 1) s = Math.max(1, Math.round(s));
      out[c.key] = s;
    } else if (c.pixelScale === 'inverse') {
      out[c.key] = v / scale;
    }
  }
  return out;
}

export async function applyChain(srcCanvas, dstCanvas, chain, filters, scale = 1) {
  const W = srcCanvas.width;
  const H = srcCanvas.height;
  dstCanvas.width = W;
  dstCanvas.height = H;

  const steps = chain.filter((s) => s.enabled !== false);

  // Empty chain → pass source through.
  if (steps.length === 0) {
    const dctx = dstCanvas.getContext('2d');
    dctx.clearRect(0, 0, W, H);
    dctx.drawImage(srcCanvas, 0, 0);
    return;
  }

  // Single step → write straight into dst (skip allocations).
  if (steps.length === 1) {
    const f = filters[steps[0].filterId];
    if (!f) return;
    await f.apply(srcCanvas, dstCanvas, scaleParams(f, steps[0].params, scale));
    return;
  }

  const a = document.createElement('canvas');
  const b = document.createElement('canvas');
  a.width = W; a.height = H;
  b.width = W; b.height = H;

  // Stage source into `a`.
  a.getContext('2d').drawImage(srcCanvas, 0, 0);

  let cur = a, next = b;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const f = filters[step.filterId];
    if (!f) continue;
    // Last step writes directly into dstCanvas to skip a final copy.
    const target = (i === steps.length - 1) ? dstCanvas : next;
    target.width = W; target.height = H;
    await f.apply(cur, target, scaleParams(f, step.params, scale));
    if (i !== steps.length - 1) {
      [cur, next] = [next, cur];
    }
  }
}
