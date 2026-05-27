import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { filters, filterGroups } from './filters/registry.js';
import PreviewCanvas, { MIN_ZOOM, MAX_ZOOM } from './components/PreviewCanvas.jsx';
import FilterControls from './components/FilterControls.jsx';
import ChainPanel from './components/ChainPanel.jsx';
import RecipesPanel from './components/RecipesPanel.jsx';
import CameraModal from './components/CameraModal.jsx';
import { applyChain } from './utils/chain.js';
import { drawStrokes } from './utils/paint.js';
import { loadImageFromFile, drawImageToCanvas, exportCanvas, fitWithin } from './utils/image.js';

const PREVIEW_MAX_DESKTOP = 1100;
const PREVIEW_MAX_MOBILE = 600;
const MOBILE_QUERY = '(max-width: 768px)';

// Live media query — re-renders when the viewport crosses the breakpoint
// (orientation change, window resize, etc).
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, [query]);
  return matches;
}

let stepCounter = 0;
const nextStepId = () => ++stepCounter;

export default function App() {
  const [sourceImage, setSourceImage] = useState(null);
  const [chain, setChain] = useState([]);
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [exportFormat, setExportFormat] = useState('png');
  const [exportQuality, setExportQuality] = useState(0.95);
  const [exportScale, setExportScale] = useState(1);
  const [status, setStatus] = useState('READY');
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('phex.expandedGroups');
      if (saved) return new Set(JSON.parse(saved));
    } catch (_) {}
    return new Set(filterGroups.map((g) => g.id));
  });
  const [cameraOpen, setCameraOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const previewMax = isMobile ? PREVIEW_MAX_MOBILE : PREVIEW_MAX_DESKTOP;
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  // Drawers are mobile-only; close them automatically if we cross back to desktop.
  useEffect(() => {
    if (!isMobile) {
      setMobileFiltersOpen(false);
      setMobileSettingsOpen(false);
    }
  }, [isMobile]);

  // Tell CSS when the pinned mobile params tray is visible so the canvas can
  // shrink to make room.
  useEffect(() => {
    const on = isMobile && selectedStepId != null;
    document.body.classList.toggle('has-mobile-tray', on);
    return () => document.body.classList.remove('has-mobile-tray');
  }, [isMobile, selectedStepId]);

  const [recipes, setRecipes] = useState(() => {
    try {
      const saved = localStorage.getItem('phex.recipes');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {};
  });
  const fileRef = useRef(null);
  const brushFileRef = useRef(null);
  const previewRef = useRef(null);
  const brushPreviewRef = useRef(null);
  const [brushImage, setBrushImage] = useState(null);
  // brushRect is in BRUSH-NATIVE pixel coordinates: {x, y, w, h} | null
  const [brushRect, setBrushRect] = useState(null);
  const brushDragRef = useRef(null);   // {startX, startY} during selection drag

  // Reset the selection rect whenever the brush itself changes.
  useEffect(() => { setBrushRect(null); }, [brushImage]);

  // Display sizing for the brush-preview canvas (matches .brush-preview CSS).
  const brushFit = useMemo(() => {
    if (!brushImage) return null;
    const maxW = 200, maxH = 110;
    const s = Math.min(maxW / brushImage.width, maxH / brushImage.height, 1);
    return {
      previewW: Math.max(1, Math.round(brushImage.width * s)),
      previewH: Math.max(1, Math.round(brushImage.height * s)),
      scale: s
    };
  }, [brushImage]);

  // The "effective brush" the rest of the app sees. If the user has
  // selected a sub-rectangle, this is a cropped canvas of just that
  // region. Otherwise it's the original brush image. Filters, paint
  // mode, and export all read this; they don't know about the rect.
  const effectiveBrush = useMemo(() => {
    if (!brushImage) return null;
    if (!brushRect || brushRect.w < 2 || brushRect.h < 2) return brushImage;
    const W = brushImage.width, H = brushImage.height;
    const x = Math.max(0, Math.min(W - 1, brushRect.x));
    const y = Math.max(0, Math.min(H - 1, brushRect.y));
    const w = Math.max(1, Math.min(W - x, brushRect.w));
    const h = Math.max(1, Math.min(H - y, brushRect.h));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(brushImage, x, y, w, h, 0, 0, w, h);
    return c;
  }, [brushImage, brushRect]);

  // ----- Paint Mode -----
  // Strokes are stored in SOURCE-IMAGE coords so they survive
  // preview/export resolution differences. Each stroke captures the paint
  // settings active at the moment it was drawn. Strokes are session-only
  // (intentionally not serialized into recipes).
  const [paintMode, setPaintMode] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [paintSettings, setPaintSettings] = useState({
    scale: 0.3,
    opacity: 1,
    spacing: 0.25
  });

  useEffect(() => {
    try {
      localStorage.setItem('phex.expandedGroups', JSON.stringify([...expandedGroups]));
    } catch (_) {}
  }, [expandedGroups]);

  useEffect(() => {
    try {
      localStorage.setItem('phex.recipes', JSON.stringify(recipes));
    } catch (_) {}
  }, [recipes]);

  const saveRecipe = useCallback((name) => {
    setRecipes((prev) => ({
      ...prev,
      [name]: {
        steps: chain.map((s) => ({
          filterId: s.filterId,
          params: { ...s.params },
          enabled: s.enabled
        })),
        savedAt: Date.now()
      }
    }));
    setStatus(`SAVED RECIPE · ${name.toUpperCase()}`);
  }, [chain]);

  const loadRecipe = useCallback((name) => {
    const r = recipes[name];
    if (!r) return;
    const fresh = r.steps.map((s) => ({
      id: nextStepId(),
      filterId: s.filterId,
      params: { ...(s.params || {}) },
      enabled: s.enabled !== false
    }));
    setChain(fresh);
    setSelectedStepId(fresh.length ? fresh[0].id : null);
    setStatus(`LOADED RECIPE · ${name.toUpperCase()}`);
  }, [recipes]);

  const deleteRecipe = useCallback((name) => {
    setRecipes((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const expandAll = () => setExpandedGroups(new Set(filterGroups.map((g) => g.id)));
  const collapseAll = () => setExpandedGroups(new Set());
  const allExpanded = expandedGroups.size === filterGroups.length;

  // Reset viewport on new image.
  useEffect(() => {
    if (!sourceImage) return;
    setZoom(1); setTx(0); setTy(0);
  }, [sourceImage]);

  const zoomBy = useCallback((factor) => {
    const rect = previewRef.current?.getViewportRect();
    if (!rect) {
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
      return;
    }
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setZoom((z) => {
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
      if (nz === z) return z;
      setTx((prev) => cx - (cx - prev) * (nz / z));
      setTy((prev) => cy - (cy - prev) * (nz / z));
      return nz;
    });
  }, []);

  const fit = useCallback(() => { setZoom(1); setTx(0); setTy(0); }, []);

  // Spacebar hold to compare with original.
  useEffect(() => {
    const isTextTarget = (t) => {
      if (!t) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    };
    const onDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (isTextTarget(e.target)) return;
      e.preventDefault();
      setCompareMode(true);
    };
    const onUp = (e) => {
      if (e.code !== 'Space') return;
      if (isTextTarget(e.target)) return;
      setCompareMode(false);
    };
    document.addEventListener('keydown', onDown);
    document.addEventListener('keyup', onUp);
    return () => {
      document.removeEventListener('keydown', onDown);
      document.removeEventListener('keyup', onUp);
    };
  }, []);

  const selectedStep = chain.find((s) => s.id === selectedStepId) || null;
  const selectedFilter = selectedStep ? filters[selectedStep.filterId] : null;

  // ----- chain ops -----

  const addStep = useCallback((filterId) => {
    const f = filters[filterId];
    if (!f) return;
    const step = {
      id: nextStepId(),
      filterId,
      params: { ...(f.defaults || {}) },
      enabled: true
    };
    setChain((prev) => [...prev, step]);
    setSelectedStepId(step.id);
    // After adding a step on mobile, dismiss the filter drawer so the user
    // can see the result and tweak params via the pinned tray.
    if (isMobile) setMobileFiltersOpen(false);
  }, [isMobile]);

  // Selecting a step on mobile closes the settings drawer so the pinned
  // params tray is visible against the live preview.
  const selectStep = useCallback((id) => {
    setSelectedStepId(id);
    if (isMobile && id != null) setMobileSettingsOpen(false);
  }, [isMobile]);

  const removeStep = useCallback((id) => {
    setChain((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const next = prev.filter((s) => s.id !== id);
      if (selectedStepId === id) {
        // pick neighbor if any
        const fallback = next[idx] || next[idx - 1] || null;
        setSelectedStepId(fallback ? fallback.id : null);
      }
      return next;
    });
  }, [selectedStepId]);

  const toggleStep = useCallback((id) => {
    setChain((prev) => prev.map((s) =>
      s.id === id ? { ...s, enabled: s.enabled === false } : s
    ));
  }, []);

  const moveStep = useCallback((id, delta) => {
    setChain((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const j = idx + delta;
      if (j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });
  }, []);

  const clearChain = useCallback(() => {
    setChain([]);
    setSelectedStepId(null);
  }, []);

  const onSetParam = useCallback((key, value) => {
    setChain((prev) => prev.map((s) =>
      s.id === selectedStepId
        ? { ...s, params: { ...s.params, [key]: value } }
        : s
    ));
  }, [selectedStepId]);

  // ----- IO -----

  const onUpload = useCallback(async (file) => {
    if (!file) return;
    setBusy(true);
    setStatus(`LOADING ${(file.name || 'IMAGE').toUpperCase()}`);
    try {
      const img = await loadImageFromFile(file);
      setSourceImage(img);
      setStatus(`LOADED ${img.width}×${img.height}`);
    } catch (err) {
      setStatus(`ERROR: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  // Brush slot — a second image read by filters that paint with stamps
  // (currently just photoBrush). Lives in-session only.
  const onLoadBrush = useCallback(async (file) => {
    if (!file) return;
    try {
      const img = await loadImageFromFile(file);
      setBrushImage(img);
      setStatus(`BRUSH LOADED · ${img.width}×${img.height}`);
    } catch (err) {
      setStatus(`BRUSH ERROR: ${err.message}`);
    }
  }, []);

  // Paint-mode stroke callbacks. PreviewCanvas calls these with points
  // already converted into SOURCE-IMAGE coordinates.
  const startStroke = useCallback((srcPt) => {
    setStrokes((prev) => [
      ...prev,
      { points: [srcPt], settings: { ...paintSettings } }
    ]);
  }, [paintSettings]);

  const extendStroke = useCallback((srcPt) => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { ...last, points: [...last.points, srcPt] }];
    });
  }, []);

  const undoStroke  = useCallback(() => setStrokes((prev) => prev.slice(0, -1)), []);
  const clearStrokes = useCallback(() => setStrokes([]), []);

  // Strokes are tied to a specific source image; reset on new source.
  useEffect(() => {
    setStrokes([]);
    setPaintMode(false);
  }, [sourceImage]);

  // Paint mode needs a brush.
  useEffect(() => {
    if (!brushImage) setPaintMode(false);
  }, [brushImage]);

  // Render the brush-preview canvas: the brush, plus a dim mask + yellow
  // selection rectangle when the user has cropped a region.
  useEffect(() => {
    const canvas = brushPreviewRef.current;
    if (!canvas || !brushImage || !brushFit) return;
    const { previewW, previewH, scale } = brushFit;
    canvas.width = previewW;
    canvas.height = previewH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, previewW, previewH);
    ctx.drawImage(brushImage, 0, 0, previewW, previewH);

    if (brushRect && brushRect.w >= 2 && brushRect.h >= 2) {
      const rx = brushRect.x * scale;
      const ry = brushRect.y * scale;
      const rw = brushRect.w * scale;
      const rh = brushRect.h * scale;
      // Punched-out dim mask — outside selection darkens, inside stays bright.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, previewW, previewH);
      ctx.rect(rx, ry, rw, rh);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fill('evenodd');
      ctx.restore();
      // Yellow selection border.
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f4d11f';
      ctx.strokeRect(rx + 1, ry + 1, Math.max(0, rw - 2), Math.max(0, rh - 2));
    }
  }, [brushImage, brushRect, brushFit]);

  // Pointer drag on the brush preview defines the selection rect.
  const brushCanvasPos = (e) => {
    const canvas = brushPreviewRef.current;
    if (!canvas || !brushFit) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top)  * (canvas.height / rect.height);
    return {
      bx: Math.round(sx / brushFit.scale),
      by: Math.round(sy / brushFit.scale)
    };
  };

  const onBrushSelectDown = (e) => {
    if (!brushImage) return;
    const pos = brushCanvasPos(e);
    if (!pos) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    brushDragRef.current = { startX: pos.bx, startY: pos.by };
    setBrushRect({ x: pos.bx, y: pos.by, w: 0, h: 0 });
  };

  const onBrushSelectMove = (e) => {
    if (!brushDragRef.current) return;
    const pos = brushCanvasPos(e);
    if (!pos) return;
    const { startX, startY } = brushDragRef.current;
    setBrushRect({
      x: Math.min(startX, pos.bx),
      y: Math.min(startY, pos.by),
      w: Math.abs(pos.bx - startX),
      h: Math.abs(pos.by - startY)
    });
  };

  const onBrushSelectUp = (e) => {
    if (!brushDragRef.current) return;
    brushDragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    // Treat tiny accidental drags (just a click) as "clear selection".
    setBrushRect((r) => (r && r.w >= 4 && r.h >= 4) ? r : null);
  };

  // Drag-and-drop anywhere on the document; paste from clipboard.
  const [dragHover, setDragHover] = useState(false);
  useEffect(() => {
    let depth = 0;
    const onDragEnter = (e) => {
      if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      depth++;
      setDragHover(true);
    };
    const onDragOver = (e) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (e) => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragHover(false);
    };
    const onDrop = (e) => {
      e.preventDefault();
      depth = 0;
      setDragHover(false);
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) onUpload(file);
      else setStatus('DROP REJECTED · NOT AN IMAGE');
    };
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const file = it.getAsFile();
          if (file) { onUpload(file); e.preventDefault(); return; }
        }
      }
    };
    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('paste', onPaste);
    };
  }, [onUpload]);

  const onExport = async () => {
    if (!sourceImage) return;
    setBusy(true);
    setStatus(`EXPORTING ${exportFormat.toUpperCase()}…`);
    try {
      const W = Math.round(sourceImage.width * exportScale);
      const H = Math.round(sourceImage.height * exportScale);
      const src = document.createElement('canvas');
      const dst = document.createElement('canvas');
      src.width = dst.width = W;
      src.height = dst.height = H;
      drawImageToCanvas(sourceImage, src);
      // Paint strokes are composited INTO the source so the chain processes
      // them too. Points are in source-image coords; drawStrokes scales them
      // to the export canvas size automatically. The effective brush
      // already reflects any sub-region the user selected.
      if (strokes.length > 0 && effectiveBrush) {
        drawStrokes(strokes, effectiveBrush, src, sourceImage.width, sourceImage.height);
      }
      // Compute the ratio between this render's long edge and the preview's
      // long edge. Anything tagged pixelScale in a filter scales accordingly,
      // so a chain tuned in the preview produces the same look at any size.
      const previewFit = fitWithin(sourceImage.width, sourceImage.height, previewMax, previewMax);
      const previewLong = Math.max(previewFit.w, previewFit.h);
      const exportLong = Math.max(W, H);
      const renderScale = exportLong / previewLong;
      await applyChain(src, dst, chain, filters, renderScale, { brush: effectiveBrush });
      const mime = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
      const stamp = chain.length
        ? chain.filter(s => s.enabled !== false).map(s => s.filterId).join('-')
        : 'raw';
      exportCanvas(dst, mime, exportQuality, `joxphex_${stamp || 'raw'}_${Date.now()}.${exportFormat}`);
      setStatus(`EXPORTED ${W}×${H}`);
    } catch (err) {
      console.error(err);
      setStatus(`ERROR: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  // ----- render -----

  const enabledCount = chain.filter((s) => s.enabled !== false).length;

  return (
    <div className="app">
      <header className="head">
        <div className="brand">
          <span className="glyph" aria-hidden="true"></span>
          <span className="wordmark">
            <span className="line jox">JOX</span>
            <span className="line phex">
              <span>P</span><span>H</span><span>E</span><span>X</span>
            </span>
          </span>
        </div>
        <div className="meta">
          <span><span className="dot pulse"></span>{status}</span>
          {sourceImage && <span>SRC {sourceImage.width}×{sourceImage.height}</span>}
          <span>CHAIN ▸ {enabledCount} / {chain.length}</span>
        </div>
        <button
          className="mobile-only mobile-head-btn"
          onClick={() => {
            setMobileSettingsOpen((v) => !v);
            setMobileFiltersOpen(false);
          }}
          aria-label="Open settings"
          title="Settings"
        >⚙</button>
      </header>

      <aside className={`left ${mobileFiltersOpen ? 'mobile-open' : ''}`}>
        <div className="panel-section">
          <h2>
            FILTERS <span className="tag">{Object.keys(filters).length}</span>
            <button
              className="group-toggle-all"
              onClick={allExpanded ? collapseAll : expandAll}
              title={allExpanded ? 'Collapse all groups' : 'Expand all groups'}
            >
              {allExpanded ? '▾▾' : '▸▸'}
            </button>
          </h2>
          <div className="panel-body" style={{ padding: 0 }}>
            {filterGroups.map((g) => {
              const open = expandedGroups.has(g.id);
              return (
                <div key={g.id} className={`filter-group ${open ? 'open' : 'closed'}`}>
                  <button
                    className="group-header"
                    onClick={() => toggleGroup(g.id)}
                    aria-expanded={open}
                  >
                    <span className="chev">{open ? '▾' : '▸'}</span>
                    <span className="grp-label">{g.label}</span>
                    <span className="grp-count">{g.filters.length}</span>
                  </button>
                  {open && g.filters.map((fid) => {
                    const f = filters[fid];
                    if (!f) return null;
                    return (
                      <button
                        key={fid}
                        className="filter-btn"
                        title={`Add ${f.name} to chain`}
                        onClick={() => addStep(fid)}
                      >
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <main className={`main ${dragHover ? 'drag-hover' : ''}`}>
        {dragHover && (
          <div className="drop-overlay">
            <div className="drop-overlay-inner">
              <div className="stripe" style={{ marginBottom: 14 }}></div>
              <div style={{ fontSize: 16, letterSpacing: '0.2em' }}>⇪ DROP TO LOAD</div>
              <div className="stripe" style={{ marginTop: 14 }}></div>
            </div>
          </div>
        )}
        <div className="canvas-wrap">
          {sourceImage ? (
            <div className="canvas-frame">
              <PreviewCanvas
                ref={previewRef}
                source={sourceImage}
                chain={chain}
                onStatus={setStatus}
                zoom={zoom} tx={tx} ty={ty}
                setZoom={setZoom} setTx={setTx} setTy={setTy}
                compareMode={compareMode}
                previewMax={previewMax}
                brush={effectiveBrush}
                paintMode={paintMode}
                strokes={strokes}
                onStrokeStart={startStroke}
                onStrokeExtend={extendStroke}
              />
            </div>
          ) : (
            <div className="empty-state">
              <div className="stripe" style={{ marginBottom: 20 }}></div>
              <h3>NO INPUT</h3>
              {isMobile ? (
                <>
                  <p>Pick a photo from your library, or capture one with the camera.</p>
                  <div className="empty-mobile-cta">
                    <button
                      className="btn full primary"
                      onClick={() => fileRef.current?.click()}
                    >⇪ LOAD</button>
                    <button
                      className="btn full alt"
                      onClick={() => setCameraOpen(true)}
                    >◉ CAMERA</button>
                  </div>
                </>
              ) : (
                <p>
                  Drop an image anywhere on the window, paste from clipboard
                  (⌘V), or use LOAD IMAGE. Then click any filter on the left to
                  start a chain.
                </p>
              )}
              <div className="stripe" style={{ marginTop: 20 }}></div>
            </div>
          )}
        </div>

        {sourceImage && (
          <div className="viewport-controls">
            <div className="vc-row">
              <button className="vc-btn" onClick={() => zoomBy(1 / 1.25)} title="Zoom out">−</button>
              <button className="vc-btn vc-zoom" onClick={fit} title="Click to reset to 100%">
                {Math.round(zoom * 100)}%
              </button>
              <button className="vc-btn" onClick={() => zoomBy(1.25)} title="Zoom in">+</button>
            </div>
            <button
              className={`vc-btn vc-compare ${compareMode ? 'active' : ''}`}
              onPointerDown={(e) => { e.preventDefault(); setCompareMode(true); }}
              onPointerUp={() => setCompareMode(false)}
              onPointerLeave={() => setCompareMode(false)}
              onPointerCancel={() => setCompareMode(false)}
              title="Hold to view the original (or hold SPACE)"
            >
              {compareMode ? '◀ ORIGINAL' : 'HOLD: ORIG'}
            </button>
          </div>
        )}
      </main>

      <aside className={`right ${mobileSettingsOpen ? 'mobile-open' : ''}`}>
        <div className="panel-section">
          <h2>INPUT</h2>
          <div className="panel-body">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="file-input"
              onChange={(e) => onUpload(e.target.files?.[0])}
            />
            <button className="btn full primary" onClick={() => fileRef.current?.click()}>
              ⇪ LOAD IMAGE
            </button>
            <button
              className="btn full alt"
              style={{ marginTop: 6 }}
              onClick={() => setCameraOpen(true)}
              title="Capture from webcam"
            >
              ◉ CAMERA
            </button>
            {sourceImage && (
              <div style={{ marginTop: 10, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                {sourceImage.width} × {sourceImage.height} px
              </div>
            )}
          </div>
        </div>

        <div className="panel-section">
          <h2>BRUSH {brushImage && <span className="tag">●</span>}</h2>
          <div className="panel-body">
            <input
              ref={brushFileRef}
              type="file"
              accept="image/*"
              className="file-input"
              onChange={(e) => onLoadBrush(e.target.files?.[0])}
            />
            <button className="btn full primary" onClick={() => brushFileRef.current?.click()}>
              ⇪ LOAD BRUSH
            </button>
            {brushImage ? (
              <>
                <div className="brush-preview">
                  <canvas
                    ref={brushPreviewRef}
                    className="brush-canvas"
                    onPointerDown={onBrushSelectDown}
                    onPointerMove={onBrushSelectMove}
                    onPointerUp={onBrushSelectUp}
                    onPointerCancel={onBrushSelectUp}
                    onDoubleClick={() => setBrushRect(null)}
                    title="Drag to crop stamp · double-click to reset"
                  />
                  <div className="brush-meta">
                    <span>
                      {brushImage.width}×{brushImage.height}
                      {brushRect && brushRect.w >= 2 && brushRect.h >= 2 && (
                        <> → <strong>{brushRect.w}×{brushRect.h}</strong></>
                      )}
                    </span>
                    <button
                      className="brush-clear"
                      onClick={() => { setBrushImage(null); setStatus('BRUSH CLEARED'); }}
                      title="Clear loaded brush"
                    >✕</button>
                  </div>
                </div>

                <button
                  className={`btn full ${paintMode ? 'cta' : 'alt'}`}
                  style={{ marginTop: 10 }}
                  disabled={!sourceImage}
                  onClick={() => setPaintMode((p) => !p)}
                  title={sourceImage ? 'Toggle paint mode' : 'Load an image first'}
                >
                  {paintMode ? '◉ PAINTING' : '🖌 PAINT MODE'}
                </button>

                {paintMode && (
                  <div style={{ marginTop: 10 }}>
                    <div className="control">
                      <label>SIZE <span className="val">{paintSettings.scale.toFixed(2)}</span></label>
                      <input
                        type="range" min="0.05" max="2" step="0.05"
                        value={paintSettings.scale}
                        onChange={(e) => setPaintSettings((s) => ({ ...s, scale: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div className="control">
                      <label>OPACITY <span className="val">{paintSettings.opacity.toFixed(2)}</span></label>
                      <input
                        type="range" min="0.05" max="1" step="0.05"
                        value={paintSettings.opacity}
                        onChange={(e) => setPaintSettings((s) => ({ ...s, opacity: parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div className="control">
                      <label>SPACING <span className="val">{paintSettings.spacing.toFixed(2)}</span></label>
                      <input
                        type="range" min="0.02" max="1" step="0.02"
                        value={paintSettings.spacing}
                        onChange={(e) => setPaintSettings((s) => ({ ...s, spacing: parseFloat(e.target.value) }))}
                      />
                    </div>
                  </div>
                )}

                {strokes.length > 0 && (
                  <div className="btn-row" style={{ marginTop: 6 }}>
                    <button className="btn" onClick={undoStroke}>↶ UNDO</button>
                    <button className="btn" onClick={clearStrokes}>✕ CLEAR ({strokes.length})</button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>
                // load a brush to use with Photo Stamp filter or Paint Mode
              </div>
            )}
          </div>
        </div>

        <div className="panel-section">
          <h2>CHAIN <span className="tag">{chain.length}</span></h2>
          <div className="panel-body">
            <ChainPanel
              chain={chain}
              filters={filters}
              selectedStepId={selectedStepId}
              onSelect={selectStep}
              onToggle={toggleStep}
              onRemove={removeStep}
              onMove={moveStep}
              onClear={clearChain}
            />
          </div>
        </div>

        <div className="panel-section">
          <h2>RECIPES <span className="tag">{Object.keys(recipes).length}</span></h2>
          <div className="panel-body">
            <RecipesPanel
              recipes={recipes}
              currentChain={chain}
              onSave={saveRecipe}
              onLoad={loadRecipe}
              onDelete={deleteRecipe}
            />
          </div>
        </div>

        {selectedStep && selectedFilter && (
          <div className="panel-section params-section">
            <h2>PARAMS ▸ {selectedFilter.name.toUpperCase()}</h2>
            <div className="panel-body">
              <FilterControls
                filter={selectedFilter}
                params={selectedStep.params}
                onChange={onSetParam}
              />
              {selectedFilter.notes && (
                <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5, marginTop: 8 }}>
                  // {selectedFilter.notes}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="panel-section cta-section">
          <h2>EXPORT</h2>
          <div className="panel-body">
            <div className="control">
              <label>FORMAT</label>
              <div className="toggle">
                <button
                  className={exportFormat === 'png' ? 'on' : ''}
                  onClick={() => setExportFormat('png')}
                >PNG</button>
                <button
                  className={exportFormat === 'jpg' ? 'on' : ''}
                  onClick={() => setExportFormat('jpg')}
                >JPG</button>
              </div>
            </div>

            {exportFormat === 'jpg' && (
              <div className="control">
                <label>QUALITY <span className="val">{Math.round(exportQuality * 100)}</span></label>
                <input
                  type="range" min="0.5" max="1" step="0.01"
                  value={exportQuality}
                  onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                />
              </div>
            )}

            <div className="control">
              <label>SCALE <span className="val">{exportScale}×</span></label>
              <input
                type="range" min="0.5" max="4" step="0.5"
                value={exportScale}
                onChange={(e) => setExportScale(parseFloat(e.target.value))}
              />
            </div>

            <button
              className="btn full cta"
              disabled={!sourceImage || busy}
              onClick={onExport}
            >
              <span className="cta-arrow">▸ </span>
              <span className="cta-letters">
                <span>E</span><span>X</span><span>P</span><span>O</span><span>R</span><span>T</span>
              </span>
            </button>
          </div>
        </div>
      </aside>

      <footer className="foot">
        <span>JOX PHEX v0.1</span>
        <span>RASTER GRID STUDIO</span>
        <span className="spacer"></span>
        <span>{busy ? '⚙ PROCESSING' : '◉ IDLE'}</span>
      </footer>

      {/* Mobile-only: dim backdrop behind drawers */}
      {(mobileFiltersOpen || mobileSettingsOpen) && (
        <div
          className="drawer-backdrop"
          onClick={() => { setMobileFiltersOpen(false); setMobileSettingsOpen(false); }}
        />
      )}

      {/* Mobile-only: pinned params tray for the selected step */}
      {selectedStep && selectedFilter && (
        <div className="mobile-only mobile-params-tray">
          <div className="mobile-params-head">
            <span className="mpt-name">▸ {selectedFilter.name}</span>
            <button
              className="mpt-close"
              onClick={() => setSelectedStepId(null)}
              aria-label="Deselect step"
            >✕</button>
          </div>
          <div className="mobile-params-body">
            <FilterControls
              filter={selectedFilter}
              params={selectedStep.params}
              onChange={onSetParam}
            />
          </div>
        </div>
      )}

      {/* Mobile-only: bottom action bar */}
      <div className="mobile-only mobile-action-bar">
        <button
          className="ma-btn"
          onClick={() => {
            setMobileFiltersOpen(true);
            setMobileSettingsOpen(false);
          }}
          disabled={busy}
        >+ FILTERS</button>
        <button
          className={`ma-btn ${compareMode ? 'active' : ''}`}
          onPointerDown={(e) => { e.preventDefault(); if (sourceImage) setCompareMode(true); }}
          onPointerUp={() => setCompareMode(false)}
          onPointerLeave={() => setCompareMode(false)}
          onPointerCancel={() => setCompareMode(false)}
          disabled={!sourceImage}
        >HOLD ORIG</button>
        <button
          className="ma-btn cta"
          onClick={onExport}
          disabled={!sourceImage || busy}
        >
          <span className="cta-letters">
            <span>E</span><span>X</span><span>P</span><span>O</span><span>R</span><span>T</span>
          </span>
          <span className="cta-arrow"> ▸</span>
        </button>
      </div>

      <CameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => onUpload(file)}
      />
    </div>
  );
}
