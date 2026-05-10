import React from 'react';
import { ManTile, PinTile, SouTile, HonorTile } from '@mahjong/ui';
import { TileDef } from '@mahjong/game-core';

interface RiverEntry {
  tile: TileDef;
  isLastDiscard?: boolean;
  isRiichiDiscard?: boolean;
}

interface RiverAreaProps {
  entries: RiverEntry[];
}

function renderSmallTile(tile: TileDef, isLast: boolean) {
  const props = { width: 22, height: 30 };
  const wrapperStyle: React.CSSProperties = {
    opacity: isLast ? 1 : 0.7,
    transform: isLast ? 'translateY(-2px)' : 'none',
    transition: 'transform 120ms ease',
  };

  let tileEl: React.ReactNode;
  if (tile.suit === 'man') tileEl = <ManTile rank={tile.rank!} {...props} />;
  else if (tile.suit === 'pin') tileEl = <PinTile rank={tile.rank!} {...props} />;
  else if (tile.suit === 'sou') tileEl = <SouTile rank={tile.rank!} {...props} />;
  else if (tile.honorName) tileEl = <HonorTile honorName={tile.honorName} {...props} />;
  else tileEl = null;

  return <div key={tile.id} style={wrapperStyle}>{tileEl}</div>;
}

export function RiverArea({ entries }: RiverAreaProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 22px)',
      gap: '1px',
      padding: '0.25rem',
      background: 'var(--surface-panel)',
      borderRadius: '4px',
      border: '1px solid var(--border-subtle)',
    }}>
      {entries.map((e, i) => renderSmallTile(e.tile, !!e.isLastDiscard))}
    </div>
  );
}
