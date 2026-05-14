import React, { useState, useEffect } from 'react';
import { ManTile, PinTile, SouTile, HonorTile } from '@mahjong/ui';
import { TileDef, tileSortKey } from '@mahjong/game-core';

function parseTileId(id: string): TileDef {
  const parts = id.split('-');
  const suitNames = ['man', 'pin', 'sou'];
  const windNames = ['east', 'south', 'west', 'north'];
  const dragonNames = ['haku', 'hatsu', 'chun'];
  const honorNames = [...windNames, ...dragonNames];

  if (suitNames.includes(parts[0])) {
    return { id, suit: parts[0] as 'man' | 'pin' | 'sou', rank: parseInt(parts[1], 10), isFlower: false };
  } else if (honorNames.includes(parts[0])) {
    return { id, honorType: windNames.includes(parts[0]) ? 'wind' : 'dragon', honorName: parts[0] as any, isFlower: false };
  }
  return { id, isFlower: false };
}

interface HandAreaProps {
  tiles: TileDef[];
  drawnTileId: string | null;
  canDiscard?: boolean;
  onDiscard?: (tile: TileDef) => void;
  wildCardTileId?: string | null;
}

export function HandArea({ tiles, drawnTileId, canDiscard = true, onDiscard, wildCardTileId }: HandAreaProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  useEffect(() => { setSelectedIndex(null); }, [tiles]);

  const handleDiscard = (tile: TileDef) => {
    setDiscardingId(tile.id);
    setTimeout(() => {
      onDiscard?.(tile);
      setSelectedIndex(null);
      setDiscardingId(null);
    }, 250);
  };

  // Dynamic sizing based on tile count - bigger when fewer tiles, capped for mobile
  const tileCount = tiles.length;
  const baseW = Math.max(36, Math.min(52, Math.floor((window.innerWidth - 80) / tileCount)));
  const baseH = Math.round(baseW * 1.4);

  const wildSortKey = wildCardTileId ? tileSortKey(parseTileId(wildCardTileId)) : null;

  const renderTileEl = (tile: TileDef, w: number, h: number, selected?: boolean, onClick?: () => void) => {
    const props = { width: w, height: h, selected, onClick };
    if (tile.suit === 'man') return <ManTile rank={tile.rank!} {...props} />;
    if (tile.suit === 'pin') return <PinTile rank={tile.rank!} {...props} />;
    if (tile.suit === 'sou') return <SouTile rank={tile.rank!} {...props} />;
    if (tile.honorName) return <HonorTile honorName={tile.honorName} {...props} />;
    return null;
  };

  const renderTile = (tile: TileDef, index: number, isDrawn: boolean) => {
    const isSelected = selectedIndex === index;
    const isDiscarding = discardingId === tile.id;
    const isWild = wildSortKey !== null && tileSortKey(tile) === wildSortKey;

    const tileEl = renderTileEl(tile, baseW, baseH, isSelected, canDiscard ? () => setSelectedIndex(isSelected ? null : index) : undefined);

    const wrapperStyle: React.CSSProperties = {
      flex: '1 1 0',
      minWidth: 0,
      maxWidth: baseW,
      transition: 'transform 200ms ease, opacity 200ms ease',
      cursor: canDiscard ? 'pointer' : 'default',
      ...(isSelected && { transform: 'translateY(-8px)' }),
      ...(isDiscarding && { transform: 'translateY(-20px) scale(0.9)', opacity: 0.4 }),
      ...(isWild && !isDrawn && { border: '2px solid #fbbf24', borderRadius: '4px', boxShadow: '0 0 8px rgba(251,191,36,0.4)' }),
    };

    if (isDrawn) {
      return (
        <div key={tile.id} style={{
          ...wrapperStyle,
          maxWidth: baseW + 8,
          marginLeft: 8,
          position: 'relative',
          paddingTop: 20,
          animation: 'tileDrawIn 400ms ease-out',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '0.5625rem',
            color: '#fff',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            background: isWild ? '#fbbf24' : 'var(--accent-warm)',
            padding: '2px 6px',
            borderRadius: '3px',
            lineHeight: 1.2,
          }}>
            {isWild ? 'Wild' : 'Drawn'}
          </div>
          <div style={{
            padding: 3,
            background: isWild
              ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
              : 'linear-gradient(135deg, var(--accent-warm), #d4764e)',
            borderRadius: '6px',
            boxShadow: isWild
              ? '0 0 10px rgba(251,191,36,0.5), 0 2px 6px rgba(0,0,0,0.15)'
              : '0 0 10px rgba(184, 92, 58, 0.5), 0 2px 6px rgba(0,0,0,0.15)',
            transform: 'translateY(-4px)',
            ...(isSelected && { transform: 'translateY(-12px)' }),
          }}>
            {tileEl}
          </div>
        </div>
      );
    }

    return <div key={tile.id} style={wrapperStyle}>{tileEl}</div>;
  };

  return (
    <div style={{
      display: 'flex',
      gap: 2,
      padding: '0.375rem 0.5rem',
      justifyContent: 'center',
      alignItems: 'flex-end',
      flexWrap: 'nowrap',
      width: '100%',
    }}>
      {tiles.map((tile, i) => renderTile(tile, i, tile.id === drawnTileId))}
      {canDiscard && selectedIndex !== null && (
        <button
          onClick={() => handleDiscard(tiles[selectedIndex])}
          style={{
            marginLeft: 8,
            padding: '0.5rem 1rem',
            background: 'var(--accent-warm)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            alignSelf: 'center',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(184, 92, 58, 0.4)',
          }}
        >
          Discard
        </button>
      )}
    </div>
  );
}
