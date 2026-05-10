import React from 'react';

interface InfoBarProps {
  roundWind: string;
  handNumber: number;
  honba: number;
  riichiSticks: number;
  wallRemaining: number;
}

export function InfoBar({ roundWind, handNumber, honba, riichiSticks, wallRemaining }: InfoBarProps) {
  const items = [
    { label: 'Wind', value: roundWind.charAt(0).toUpperCase() + roundWind.slice(1) },
    { label: 'Hand', value: String(handNumber) },
    { label: 'Honba', value: String(honba) },
    { label: 'Riichi', value: String(riichiSticks) },
    { label: 'Wall', value: String(wallRemaining) },
  ];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', padding: '0.5rem 1rem', background: 'var(--surface-panel)', borderBottom: '1px solid var(--border-subtle)' }}>
      {items.map((item) => (
        <div key={item.label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{item.label}</div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
