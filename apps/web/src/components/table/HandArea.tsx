import React, { useState } from 'react';
import { ManTile, PinTile, SouTile, HonorTile } from '@mahjong/ui';
import { TileDef } from '@mahjong/game-core';

interface HandAreaProps {
  tiles: TileDef[];
  onDiscard?: (tile: TileDef) => void;
}

export function HandArea({ tiles, onDiscard }: HandAreaProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const renderTile = (tile: TileDef, index: number) => {
    const isSelected = selectedIndex === index;
    const props = {
      width: 40,
      height: 56,
      selected: isSelected,
      onClick: () => setSelectedIndex(isSelected ? null : index),
    };

    if (tile.suit === 'man') return <ManTile key={tile.id} rank={tile.rank!} {...props} />;
    if (tile.suit === 'pin') return <PinTile key={tile.id} rank={tile.rank!} {...props} />;
    if (tile.suit === 'sou') return <SouTile key={tile.id} rank={tile.rank!} {...props} />;
    if (tile.honorName) return <HonorTile key={tile.id} honorName={tile.honorName} {...props} />;
    return null;
  };

  return (
    <div style={{ display: 'flex', gap: '2px', padding: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
      {tiles.map((tile, i) => renderTile(tile, i))}
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
