import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme.js';
import { ThemeId, THEMES } from '../../lib/theme.js';
import { getTileImageUrl } from '../../lib/tile-theme.js';

/** 4 sample tiles: character, circle, bamboo, honor */
const PREVIEW_TILES = [
  'svg/08-characters-1',
  'svg/17-circles-1',
  'svg/26-bamboos-1',
  'svg/01-white-dragon',
];

export function ThemeToggle() {
  const { theme, set, themes, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<ThemeId | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const previewTheme = hovered ?? theme;
  const current = themes.find(t => t.id === theme);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
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
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
        }}
      >
        {current?.label ?? theme}
        <span style={{ fontSize: '0.625rem', opacity: 0.6 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 1000,
            background: 'var(--surface-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            minWidth: '180px',
          }}
        >
          {(['Light', 'Dark'] as const).map(group => (
            <div key={group}>
              <div style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.625rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                background: 'var(--surface-card)',
              }}>
                {group}
              </div>
              {themes.filter(t => t.group === group).map(t => (
                <div
                  key={t.id}
                  onMouseEnter={() => setHovered(t.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => { set(t.id); setOpen(false); setHovered(null); }}
                  style={{
                    padding: '0.4rem 0.6rem',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    color: 'var(--text-primary)',
                    background: t.id === theme
                      ? 'var(--accent-warm)'
                      : t.id === hovered
                        ? 'var(--surface-card)'
                        : 'transparent',
                    transition: 'background 80ms ease',
                  }}
                >
                  {t.label}
                </div>
              ))}
            </div>
          ))}

          {/* Tile preview row */}
          <div style={{
            display: 'flex',
            gap: '4px',
            padding: '6px 8px',
            justifyContent: 'center',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface-card)',
          }}>
            {PREVIEW_TILES.map(name => (
              <img
                key={name}
                src={getTileImageUrl(name, previewTheme)}
                alt=""
                width={32}
                height={44}
                style={{
                  borderRadius: '4px',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
