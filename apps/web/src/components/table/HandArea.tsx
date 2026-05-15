import React, { useState, useEffect, useRef } from 'react';
import { TileRenderer } from '../common/TileRenderer.js';

import { useScale } from '../../hooks/useScale.js';
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

  const tileRowRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  useEffect(() => {
    const el = tileRowRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setMeasuredWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleDiscard = (tile: TileDef) => {
    setDiscardingId(tile.id);
    setTimeout(() => {
      onDiscard?.(tile);
      setSelectedIndex(null);
      setDiscardingId(null);
    }, 250);
  };

  const scale = useScale();
  // Tile sizing: tiles as big as possible, wrapping to 2 rows when single-row tiles would be too small
  const tileCount = tiles.length;
  const gap = 2;
  const drawnGap = drawnTileId ? 8 : 0;
  const availableWidth = measuredWidth > 0 ? measuredWidth : window.innerWidth - 8;
  const minTileW = 36; // minimum acceptable tile width before we wrap

  // Calculate how many tiles fit per row at minimum width
  const tilesPerRow = Math.max(1, Math.floor((availableWidth - drawnGap) / (minTileW + gap)));
  const rows = Math.ceil(tileCount / tilesPerRow);
  // Use up to 2 rows; if still too many tiles, allow more
  const effectiveRows = Math.min(rows, 2);
  const effectivePerRow = Math.ceil(tileCount / effectiveRows);

  const gapsWidth = Math.max(0, effectivePerRow - 1) * gap;
  const maxTileW = 68; // cap tile width on desktop
  const baseW = tileCount > 0
    ? Math.min(maxTileW, Math.floor((availableWidth - gapsWidth - drawnGap) / effectivePerRow))
    : Math.round(60 * scale);
  const baseH = Math.round(baseW * 1.4);

  const wildSortKey = wildCardTileId ? tileSortKey(parseTileId(wildCardTileId)) : null;

  const renderTileEl = (tile: TileDef, w: number, h: number, selected?: boolean, onClick?: () => void) => {
    return <TileRenderer tile={tile} width={w} height={h} selected={selected} onClick={onClick} />;
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
      ...(isDiscarding && { transform: 'translateY(-16px) scale(0.9)', opacity: 0.4 }),
      ...(isWild && !isDrawn && { border: '2px solid #fbbf24', borderRadius: '4px', boxShadow: '0 0 8px rgba(251,191,36,0.4)' }),
    };

    if (isDrawn) {
      return (
        <div key={tile.id} style={{
          ...wrapperStyle,
          maxWidth: baseW + 6,
          marginLeft: 6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1px',
          animation: 'tileDrawIn 400ms ease-out',
        }}>
          <div style={{
            padding: 2,
            background: isWild
              ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
              : 'linear-gradient(135deg, var(--accent-warm), #d4764e)',
            borderRadius: '4px',
            boxShadow: isWild
              ? '0 0 8px rgba(251,191,36,0.5), 0 1px 4px rgba(0,0,0,0.15)'
              : '0 0 8px rgba(184, 92, 58, 0.5), 0 1px 4px rgba(0,0,0,0.15)',
            position: 'relative',
          }}>
            {tileEl}
            <div style={{
              position: 'absolute',
              top: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: `${Math.max(0.625, 0.75 * scale)}rem`,
              color: '#fff',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
              background: isWild ? '#fbbf24' : 'var(--accent-warm)',
              padding: '1px 4px',
              borderRadius: '2px',
              lineHeight: 1.2,
            }}>
              {isWild ? 'Wild' : 'Drawn'}
            </div>
          </div>
        </div>
      );
    }

    return <div key={tile.id} style={wrapperStyle}>{tileEl}</div>;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
    }}>
      <div ref={tileRowRef} style={{
        display: 'flex',
        gap,
        padding: '2px 2px 0',
        justifyContent: 'center',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        width: '100%',
      }}>
        {tiles.map((tile, i) => renderTile(tile, i, tile.id === drawnTileId))}
      </div>
      {canDiscard && selectedIndex !== null && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '4px 0 2px',
        }}>
          <button
            onClick={() => handleDiscard(tiles[selectedIndex])}
            style={{
              padding: '0.4rem 1.5rem',
              background: 'var(--accent-warm)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: `${1.5 * scale}rem`,
              boxShadow: '0 2px 6px rgba(184, 92, 58, 0.4)',
              animation: 'fadeInUp 200ms ease-out',
            }}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
