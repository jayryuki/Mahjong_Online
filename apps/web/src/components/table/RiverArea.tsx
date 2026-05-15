import React, { useEffect, useRef, useState, useMemo } from 'react';
import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
import { TileDef } from '@mahjong/game-core';

interface RiverEntry {
  tile: TileDef;
  isLastDiscard?: boolean;
  isRiichiDiscard?: boolean;
}

interface RiverAreaProps {
  entries: RiverEntry[];
}

const BASE_RIVER_TILE_W = 57;
const BASE_RIVER_TILE_H = 78;
const TILE_ASPECT = BASE_RIVER_TILE_W / BASE_RIVER_TILE_H;
const GAP = 2;
const PADDING = 4;

function RiverTile({ tile, isLast, tileW, tileH }: { tile: TileDef; isLast: boolean; tileW: number; tileH: number }) {
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (isLast) {
      setIsNew(true);
      const timer = setTimeout(() => setIsNew(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isLast, tile.id]);

  const wrapperStyle: React.CSSProperties = {
    opacity: isLast ? 1 : 0.75,
    transform: isLast ? 'translateY(-4px)' : 'none',
    transition: 'transform 200ms ease, opacity 200ms ease, width 300ms ease, height 300ms ease',
    ...(isNew && { animation: 'tileDropIn 400ms ease-out' }),
  };

  return (
    <div style={wrapperStyle}>
      <TileRenderer tile={tile} width={tileW} height={tileH} />
    </div>
  );
}

function computeAutoGrid(
  containerW: number,
  containerH: number,
  tileCount: number
): { cols: number; rows: number; tileW: number; tileH: number } {
  if (tileCount === 0 || containerW <= 0 || containerH <= 0) {
    return { cols: 0, rows: 0, tileW: 0, tileH: 0 };
  }

  const innerW = containerW - PADDING * 2;
  const innerH = containerH - PADDING * 2;

  let bestCols = 1;
  let bestArea = 0;

  const maxColsToTry = Math.min(tileCount, Math.floor(innerW / 12));

  for (let cols = 1; cols <= maxColsToTry; cols++) {
    const rows = Math.ceil(tileCount / cols);
    const availW = innerW - (cols - 1) * GAP;
    const availH = innerH - (rows - 1) * GAP;

    if (availW <= 0 || availH <= 0) continue;

    const fitW = availW / cols;
    const fitH = availH / rows;

    let tileW: number, tileH: number;
    if (fitW / TILE_ASPECT <= fitH) {
      tileW = fitW;
      tileH = fitW / TILE_ASPECT;
    } else {
      tileH = fitH;
      tileW = fitH * TILE_ASPECT;
    }

    tileW = Math.min(tileW, BASE_RIVER_TILE_W);
    tileH = Math.min(tileH, BASE_RIVER_TILE_H);

    const area = tileW * tileH;
    if (area > bestArea) {
      bestArea = area;
      bestCols = cols;
    }
  }

  const rows = Math.ceil(tileCount / bestCols);
  const availW = innerW - (bestCols - 1) * GAP;
  const availH = innerH - (rows - 1) * GAP;

  let tileW: number, tileH: number;
  if (availW / bestCols / TILE_ASPECT <= availH / rows) {
    tileW = Math.min(availW / bestCols, BASE_RIVER_TILE_W);
    tileH = tileW / TILE_ASPECT;
    if (tileH > BASE_RIVER_TILE_H) {
      tileH = BASE_RIVER_TILE_H;
      tileW = tileH * TILE_ASPECT;
    }
  } else {
    tileH = Math.min(availH / rows, BASE_RIVER_TILE_H);
    tileW = tileH * TILE_ASPECT;
    if (tileW > BASE_RIVER_TILE_W) {
      tileW = BASE_RIVER_TILE_W;
      tileH = tileW / TILE_ASPECT;
    }
  }

  return { cols: bestCols, rows, tileW, tileH };
}

export function RiverArea({ entries }: RiverAreaProps) {
  const scale = useScale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const grid = useMemo(() => {
    return computeAutoGrid(containerSize.w, containerSize.h, entries.length);
  }, [containerSize.w, containerSize.h, entries.length]);

  const { cols, tileW, tileH } = grid;
  const scaledW = Math.round(tileW * scale);
  const scaledH = Math.round(tileH * scale);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.1)',
        borderRadius: '6px',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {entries.length > 0 && cols > 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${scaledW}px)`,
          gridTemplateRows: `repeat(${grid.rows}, ${scaledH}px)`,
          gap: `${GAP}px`,
          padding: `${PADDING}px`,
          placeItems: 'center',
          transition: 'all 300ms ease',
        }}>
          {entries.map((e, i) => (
            <RiverTile key={e.tile.id + '-' + i} tile={e.tile} isLast={!!e.isLastDiscard} tileW={scaledW} tileH={scaledH} />
          ))}
        </div>
      )}
    </div>
  );
}
