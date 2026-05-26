import React, { useState } from 'react';

export default function RecipesPanel({ recipes, onSave, onLoad, onDelete, currentChain }) {
  const [name, setName] = useState('');

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onSave(n);
    setName('');
  };

  const entries = Object.entries(recipes).sort(([a], [b]) => a.localeCompare(b));
  const canSave = currentChain && currentChain.length > 0 && name.trim().length > 0;

  return (
    <div className="recipes">
      <div className="recipes-save">
        <input
          type="text"
          value={name}
          placeholder="recipe name…"
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <button
          className="recipe-save-btn"
          disabled={!canSave}
          onClick={submit}
          title={!currentChain?.length ? 'Build a chain first' : 'Save chain as recipe'}
        >SAVE</button>
      </div>

      {entries.length === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
          // no recipes yet
        </div>
      ) : (
        <div className="recipe-list">
          {entries.map(([n, r]) => (
            <div key={n} className="recipe-row">
              <button
                className="recipe-load"
                onClick={() => onLoad(n)}
                title={`Load ${r.steps.length} step${r.steps.length === 1 ? '' : 's'}`}
              >
                <span className="recipe-name">{n}</span>
                <span className="recipe-count">{r.steps.length}</span>
              </button>
              <button
                className="recipe-del"
                onClick={() => { if (confirm(`Delete "${n}"?`)) onDelete(n); }}
                title="Delete recipe"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
