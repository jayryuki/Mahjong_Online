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

interface WildCardDisplayProps {
  wildCardTileId?: string | null;
}

export function WildCardDisplay({ wildCardTileId }: WildCardDisplayProps) {
  if (!wildCardTileId) return null;

  const renderTile = (id: string) => {
    const tile = parseTileId(id);
    const props = { width: 48, height: 66 };
    if (tile.suit === 'man') return <ManTile key={id} rank={tile.rank!} {...props} />;
    if (tile.suit === 'pin') return <PinTile key={id} rank={tile.rank!} {...props} />;
    if (tile.suit === 'sou') return <SouTile key={id} rank={tile.rank!} {...props} />;
    if (tile.honorName) return <HonorTile key={id} honorName={tile.honorName} {...props} />;
    return null;
  };

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      zIndex: 3,
      background: 'rgba(0,0,0,0.4)',
      padding: '6px 14px 8px',
      borderRadius: '10px',
      border: '1px solid rgba(251,191,36,0.3)',
    }}>
      <div style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#fbbf24', fontWeight: 700 }}>Wild</div>
      <div style={{ border: '2px solid #fbbf24', borderRadius: '8px', boxShadow: '0 0 12px rgba(251,191,36,0.5)' }}>
        {renderTile(wildCardTileId)}
      </div>
    </div>
  );
}
