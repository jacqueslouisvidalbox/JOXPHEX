import React from 'react';

// Render the right-rail control widgets driven by filter.controls metadata.
export default function FilterControls({ filter, params, onChange }) {
  if (!filter || !filter.controls?.length) {
    return (
      <div style={{ fontSize: 10, color: 'var(--muted)' }}>// no parameters</div>
    );
  }
  return (
    <div>
      {filter.controls.map((c) => (
        <ControlRow key={c.key} control={c} value={params[c.key]} onChange={onChange} />
      ))}
    </div>
  );
}

function ControlRow({ control, value, onChange }) {
  const { key, label, type } = control;
  const v = value ?? control.default;

  if (type === 'range') {
    const step = control.step ?? 1;
    return (
      <div className="control">
        <label>
          {label} <span className="val">{formatNum(v, step)}</span>
        </label>
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={step}
          value={v}
          onChange={(e) => onChange(key, parseFloat(e.target.value))}
        />
      </div>
    );
  }

  if (type === 'select') {
    return (
      <div className="control">
        <label>{label}</label>
        <select value={v} onChange={(e) => onChange(key, e.target.value)}>
          {control.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (type === 'toggle') {
    return (
      <div className="control">
        <label>{label}</label>
        <div className="toggle">
          {control.options.map((o) => (
            <button
              key={String(o.value)}
              className={v === o.value ? 'on' : ''}
              onClick={() => onChange(key, o.value)}
            >{o.label}</button>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'color') {
    return (
      <div className="control">
        <label>{label}</label>
        <input
          type="color"
          value={v}
          onChange={(e) => onChange(key, e.target.value)}
        />
      </div>
    );
  }

  if (type === 'text' || type === 'password') {
    return (
      <div className="control">
        <label>{label}</label>
        <input
          type={type}
          value={v ?? ''}
          placeholder={control.placeholder || ''}
          onChange={(e) => onChange(key, e.target.value)}
        />
      </div>
    );
  }

  return null;
}

function formatNum(v, step) {
  if (typeof v !== 'number') return String(v);
  const decimals = step >= 1 ? 0 : String(step).split('.')[1]?.length || 2;
  return v.toFixed(decimals);
}
