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

interface MeldDisplay {
  type: string;
  tiles: any[];
  isConcealed: boolean;
}

interface SeatPositionProps {
  position: 'top' | 'left' | 'right';
  seatIndex: number;
  displayName: string;
  tileCount: number;
  isDealer: boolean;
  isActive: boolean;
  isRiichi: boolean;
  score: number;
  melds: MeldDisplay[];
}

const SEAT_WIND_LABELS = ['E', 'S', 'W', 'N'];

const MELD_TILE_W = 30;
const MELD_TILE_H = 42;

function renderMeldTile(tile: TileDef) {
  const props = { width: MELD_TILE_W, height: MELD_TILE_H };
  if (tile.suit === 'man') return <ManTile rank={tile.rank!} {...props} />;
  if (tile.suit === 'pin') return <PinTile rank={tile.rank!} {...props} />;
  if (tile.suit === 'sou') return <SouTile rank={tile.rank!} {...props} />;
  if (tile.honorName) return <HonorTile honorName={tile.honorName} {...props} />;
  return null;
}

export function SeatPosition({ position, seatIndex, displayName, tileCount, isDealer, isActive, score, melds }: SeatPositionProps) {
  const hasMelds = melds.length > 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    }}>
      {/* Compact nameplate */}
      <div style={{
        padding: '4px 12px',
        borderRadius: '6px',
        background: isActive ? 'var(--accent-warm)' : 'rgba(0,0,0,0.5)',
        border: isActive ? 'none' : '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        ...(isActive && { animation: 'activeGlow 2s ease-in-out infinite' }),
      }}>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
        }}>
          {SEAT_WIND_LABELS[seatIndex]}{isDealer ? 'D' : ''}
        </span>
        <span style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: isActive ? '#fff' : 'rgba(255,255,255,0.9)',
          maxWidth: '8ch',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {displayName}
        </span>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.7)',
        }}>
          {score}
        </span>
        <span style={{ fontSize: '0.5625rem', color: isActive ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.4)' }}>
          {tileCount}t
        </span>
      </div>

      {/* Melds display - face-up tiles */}
      {hasMelds && (
        <div style={{
          display: 'flex',
          gap: '4px',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          {melds.map((meld, i) => {
            const tileIds: string[] = meld.tiles?.map((t: any) => typeof t === 'string' ? t : t.id) ?? [];
            if (tileIds.length === 0) return null;
            const meldLabel = meld.type === 'chi' ? 'Chi' : meld.type === 'pon' ? 'Pon' : meld.type.startsWith('kan') ? 'Kan' : '';
            return (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1px',
                background: 'rgba(0,0,0,0.25)',
                padding: '3px 4px',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ display: 'flex', gap: '1px' }}>
                  {tileIds.map((tid: string, j: number) => (
                    <div key={j}>{renderMeldTile(parseTileId(tid))}</div>
                  ))}
                </div>
                {meldLabel && (
                  <span style={{ fontSize: '0.4375rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {meldLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
