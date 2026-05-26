import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { drawImageToCanvas, fitWithin } from '../utils/image.js';
import { applyChain } from '../utils/chain.js';
import { filters as registry } from '../filters/registry.js';

const PREVIEW_MAX = 1100;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;

const PreviewCanvas = forwardRef(function PreviewCanvas(
  { source, chain, onStatus, zoom, tx, ty, setZoom, setTx, setTy, compareMode },
  ref
) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const sourceCanvasRef = useRef(null);
  const sourceKeyRef = useRef(null);
  const dragRef = useRef(null);
  const draggingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    getViewportRect: () => viewportRef.current?.getBoundingClientRect() || null
  }), []);

  // Render filter chain at preview resolution.
  useEffect(() => {
    if (!source) return;
    const dst = canvasRef.current;
    if (!dst) return;

    const { w, h } = fitWithin(source.width, source.height, PREVIEW_MAX, PREVIEW_MAX);
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
        await applyChain(sourceCanvasRef.current, dst, chain || [], registry);
        const ms = Math.round(performance.now() - t0);
        const enabled = (chain || []).filter((s) => s.enabled !== false).length;
        if (enabled === 0) onStatus?.(`PREVIEW ${w}×${h} · RAW · ${ms}MS`);
        else onStatus?.(`PREVIEW ${w}×${h} · ${enabled} STEP${enabled === 1 ? '' : 'S'} · ${ms}MS`);
      } catch (err) {
        console.error(err);
        onStatus?.(`ERR: ${err.message}`);
      }
    };
    const id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  }, [source, chain, onStatus, compareMode]);

  // ---- wheel ----
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

  // ---- drag ----
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseTx: tx, baseTy: ty };
    draggingRef.current = true;
    e.currentTarget.classList.add('grabbing');
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    setTx(d.baseTx + (e.clientX - d.startX));
    setTy(d.baseTy + (e.clientY - d.startY));
  };
  const onPointerUp = (e) => {
    if (dragRef.current) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    dragRef.current = null;
    draggingRef.current = false;
    e.currentTarget.classList.remove('grabbing');
  };

  const onDoubleClick = () => { setZoom(1); setTx(0); setTy(0); };

  return (
    <div
      className="canvas-viewport"
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
