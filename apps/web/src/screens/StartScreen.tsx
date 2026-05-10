import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.js';

export function StartScreen() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
      <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '3rem', fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
        Mahjong
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', fontStyle: 'italic', fontFamily: "'Newsreader', Georgia, serif" }}>
        A quiet room for a strategic game.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button onClick={() => navigate('/create')} style={{ padding: '0.75rem 2rem', background: 'var(--accent-warm)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>
          Create Room
        </button>
        <button onClick={() => navigate('/join')} style={{ padding: '0.75rem 2rem', background: 'var(--surface-panel)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>
          Join Room
        </button>
        <button onClick={toggle} style={{ padding: '0.75rem 1rem', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>
    </div>
  );
}
