import React from 'react';
import { useTheme } from '../../hooks/useTheme.js';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      style={{
        background: 'none',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '0.5rem 0.75rem',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        fontSize: '0.8125rem',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {theme === 'light' ? 'Dark' : 'Light'}
    </button>
  );
}
