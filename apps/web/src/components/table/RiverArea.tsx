import React from 'react';
import { ManTile, PinTile, SouTile, HonorTile, TileBack } from '@mahjong/ui';
import { TileDef } from '@mahjong/game-core';

interface RiverEntry {
  tile: TileDef;
  isLastDiscard?: boolean;
  isRiichiDiscard?: boolean;
}

interface RiverAreaProps {
  entries: RiverEntry[];
}

export function RiverArea({ entries }: RiverAreaProps) {
  const renderTile = (tile: TileDef, isLast: boolean) => {
    const props = { width: 28, height: 38 };
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
    else tileEl = <TileBack {...props} />;

    return <div key={tile.id} style={wrapperStyle}>{tileEl}</div>;
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px', padding: '0.25rem', maxWidth: '300px' }}>
      {entries.map((e) => renderTile(e.tile, !!e.isLastDiscard))}
    </div>
  );
}
