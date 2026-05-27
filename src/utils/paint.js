// Shared stroke-rendering helper for interactive Paint Mode.
//
// Strokes are stored in SOURCE-IMAGE coordinates so they render at the same
// proportional position regardless of preview/export size. Each stroke
// carries a settings snapshot (scale, opacity, spacing) taken at draw time,
// so changing the live paint settings later doesn't retroactively alter old
// strokes.
//
//   stroke = {
//     points:   [{ x, y }, ...],          // in source image pixels
//     settings: { scale, opacity, spacing }
//   }
//
//   scale    — multiplier on brush native dimensions (at SOURCE resolution)
//   opacity  — 0..1, applied as globalAlpha
//   spacing  — fraction of brush min-dim used as gap between stamps along
//              the stroke (0.05 = very dense; 1.0 = each stamp barely
//              touches the next)

export function drawStrokes(strokes, brush, targetCanvas, sourceW, sourceH) {
  if (!strokes || strokes.length === 0 || !brush) return;
  if (!targetCanvas || !sourceW || !sourceH) return;

  const brushW = brush.naturalWidth || brush.width;
  const brushH = brush.naturalHeight || brush.height;
  if (!brushW || !brushH) return;

  const ctx = targetCanvas.getContext('2d');
  const scaleToTarget = targetCanvas.width / sourceW;

  for (const stroke of strokes) {
    if (!stroke || !stroke.points || stroke.points.length === 0) continue;
    const { scale, opacity, spacing } = stroke.settings || { scale: 0.3, opacity: 1, spacing: 0.25 };

    // Stamp size in TARGET-canvas pixels.
    const sw = Math.max(1, brushW * scale * scaleToTarget);
    const sh = Math.max(1, brushH * scale * scaleToTarget);
    const halfW = sw / 2;
    const halfH = sh / 2;
    const stampGap = Math.max(1, Math.min(sw, sh) * spacing);

    ctx.save();
    ctx.globalAlpha = opacity;

    const pts = stroke.points;
    // Always stamp the first point.
    const first = pts[0];
    ctx.drawImage(brush, first.x * scaleToTarget - halfW, first.y * scaleToTarget - halfH, sw, sh);

    // Walk subsequent segments, stamping every `stampGap` target pixels.
    let leftover = stampGap; // distance remaining until next stamp
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const ax = a.x * scaleToTarget;
      const ay = a.y * scaleToTarget;
      const bx = b.x * scaleToTarget;
      const by = b.y * scaleToTarget;
      const dx = bx - ax;
      const dy = by - ay;
      const segLen = Math.hypot(dx, dy);
      if (segLen === 0) continue;
      const ux = dx / segLen;
      const uy = dy / segLen;
      let pos = leftover;
      while (pos <= segLen) {
        const x = ax + ux * pos;
        const y = ay + uy * pos;
        ctx.drawImage(brush, x - halfW, y - halfH, sw, sh);
        pos += stampGap;
      }
      leftover = pos - segLen;
    }

    ctx.restore();
  }
}
