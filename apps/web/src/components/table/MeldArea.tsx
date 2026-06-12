import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
import { TileDef } from '@mahjong/game-core';
import { parseTileId } from '../../lib/tile-utils.js';
import type { MeldDisplay } from '../../lib/types.js';

interface MeldAreaProps {
  melds: MeldDisplay[];
}

function renderSmallTile(tile: TileDef, w: number, h: number) {
  return <TileRenderer tile={tile} width={w} height={h} />;
}

function renderConcealedTile(w: number, h: number) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: '8px',
        background: 'var(--mahjong-concealed-tile-bg)',
        border: '1px solid var(--game-panel-border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 6px 14px rgba(0,0,0,0.16)',
      }}
    />
  );
}

function getMeldLabel(type: string) {
  if (type === 'chi') return 'Chi';
  if (type === 'pon') return 'Pon';
  if (type === 'kan-open') return 'Open Kan';
  if (type === 'kan-added') return 'Added Kan';
  if (type === 'kan-closed') return 'Closed Kan';
  return type;
}

export function MeldArea({ melds }: MeldAreaProps) {
  const scale = useScale();
  const tileW = Math.round(63 * scale);
  const tileH = Math.round(87 * scale);
  return (
    <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
      {melds.map((meld, i) => (
        <div key={i} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.375rem 0.45rem',
          borderRadius: '12px',
          background: 'var(--game-panel-overlay)',
          border: '1px solid var(--game-panel-border)',
          boxShadow: '0 8px 18px rgba(0,0,0,0.16)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', gap: '2px' }}>
            {(!meld.tiles || meld.tiles.length === 0) && (
              <span style={{ fontSize: `${1.5 * scale}rem`, color: 'var(--text-muted)', padding: '0 0.375rem' }}>{meld.type}</span>
            )}
            {meld.tiles && meld.tiles.length > 0 && meld.tiles.map((t: any, j: number) => {
              if (meld.isConcealed) return <div key={j}>{renderConcealedTile(tileW, tileH)}</div>;
              const tileId = typeof t === 'string' ? t : t.id;
              const tileDef = parseTileId(tileId);
              return <div key={j}>{renderSmallTile(tileDef, tileW, tileH)}</div>;
            })}
          </div>
          <span style={{
            fontSize: `${0.74 * scale}rem`,
            color: 'var(--game-on-table-muted)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            textShadow: 'var(--game-text-outline-shadow)',
          }}>
            {getMeldLabel(meld.type)}
          </span>
        </div>
      ))}
    </div>
  );
}
