import React from 'react';

interface SeatPositionProps {
  position: 'bottom' | 'right' | 'top' | 'left';
  displayName: string;
  tileCount: number;
  isDealer: boolean;
  isActive: boolean;
  isRiichi: boolean;
}

export function SeatPosition({ position, displayName, tileCount, isDealer, isActive, isRiichi }: SeatPositionProps) {
  const positionStyles: Record<string, React.CSSProperties> = {
    top: { position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)' },
    bottom: { position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)' },
    left: { position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' },
    right: { position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' },
  };

  return (
    <div style={{
      ...positionStyles[position],
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.25rem',
      padding: '0.5rem 1rem',
      borderRadius: '8px',
      background: 'var(--surface-panel)',
      border: isActive ? '2px solid var(--seat-active-ring)' : '1px solid var(--border-subtle)',
      transition: 'border-color 200ms ease',
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 500, color: isActive ? 'var(--accent-warm)' : 'var(--text-primary)' }}>
        {displayName} {isDealer && '(D)'}
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
        {tileCount} tiles {isRiichi && '| Riichi'}
      </div>
    </div>
  );
}
