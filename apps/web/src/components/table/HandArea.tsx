import React, { useState } from 'react';
import { ManTile, PinTile, SouTile, HonorTile } from '@mahjong/ui';
import { TileDef } from '@mahjong/game-core';

interface HandAreaProps {
  tiles: TileDef[];
  drawnTileId: string | null;
  onDiscard?: (tile: TileDef) => void;
}

export function HandArea({ tiles, drawnTileId, onDiscard }: HandAreaProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const renderTile = (tile: TileDef, index: number, isDrawn: boolean) => {
    const isSelected = selectedIndex === index;
    const props = {
      width: 40,
      height: 56,
      selected: isSelected,
      onClick: () => setSelectedIndex(isSelected ? null : index),
    };

    const wrapperStyle: React.CSSProperties = isDrawn ? {
      marginLeft: '0.5rem',
      border: '2px solid var(--accent-warm)',
      borderRadius: '4px',
    } : {};

    let tileEl: React.ReactNode;
    if (tile.suit === 'man') tileEl = <ManTile key={tile.id} rank={tile.rank!} {...props} />;
    else if (tile.suit === 'pin') tileEl = <PinTile key={tile.id} rank={tile.rank!} {...props} />;
    else if (tile.suit === 'sou') tileEl = <SouTile key={tile.id} rank={tile.rank!} {...props} />;
    else if (tile.honorName) tileEl = <HonorTile key={tile.id} honorName={tile.honorName} {...props} />;
    else tileEl = null;

    return <div key={tile.id} style={wrapperStyle}>{tileEl}</div>;
  };

  return (
    <div style={{ display: 'flex', gap: '2px', padding: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      {tiles.map((tile, i) => renderTile(tile, i, tile.id === drawnTileId))}
      {selectedIndex !== null && (
        <button
          onClick={() => {
            onDiscard?.(tiles[selectedIndex]);
            setSelectedIndex(null);
          }}
          style={{
            marginLeft: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'var(--accent-warm)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.8125rem',
            alignSelf: 'center',
          }}
        >
          Discard
        </button>
      )}
    </div>
  );
}
