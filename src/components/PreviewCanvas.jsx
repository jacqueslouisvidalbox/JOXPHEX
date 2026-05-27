import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { drawImageToCanvas, fitWithin } from '../utils/image.js';
import { applyChain } from '../utils/chain.js';
import { drawStrokes } from '../utils/paint.js';
import { filters as registry } from '../filters/registry.js';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;

const PreviewCanvas = forwardRef(function PreviewCanvas(
  {
    source, chain, onStatus,
    zoom, tx, ty, setZoom, setTx, setTy,
    compareMode, previewMax = 1100, brush = null,
    paintMode = false, strokes = [],
    onStrokeStart, onStrokeExtend
  },
  ref
) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const sourceCanvasRef = useRef(null);   // cached source at preview resolution
  const sourceKeyRef = useRef(null);
  const paintedSourceRef = useRef(null);  // reusable canvas for source + strokes composite

  // Multi-pointer gesture state.
  const pointersRef = useRef(new Map());          // pointerId -> {x, y}
  const gestureRef = useRef(null);                // {mode, ...}

  // Live ref so handlers always read current state (avoid stale closures).
  const paintModeRef = useRef(paintMode); paintModeRef.current = paintMode;

  useImperativeHandle(ref, () => ({
    getViewportRect: () => viewportRef.current?.getBoundingClientRect() || null
  }), []);

  // Render filter chain at preview resolution.
  useEffect(() => {
    if (!source) return;
    const dst = canvasRef.current;
    if (!dst) return;

    const { w, h } = fitWithin(source.width, source.height, previewMax, previewMax);
    const key = `${source.src.length}:${w}x${h}`;
    if (!sourceCanvasRef.current || sourceKeyRef.current !== key) {
      const src = document.createElement('canvas');
      src.width = w;
      src.height = h;
      drawImageToCanvas(source, src);
      sourceCanvasRef.current = src;
      sourceKeyRef.current = key;
    }

    dst.width = w;
    dst.height = h;

    const run = async () => {
      const t0 = performance.now();
      try {
        if (compareMode) {
          const c = dst.getContext('2d');
          c.clearRect(0, 0, dst.width, dst.height);
          c.drawImage(sourceCanvasRef.current, 0, 0);
          onStatus?.(`◀ VIEWING ORIGINAL · ${w}×${h}`);
          return;
        }

        // Paint strokes feed into the chain by being composited onto the
        // source first. The chain then processes (source + strokes).
        let chainInput = sourceCanvasRef.current;
        const hasStrokes = brush && strokes && strokes.length > 0;
        if (hasStrokes) {
          if (!paintedSourceRef.current) {
            paintedSourceRef.current = document.createElement('canvas');
          }
          const ps = paintedSourceRef.current;
          ps.width = w; ps.height = h;
          const pctx = ps.getContext('2d');
          pctx.clearRect(0, 0, w, h);
          pctx.drawImage(sourceCanvasRef.current, 0, 0);
          drawStrokes(strokes, brush, ps, source.width, source.height);
          chainInput = ps;
        }

        await applyChain(chainInput, dst, chain || [], registry, 1, { brush });
        const ms = Math.round(performance.now() - t0);
        const enabled = (chain || []).filter((s) => s.enabled !== false).length;
        const paintTag = hasStrokes ? ` · ${strokes.length} STROKE${strokes.length === 1 ? '' : 'S'}` : '';
        if (enabled === 0) onStatus?.(`PREVIEW ${w}×${h} · RAW${paintTag} · ${ms}MS`);
        else onStatus?.(`PREVIEW ${w}×${h} · ${enabled} STEP${enabled === 1 ? '' : 'S'}${paintTag} · ${ms}MS`);
      } catch (err) {
        console.error(err);
        onStatus?.(`ERR: ${err.message}`);
      }
    };
    const id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  }, [source, chain, onStatus, compareMode, previewMax, brush, strokes]);

  // ---- wheel zoom (desktop) ----
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dir = e.deltaY < 0 ? 1 : -1;
    const factor = Math.pow(1.0015, dir * Math.min(60, Math.abs(e.deltaY)));
    setZoom((z) => {
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
      if (nz === z) return z;
      setTx((prev) => mx - (mx - prev) * (nz / z));
      setTy((prev) => my - (my - prev) * (nz / z));
      return nz;
    });
  }, [setZoom, setTx, setTy]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // ---- pointer / touch gestures ----
  // 1 pointer  → pan
  // 2 pointers → pinch zoom + pan around centroid
  // Restarts the gesture baseline whenever the pointer count changes.

  const startGesture = useCallback(() => {
    const vp = viewportRef.current;
    const rect = vp ? vp.getBoundingClientRect() : { left: 0, top: 0 };
    const pts = [...pointersRef.current.values()];
    if (pts.length === 1) {
      gestureRef.current = {
        mode: 'pan',
        startX: pts[0].x,
        startY: pts[0].y,
        baseTx: tx,
        baseTy: ty
      };
    } else if (pts.length >= 2) {
      const a = pts[0], b = pts[1];
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      gestureRef.current = {
        mode: 'pinch',
        initialDistance: dist,
        initialCx: cx,
        initialCy: cy,
        rectLeft: rect.left,
        rectTop: rect.top,
        baseZoom: zoom,
        baseTx: tx,
        baseTy: ty
      };
    } else {
      gestureRef.current = null;
    }
  }, [tx, ty, zoom]);

  // Convert screen coords → source-image coords.
  //
  // We use the VIEWPORT's rect as the stable reference frame (it never has
  // a transform applied), then manually invert the canvas's transform.
  // The canvas's natural CSS layout box sits at (0,0) of the viewport
  // before its `transform: translate(tx, ty) scale(zoom)` is applied
  // (with origin 0,0). So:
  //   1. Convert clientX/Y → viewport-local CSS px
  //   2. Subtract translate, divide by zoom → canvas-CSS-pixel coord
  //   3. Scale by source.size / canvas.clientSize → source pixel
  const screenToSource = useCallback((clientX, clientY) => {
    if (!source) return null;
    const vp = viewportRef.current;
    const canvas = canvasRef.current;
    if (!vp || !canvas) return null;
    const vpRect = vp.getBoundingClientRect();
    const cssW = canvas.clientWidth  || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    if (!cssW || !cssH) return null;
    const vx = clientX - vpRect.left;
    const vy = clientY - vpRect.top;
    const cssX = (vx - tx) / zoom;
    const cssY = (vy - ty) / zoom;
    return {
      x: cssX * source.width  / cssW,
      y: cssY * source.height / cssH
    };
  }, [source, tx, ty, zoom]);

  const onPointerDown = (e) => {
    // Only react to primary button for mouse; touch/pen are always primary (button=0).
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // PAINT MODE: first pointer becomes a stroke. Additional pointers in
    // paint mode are ignored (we don't mix paint with pinch zoom — wheel
    // zoom still works on desktop).
    if (paintModeRef.current && pointersRef.current.size === 0) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const src = screenToSource(e.clientX, e.clientY);
      if (src) {
        onStrokeStart?.(src);
        // Debug aid: surface the computed source coord so the user can
        // verify the cursor-to-source mapping is on target.
        onStatus?.(`PAINT @ src ${Math.round(src.x)}, ${Math.round(src.y)}`);
      }
      gestureRef.current = { mode: 'paint', pointerId: e.pointerId };
      return;
    }
    if (paintModeRef.current) return; // ignore secondary pointers while painting

    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
    e.currentTarget.classList.add('grabbing');
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    if (!g) return;

    if (g.mode === 'paint') {
      if (e.pointerId !== g.pointerId) return;
      const src = screenToSource(e.clientX, e.clientY);
      if (src) onStrokeExtend?.(src);
      return;
    }

    if (g.mode === 'pan') {
      const pt = pointersRef.current.values().next().value;
      setTx(g.baseTx + (pt.x - g.startX));
      setTy(g.baseTy + (pt.y - g.startY));
    } else if (g.mode === 'pinch') {
      const pts = [...pointersRef.current.values()];
      if (pts.length < 2) return;
      const a = pts[0], b = pts[1];
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;

      const scaleFactor = dist / g.initialDistance;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, g.baseZoom * scaleFactor));
      const actualScale = newZoom / g.baseZoom;

      // Keep the gesture's initial centroid pinned to the screen.
      // Convert centroids to viewport-local coords.
      const lx0 = g.initialCx - g.rectLeft;
      const ly0 = g.initialCy - g.rectTop;
      const lx  = cx - g.rectLeft;
      const ly  = cy - g.rectTop;
      const newTx = lx - (lx0 - g.baseTx) * actualScale;
      const newTy = ly - (ly0 - g.baseTy) * actualScale;

      setZoom(newZoom);
      setTx(newTx);
      setTy(newTy);
    }
  };

  const endPointer = (e) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.delete(e.pointerId);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    const wasPaint = gestureRef.current?.mode === 'paint';
    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
      e.currentTarget.classList.remove('grabbing');
    } else if (!wasPaint) {
      // Restart with the remaining pointer(s) so we transition cleanly
      // between pinch and pan modes mid-gesture. In paint mode we don't
      // change gestures based on pointer count.
      startGesture();
    }
  };

  // In paint mode, double-click would otherwise reset zoom mid-stroke.
  const onDoubleClick = () => {
    if (paintModeRef.current) return;
    setZoom(1); setTx(0); setTy(0);
  };

  return (
    <div
      className={`canvas-viewport ${paintMode ? 'painting' : ''}`}
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={onDoubleClick}
    >
      <canvas
        ref={canvasRef}
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      />
    </div>
  );
});

export default PreviewCanvas;
export { MIN_ZOOM, MAX_ZOOM };
