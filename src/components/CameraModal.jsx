import React, { useEffect, useRef, useState } from 'react';

export default function CameraModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [err, setErr] = useState(null);
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState('user');

  // Acquire/release stream.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setErr(null);
    setReady(false);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (e) {
        setErr(e.message || 'Camera access denied');
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setReady(false);
    };
  }, [open, facingMode]);

  const capture = () => {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) return;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(v, 0, 0, w, h);
    c.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera_${Date.now()}.png`, { type: 'image/png' });
      onCapture(file);
      onClose();
    }, 'image/png');
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>CAMERA CAPTURE</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {err ? (
            <div className="modal-err">
              <div style={{ fontSize: 14, marginBottom: 12 }}>CAMERA ERROR</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{err}</div>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block', background: '#000' }}
            />
          )}
        </div>
        <div className="modal-foot">
          <button
            className="btn"
            onClick={() => setFacingMode((m) => m === 'user' ? 'environment' : 'user')}
            title="Flip camera (front/back)"
          >↻ FLIP</button>
          <div style={{ flex: 1 }}></div>
          <button className="btn" onClick={onClose}>CANCEL</button>
          <button
            className="btn primary"
            disabled={!ready || err}
            onClick={capture}
          >▸ CAPTURE</button>
        </div>
      </div>
    </div>
  );
}
