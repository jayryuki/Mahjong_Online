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

export function MeldArea({ melds }: MeldAreaProps) {
  const scale = useScale();
  const tileW = Math.round(63 * scale);
  const tileH = Math.round(87 * scale);
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
            <span style={{ fontSize: `${1.5 * scale}rem`, color: 'var(--text-muted)', padding: '0 0.375rem' }}>{meld.type}</span>
          )}
          {meld.tiles && meld.tiles.length > 0 && meld.tiles.map((t: any, j: number) => {
            const tileId = typeof t === 'string' ? t : t.id;
            const tileDef = parseTileId(tileId);
            return <div key={j}>{renderSmallTile(tileDef, tileW, tileH)}</div>;
          })}
        </div>
      ))}
    </div>
  );
}
