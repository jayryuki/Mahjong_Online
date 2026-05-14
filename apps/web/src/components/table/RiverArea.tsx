import React, { useEffect, useState } from 'react';
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

const RIVER_TILE_W = 38;
const RIVER_TILE_H = 52;

function RiverTile({ tile, isLast }: { tile: TileDef; isLast: boolean }) {
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (isLast) {
      setIsNew(true);
      const timer = setTimeout(() => setIsNew(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isLast, tile.id]);

  const props = { width: RIVER_TILE_W, height: RIVER_TILE_H };
  const wrapperStyle: React.CSSProperties = {
    opacity: isLast ? 1 : 0.75,
    transform: isLast ? 'translateY(-4px)' : 'none',
    transition: 'transform 200ms ease, opacity 200ms ease',
    ...(isNew && { animation: 'tileDropIn 400ms ease-out' }),
  };

  let tileEl: React.ReactNode;
  if (tile.suit === 'man') tileEl = <ManTile rank={tile.rank!} {...props} />;
  else if (tile.suit === 'pin') tileEl = <PinTile rank={tile.rank!} {...props} />;
  else if (tile.suit === 'sou') tileEl = <SouTile rank={tile.rank!} {...props} />;
  else if (tile.honorName) tileEl = <HonorTile honorName={tile.honorName} {...props} />;
  else tileEl = null;

  return <div style={wrapperStyle}>{tileEl}</div>;
}

export function RiverArea({ entries }: RiverAreaProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(6, ${RIVER_TILE_W}px)`,
      gap: '2px',
      padding: '0.25rem',
      background: 'rgba(0,0,0,0.1)',
      borderRadius: '6px',
      border: '1px solid var(--border-subtle)',
    }}>
      {entries.map((e, i) => <RiverTile key={e.tile.id + '-' + i} tile={e.tile} isLast={!!e.isLastDiscard} />)}
    </div>
  );
}
