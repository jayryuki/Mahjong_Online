import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
import { TileDef } from '@mahjong/game-core';
import { parseTileId } from '../../lib/tile-utils.js';
import type { MeldDisplay } from '../../lib/types.js';

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

const BASE_MELD_TILE_W = 34;
const BASE_MELD_TILE_H = 47;

function renderMeldTile(tile: TileDef, w: number, h: number, concealed: boolean) {
  if (concealed) {
    return <div style={{ width: w, height: h, background: '#4a6741', borderRadius: '3px', border: '1px solid rgba(0,0,0,0.2)' }} />;
  }
  return <TileRenderer tile={tile} width={w} height={h} />;
}

export function SeatPosition({ position, seatIndex, displayName, tileCount, isDealer, isActive, score, melds }: SeatPositionProps) {
  const scale = useScale();
  const isMobile = scale < 0.75;
  const meldTileW = Math.round(BASE_MELD_TILE_W * scale * (isMobile ? 0.85 : 1));
  const meldTileH = Math.round(BASE_MELD_TILE_H * scale * (isMobile ? 0.85 : 1));
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
        padding: isMobile ? `${2 * scale}px ${5 * scale}px` : `${3 * scale}px ${8 * scale}px`,
        borderRadius: '6px',
        background: isActive ? 'var(--accent-warm)' : 'rgba(0,0,0,0.6)',
        border: isActive ? 'none' : '1px solid rgba(255,255,255,0.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: `${2 * scale}px`,
        backdropFilter: 'blur(4px)',
        ...(isActive && { animation: 'activeGlow 2s ease-in-out infinite' }),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: `${4 * scale}px`, whiteSpace: 'nowrap' }}>
          <span style={{
            fontSize: `${1.25 * scale}rem`,
            fontWeight: 700,
            color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)',
          }}>
            {SEAT_WIND_LABELS[seatIndex]}{isDealer ? 'D' : ''}
          </span>
          <span style={{
            fontSize: `${1.25 * scale}rem`,
            fontWeight: 600,
            color: isActive ? '#fff' : 'rgba(255,255,255,0.95)',
            maxWidth: '8ch',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {displayName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: `${6 * scale}px`, whiteSpace: 'nowrap' }}>
          <span style={{
            fontSize: `${1.125 * scale}rem`,
            fontWeight: 700,
            color: isActive ? '#fff' : 'rgba(255,255,255,0.95)',
          }}>
            {score}
          </span>
          <span style={{
            fontSize: `${0.9375 * scale}rem`,
            fontWeight: 500,
            color: isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.6)',
          }}>
            {tileCount} tiles
          </span>
        </div>
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
            const concealed = meld.isConcealed;
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
                  {concealed
                    ? Array.from({ length: tileIds.length }, (_, j) => (
                        <div key={j}>{renderMeldTile({} as TileDef, meldTileW, meldTileH, true)}</div>
                      ))
                    : tileIds.map((tid: string, j: number) => (
                        <div key={j}>{renderMeldTile(parseTileId(tid), meldTileW, meldTileH, false)}</div>
                      ))
                  }
                </div>
                {meldLabel && (
                  <span style={{ fontSize: `${0.875 * scale}rem`, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
