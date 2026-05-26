import React from 'react';

// Layer-stack UI for the filter chain.
export default function ChainPanel({
  chain,
  filters,
  selectedStepId,
  onSelect,
  onToggle,
  onRemove,
  onMove,
  onClear
}) {
  if (!chain.length) {
    return (
      <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
        // empty chain — click any filter on the left to add a step
      </div>
    );
  }
  return (
    <div className="chain">
      {chain.map((step, i) => {
        const f = filters[step.filterId];
        if (!f) return null;
        const selected = step.id === selectedStepId;
        return (
          <div
            key={step.id}
            className={`chain-row ${selected ? 'selected' : ''} ${step.enabled === false ? 'disabled' : ''}`}
            onClick={() => onSelect(step.id)}
          >
            <div className="chain-line-1">
              <span className="chain-idx">{String(i + 1).padStart(2, '0')}</span>
              <span className="chain-name" title={f.name}>{f.name}</span>
            </div>
            <div className="chain-actions">
              <button
                className="chain-btn"
                title={step.enabled === false ? 'Enable' : 'Disable'}
                onClick={(e) => { e.stopPropagation(); onToggle(step.id); }}
              >{step.enabled === false ? '○' : '●'}</button>
              <button
                className="chain-btn"
                title="Move up"
                disabled={i === 0}
                onClick={(e) => { e.stopPropagation(); onMove(step.id, -1); }}
              >↑</button>
              <button
                className="chain-btn"
                title="Move down"
                disabled={i === chain.length - 1}
                onClick={(e) => { e.stopPropagation(); onMove(step.id, +1); }}
              >↓</button>
              <button
                className="chain-btn danger"
                title="Remove"
                onClick={(e) => { e.stopPropagation(); onRemove(step.id); }}
              >✕</button>
            </div>
          </div>
        );
      })}
      <button className="btn full" style={{ marginTop: 10 }} onClick={onClear}>
        CLEAR CHAIN
      </button>
    </div>
  );
}
