import React, { useState, useRef, useCallback, useEffect } from 'react';
import { filters, filterGroups } from './filters/registry.js';
import PreviewCanvas, { MIN_ZOOM, MAX_ZOOM } from './components/PreviewCanvas.jsx';
import FilterControls from './components/FilterControls.jsx';
import ChainPanel from './components/ChainPanel.jsx';
import RecipesPanel from './components/RecipesPanel.jsx';
import CameraModal from './components/CameraModal.jsx';
import { applyChain } from './utils/chain.js';
import { loadImageFromFile, drawImageToCanvas, exportCanvas, fitWithin } from './utils/image.js';

const PREVIEW_MAX = 1100;

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
  const [recipes, setRecipes] = useState(() => {
    try {
      const saved = localStorage.getItem('phex.recipes');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {};
  });
  const fileRef = useRef(null);
  const previewRef = useRef(null);

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
  }, []);

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
      // Compute the ratio between this render's long edge and the preview's
      // long edge. Anything tagged pixelScale in a filter scales accordingly,
      // so a chain tuned in the preview produces the same look at any size.
      const previewFit = fitWithin(sourceImage.width, sourceImage.height, PREVIEW_MAX, PREVIEW_MAX);
      const previewLong = Math.max(previewFit.w, previewFit.h);
      const exportLong = Math.max(W, H);
      const renderScale = exportLong / previewLong;
      await applyChain(src, dst, chain, filters, renderScale);
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
            <span className="line phex">PHEX</span>
          </span>
        </div>
        <div className="meta">
          <span><span className="dot pulse"></span>{status}</span>
          {sourceImage && <span>SRC {sourceImage.width}×{sourceImage.height}</span>}
          <span>CHAIN ▸ {enabledCount} / {chain.length}</span>
        </div>
      </header>

      <aside className="left">
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
              />
            </div>
          ) : (
            <div className="empty-state">
              <div className="stripe" style={{ marginBottom: 20 }}></div>
              <h3>NO INPUT</h3>
              <p>
                Drop an image anywhere on the window, paste from clipboard
                (⌘V), or use LOAD IMAGE. Then click any filter on the left to
                start a chain.
              </p>
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

      <aside className="right">
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
              className="btn full"
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
          <h2>CHAIN <span className="tag">{chain.length}</span></h2>
          <div className="panel-body">
            <ChainPanel
              chain={chain}
              filters={filters}
              selectedStepId={selectedStepId}
              onSelect={setSelectedStepId}
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
          <div className="panel-section">
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

        <div className="panel-section">
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
              className="btn full primary"
              disabled={!sourceImage || busy}
              onClick={onExport}
            >
              ▸ EXPORT
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

      <CameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => onUpload(file)}
      />
    </div>
  );
}
