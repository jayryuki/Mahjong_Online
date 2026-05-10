import React from 'react';

interface Meld {
  type: string;
  tiles: any[];
  isConcealed: boolean;
}

interface MeldAreaProps {
  melds: Meld[];
}

export function MeldArea({ melds }: MeldAreaProps) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.25rem' }}>
      {melds.map((meld, i) => (
        <div key={i} style={{
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          background: 'var(--surface-panel)',
          fontSize: '0.6875rem',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
        }}>
          {meld.type} ({meld.tiles.length})
        </div>
      ))}
    </div>
  );
}
