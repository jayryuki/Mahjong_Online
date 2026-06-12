import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
import { TileDef } from '@mahjong/game-core';
import { parseTileId } from '../../lib/tile-utils.js';
import type { MeldDisplay } from '../../lib/types.js';

interface SeatPositionProps {
  position: 'top' | 'left' | 'right';
  isActive: boolean;
  melds: MeldDisplay[];
}

const BASE_MELD_TILE_W = 34;
const BASE_MELD_TILE_H = 47;

function renderMeldTile(tile: TileDef, w: number, h: number, concealed: boolean) {
  if (concealed) {
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: '6px',
          background: 'var(--mahjong-concealed-tile-bg)',
          border: '1px solid var(--game-panel-border)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 4px 10px rgba(0,0,0,0.18)',
        }}
      />
    );
  }
  return <TileRenderer tile={tile} width={w} height={h} />;
}

function getMeldLabel(type: string) {
  if (type === 'chi') return 'Chi';
  if (type === 'pon') return 'Pon';
  if (type === 'kan-open') return 'Open Kan';
  if (type === 'kan-added') return 'Added Kan';
  if (type === 'kan-closed') return 'Closed Kan';
  return '';
}

export function SeatPosition({ position, isActive, melds }: SeatPositionProps) {
  const scale = useScale();
  const isMobile = scale < 0.75;
  const meldTileW = Math.round(BASE_MELD_TILE_W * scale * (isMobile ? 0.85 : 1));
  const meldTileH = Math.round(BASE_MELD_TILE_H * scale * (isMobile ? 0.85 : 1));
  const hasMelds = melds.length > 0;
  const align = position === 'left' ? 'flex-start' : position === 'right' ? 'flex-end' : 'center';

  if (!hasMelds) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: align,
      gap: '6px',
    }}>
      <div style={{
        display: 'flex',
        gap: '4px',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {melds.map((meld, i) => {
          const tileIds: string[] = meld.tiles?.map((t: any) => typeof t === 'string' ? t : t.id) ?? [];
          if (tileIds.length === 0) return null;
          const meldLabel = getMeldLabel(meld.type);
          const concealed = meld.isConcealed;
          return (
            <div key={i} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              background: 'var(--game-panel-overlay)',
              padding: '4px 5px',
              borderRadius: '10px',
              border: `1px solid ${isActive ? 'var(--accent-warm)' : 'var(--game-panel-border)'}`,
              boxShadow: '0 6px 14px rgba(0,0,0,0.18)',
              backdropFilter: 'blur(8px)',
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
                <span style={{
                  fontSize: `${0.7 * scale}rem`,
                  color: 'var(--game-on-table-muted)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  textShadow: 'var(--game-text-outline-shadow)',
                }}>
                  {meldLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
