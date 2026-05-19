import React from 'react';
import { useTheme } from '../../hooks/useTheme.js';

export function ThemeToggle() {
  const { theme, set, themes, isDark } = useTheme();

  return (
    <select
      value={theme}
      onChange={(e) => set(e.target.value as any)}
      style={{
        background: 'var(--surface-panel)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        padding: '0.35rem 0.5rem',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        fontFamily: "'Inter', sans-serif",
        outline: 'none',
      }}
    >
      <optgroup label="Light">
        {themes.filter(t => t.group === 'Light').map(t => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </optgroup>
      <optgroup label="Dark">
        {themes.filter(t => t.group === 'Dark').map(t => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </optgroup>
    </select>
  );
}
