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

interface DoraDisplayProps {
  doraIndicatorIds: string[];
}

export function DoraDisplay({ doraIndicatorIds }: DoraDisplayProps) {
  if (doraIndicatorIds.length === 0) return null;

  const renderTile = (id: string) => {
    const tile = parseTileId(id);
    const props = { width: 28, height: 38 };
    if (tile.suit === 'man') return <ManTile key={id} rank={tile.rank!} {...props} />;
    if (tile.suit === 'pin') return <PinTile key={id} rank={tile.rank!} {...props} />;
    if (tile.suit === 'sou') return <SouTile key={id} rank={tile.rank!} {...props} />;
    if (tile.honorName) return <HonorTile key={id} honorName={tile.honorName} {...props} />;
    return null;
  };

  return (
    <div style={{
      position: 'absolute',
      top: '45%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.25rem',
      zIndex: 1,
    }}>
      <div style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Dora</div>
      <div style={{ display: 'flex', gap: '2px' }}>
        {doraIndicatorIds.map(id => renderTile(id))}
      </div>
    </div>
  );
}
