import React from 'react';
import { ManTile, PinTile, SouTile, HonorTile } from '@mahjong/ui';
import { TileDef } from '@mahjong/game-core';

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

interface Meld {
  type: string;
  tiles: any[];
  isConcealed: boolean;
}

interface MeldAreaProps {
  melds: Meld[];
}

function renderSmallTile(tile: TileDef) {
  const props = { width: 42, height: 58 };
  if (tile.suit === 'man') return <ManTile rank={tile.rank!} {...props} />;
  if (tile.suit === 'pin') return <PinTile rank={tile.rank!} {...props} />;
  if (tile.suit === 'sou') return <SouTile rank={tile.rank!} {...props} />;
  if (tile.honorName) return <HonorTile honorName={tile.honorName} {...props} />;
  return null;
}

export function MeldArea({ melds }: MeldAreaProps) {
  return (
    <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
      {melds.map((meld, i) => (
        <div key={i} style={{
          display: 'flex',
          gap: '2px',
          padding: '3px',
          borderRadius: '6px',
          background: 'var(--surface-panel)',
          border: '1px solid var(--border-subtle)',
        }}>
          {(!meld.tiles || meld.tiles.length === 0) && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.375rem' }}>{meld.type}</span>
          )}
          {meld.tiles && meld.tiles.length > 0 && meld.tiles.map((t: any, j: number) => {
            const tileId = typeof t === 'string' ? t : t.id;
            const tileDef = parseTileId(tileId);
            return <div key={j}>{renderSmallTile(tileDef)}</div>;
          })}
        </div>
      ))}
    </div>
  );
}
