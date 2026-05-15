import React from 'react';
import { useScale } from '../../hooks/useScale.js';

interface InfoBarProps {
  roundWind: string;
  handNumber: number;
  honba: number;
  riichiSticks: number;
  wallRemaining: number;
}

export function InfoBar({ roundWind, handNumber, honba, wallRemaining }: InfoBarProps) {
  const scale = useScale();
  const items = [
    { label: 'Wind', value: roundWind.charAt(0).toUpperCase() + roundWind.slice(1) },
    { label: 'Hand', value: String(handNumber) },
    { label: 'Honba', value: String(honba) },
    { label: 'Wall', value: String(wallRemaining) },
  ];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: `${1 * scale}rem`, padding: `${0.25 * scale}rem ${0.5 * scale}rem`, background: 'var(--surface-panel)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
      {items.map((item) => (
        <div key={item.label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: `${1 * scale}rem`, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 500 }}>{item.label}</div>
          <div style={{ fontSize: `${1.5 * scale}rem`, fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
